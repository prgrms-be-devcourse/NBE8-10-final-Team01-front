"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  Difficulty,
  MatchStateResponse,
  MatchingWsMessage,
  QueueStateResponse,
  QueueStatusResponse,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";

import {
  DEFAULT_REQUIRED_COUNT,
  difficultyOptions,
  getElapsedSeconds,
  getQueueCategoryLabel,
  getRemainingSeconds,
  queueCategories,
  SEARCH_POLL_INTERVAL_MS,
  type QueueCategoryOption,
  type QueueCategoryValue,
} from "./data";
import QueueEditorPane from "./components/queue-editor-pane";
import QueueModal from "./queue-modal";

type ModalMode = "SEARCHING" | "READY_CHECK" | "ROOM_READY" | "TERMINAL" | null;
type PollStage = "IDLE" | "QUEUE" | "MATCH";
type BusyAction =
  | "start"
  | "cancel"
  | "accept"
  | "decline"
  | "join-room"
  | null;
type SubscriptionHandle = { unsubscribe: () => void };

const DEFAULT_FEEDBACK = "메인에서 바로 매칭을 시작할 수 있습니다.";
const TAGS_CACHE_TTL_MS = 60_000;
const MATCHING_PERSONAL_DESTINATION = "/user/queue/matching";

const defaultQueueState: QueueStateResponse = {
  inQueue: false,
  category: null,
  difficulty: null,
  waitingCount: 0,
  requiredCount: DEFAULT_REQUIRED_COUNT,
};

const defaultMatchState: MatchStateResponse = {
  status: "IDLE",
  readyCheck: null,
  room: null,
  message: null,
};

let tagCategoriesCache: {
  expiresAt: number;
  categories: QueueCategoryOption[];
} | null = null;
let tagCategoriesInFlight: Promise<QueueCategoryOption[] | null> | null = null;

async function readQueueState() {
  const response = await fetch("/api/queue/me", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as QueueStateResponse;
}

async function readMatchState() {
  const response = await fetch("/api/matches/me", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MatchStateResponse;
}

async function readTagCategories() {
  const now = Date.now();

  if (tagCategoriesCache && tagCategoriesCache.expiresAt > now) {
    return tagCategoriesCache.categories;
  }

  if (tagCategoriesInFlight) {
    return tagCategoriesInFlight;
  }

  const task = (async () => {
    const response = await fetch("/api/tags");

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as QueueCategoryOption[] | null;

    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const normalized = payload
      .map((item) => ({
        value: (item.value ?? "").trim(),
        label: (item.label ?? "").trim(),
        disabled: item.disabled ?? false,
      }))
      .filter((item) => item.value.length > 0 && item.label.length > 0);

    if (normalized.length === 0) {
      return null;
    }

    tagCategoriesCache = {
      expiresAt: Date.now() + TAGS_CACHE_TTL_MS,
      categories: normalized,
    };

    return normalized;
  })();

  tagCategoriesInFlight = task;

  try {
    return await task;
  } finally {
    tagCategoriesInFlight = null;
  }
}

async function postMatchDecision(matchId: number, action: "accept" | "decline") {
  const response = await fetch(`/api/matches/${matchId}/${action}`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as
    | MatchStateResponse
    | ApiErrorResponse
    | null;

  return { response, payload };
}

async function requestBattleRoomJoin(roomId: number) {
  const response = await fetch(`/api/battle/rooms/${roomId}/join`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

  return { response, payload };
}

function isQueueStatusResponse(
  payload: QueueStatusResponse | ApiErrorResponse | null,
): payload is QueueStatusResponse {
  return (
    payload !== null &&
    "category" in payload &&
    "difficulty" in payload &&
    "waitingCount" in payload
  );
}

function isMatchStateResponse(
  payload: MatchStateResponse | ApiErrorResponse | null,
): payload is MatchStateResponse {
  return payload !== null && "status" in payload;
}

function getApiErrorMessage(
  payload: QueueStatusResponse | MatchStateResponse | ApiErrorResponse | null,
  fallback: string,
) {
  if (payload && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

function buildQueueTopicDestination(category: string, difficulty: string) {
  const normalize = (value: string) => encodeURIComponent(value.trim().toUpperCase());

  return `/topic/matching/queue/${normalize(category)}/${normalize(difficulty)}`;
}

function parseMatchingWsMessage(body: string): MatchingWsMessage | null {
  try {
    const payload = JSON.parse(body) as unknown;

    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      return null;
    }

    const typed = payload as { type?: unknown };

    if (
      typed.type === "QUEUE_STATE_CHANGED" ||
      typed.type === "READY_CHECK_STARTED" ||
      typed.type === "READY_DECISION_CHANGED" ||
      typed.type === "MATCH_CANCELLED" ||
      typed.type === "MATCH_EXPIRED" ||
      typed.type === "ROOM_READY"
    ) {
      return payload as MatchingWsMessage;
    }

    return null;
  } catch {
    return null;
  }
}

function logMatchingDebug(label: string, payload?: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  if (payload === undefined) {
    console.log(`[matching] ${label}`);
    return;
  }

  console.log(`[matching] ${label}`, payload);
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, sessionLoaded } = useAppSession();
  const [queueState, setQueueState] = useState(defaultQueueState);
  const [matchState, setMatchState] = useState(defaultMatchState);
  const [category, setCategory] = useState<QueueCategoryValue>("dp");
  const [categoryOptions, setCategoryOptions] = useState<QueueCategoryOption[]>(queueCategories);
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [queueStartedAt, setQueueStartedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(DEFAULT_FEEDBACK);
  const [error, setError] = useState<string | null>(null);
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);
  const [queueMemo, setQueueMemo] = useState(DEFAULT_FEEDBACK);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [pollStage, setPollStage] = useState<PollStage>("IDLE");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [now, setNow] = useState(Date.now());

  const joiningRoomIdRef = useRef<number | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const personalSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const queueTopicSubscriptionRef = useRef<SubscriptionHandle | null>(null);
  const queueTopicDestinationRef = useRef<string | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const [editorLineCount, setEditorLineCount] = useState(28);
  const [editorLineHeight, setEditorLineHeight] = useState(32);
  const [editorFontSize, setEditorFontSize] = useState(13);

  const clearQueueTopicSubscription = useCallback(() => {
    queueTopicSubscriptionRef.current?.unsubscribe();
    queueTopicSubscriptionRef.current = null;
    queueTopicDestinationRef.current = null;
  }, []);

  const resetFlow = useCallback((nextFeedback = DEFAULT_FEEDBACK) => {
    setQueueState(defaultQueueState);
    setMatchState(defaultMatchState);
    setQueueStartedAt(null);
    setTerminalMessage(null);
    setModalMode(null);
    setPollStage("IDLE");
    setError(null);
    setFeedback(nextFeedback);
    joiningRoomIdRef.current = null;
  }, []);

  const applyMatchSnapshot = useCallback((nextMatchState: MatchStateResponse) => {
    setMatchState(nextMatchState);
    setQueueState(defaultQueueState);
    setQueueStartedAt(null);
    setError(null);

    if (nextMatchState.status === "ACCEPT_PENDING") {
      setTerminalMessage(null);
      setModalMode("READY_CHECK");
      setPollStage("MATCH");
      setFeedback(nextMatchState.message ?? "매칭이 성사되었습니다. 수락 여부를 선택해주세요.");
      return;
    }

    if (nextMatchState.status === "ROOM_READY") {
      setTerminalMessage(null);
      setModalMode("ROOM_READY");
      setPollStage("IDLE");
      setFeedback(nextMatchState.message ?? "전원이 수락했습니다. 배틀룸으로 입장합니다.");
      return;
    }

    if (nextMatchState.status === "EXPIRED" || nextMatchState.status === "CANCELLED") {
      const nextMessage =
        nextMatchState.message ??
        (nextMatchState.status === "EXPIRED"
          ? "수락 시간이 만료되었습니다."
          : "다른 참가자가 매칭을 거절했습니다.");

      setTerminalMessage(nextMessage);
      setModalMode("TERMINAL");
      setPollStage("IDLE");
      setFeedback(nextMessage);
      return;
    }

    setTerminalMessage(null);
    setModalMode(null);
    setPollStage("IDLE");
    setFeedback(DEFAULT_FEEDBACK);
  }, []);

  const attemptRoomEntry = useCallback(
    async (roomId: number) => {
      if (joiningRoomIdRef.current === roomId) {
        return;
      }

      joiningRoomIdRef.current = roomId;
      setBusyAction("join-room");
      setError(null);
      setFeedback("배틀룸으로 입장하는 중입니다.");

      let succeeded = false;

      try {
        const { response, payload } = await requestBattleRoomJoin(roomId);

        if (!response.ok) {
          setError(getApiErrorMessage(payload, "방 입장에 실패했습니다."));
          setFeedback("room join에 실패했습니다. 다시 시도해주세요.");
          return;
        }

        succeeded = true;
        router.push(`/battle/rooms/${roomId}`);
      } finally {
        setBusyAction((current) => (current === "join-room" ? null : current));

        if (!succeeded && joiningRoomIdRef.current === roomId) {
          joiningRoomIdRef.current = null;
        }
      }
    },
    [router],
  );

  const handleQueueStateChangedEvent = useCallback((nextQueueState: QueueStateResponse) => {
    logMatchingDebug("ws QUEUE_STATE_CHANGED", nextQueueState);
    setQueueState({
      ...nextQueueState,
      requiredCount: nextQueueState.requiredCount ?? DEFAULT_REQUIRED_COUNT,
    });
    setQueueStartedAt((current) => current ?? new Date().toISOString());
    setError(null);
    setFeedback("대기열 인원이 갱신되었습니다.");
  }, []);

  const handleReadyCheckStartedEvent = useCallback(
    async (nextMatchState: MatchStateResponse | null) => {
      logMatchingDebug("ws READY_CHECK_STARTED", nextMatchState);
      clearQueueTopicSubscription();

      setQueueState(defaultQueueState);
      setQueueStartedAt(null);
      setError(null);

      if (nextMatchState) {
        applyMatchSnapshot(nextMatchState);
        return;
      }

      const restoredMatchState = await readMatchState();

      if (restoredMatchState && restoredMatchState.status !== "IDLE") {
        logMatchingDebug("ws READY_CHECK_STARTED fallback matches/me", restoredMatchState);
        applyMatchSnapshot(restoredMatchState);
        return;
      }

      setMatchState(defaultMatchState);
      setModalMode("READY_CHECK");
      setPollStage("MATCH");
      setFeedback("ready-check 세션을 확인하는 중입니다.");
    },
    [applyMatchSnapshot, clearQueueTopicSubscription],
  );

  const handleMatchStateEvent = useCallback(
    (
      eventType:
        | "READY_DECISION_CHANGED"
        | "MATCH_CANCELLED"
        | "MATCH_EXPIRED"
        | "ROOM_READY",
      nextMatchState: MatchStateResponse | null,
    ) => {
      logMatchingDebug(`ws ${eventType}`, nextMatchState);

      if (!nextMatchState) {
        return;
      }

      clearQueueTopicSubscription();
      applyMatchSnapshot(nextMatchState);
    },
    [applyMatchSnapshot, clearQueueTopicSubscription],
  );

  const syncQueueTopicSubscription = useCallback(
    (categoryValue: string | null, difficultyValue: string | null) => {
      if (!categoryValue || !difficultyValue) {
        clearQueueTopicSubscription();
        return;
      }

      const destination = buildQueueTopicDestination(categoryValue, difficultyValue);

      if (
        queueTopicDestinationRef.current === destination &&
        queueTopicSubscriptionRef.current
      ) {
        return;
      }

      queueTopicSubscriptionRef.current?.unsubscribe();
      queueTopicSubscriptionRef.current = null;
      queueTopicDestinationRef.current = destination;

      const client = stompClientRef.current;

      if (!client?.connected) {
        return;
      }

      queueTopicSubscriptionRef.current = client.subscribe(destination, (message) => {
        const payload = parseMatchingWsMessage(message.body);

        if (!payload || payload.type !== "QUEUE_STATE_CHANGED" || !payload.queue) {
          return;
        }

        handleQueueStateChangedEvent(payload.queue);
      });
    },
    [clearQueueTopicSubscription, handleQueueStateChangedEvent],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!sessionLoaded || !session.authenticated) {
      personalSubscriptionRef.current?.unsubscribe();
      personalSubscriptionRef.current = null;
      clearQueueTopicSubscription();
      stompClientRef.current = null;
      hasConnectedOnceRef.current = false;
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      reconnectDelay: 3000,
      onConnect: () => {
        logMatchingDebug("ws connected");
        personalSubscriptionRef.current?.unsubscribe();
        personalSubscriptionRef.current = client.subscribe(
          MATCHING_PERSONAL_DESTINATION,
          (message) => {
            const payload = parseMatchingWsMessage(message.body);

            if (!payload) {
              return;
            }

            if (payload.type === "READY_CHECK_STARTED") {
              void handleReadyCheckStartedEvent(payload.match);
              return;
            }

            if (
              payload.type === "READY_DECISION_CHANGED" ||
              payload.type === "MATCH_CANCELLED" ||
              payload.type === "MATCH_EXPIRED" ||
              payload.type === "ROOM_READY"
            ) {
              handleMatchStateEvent(payload.type, payload.match);
            }
          },
        );

        if (queueTopicDestinationRef.current) {
          queueTopicSubscriptionRef.current?.unsubscribe();
          queueTopicSubscriptionRef.current = client.subscribe(
            queueTopicDestinationRef.current,
            (message) => {
              const payload = parseMatchingWsMessage(message.body);

              if (
                !payload ||
                payload.type !== "QUEUE_STATE_CHANGED" ||
                !payload.queue
              ) {
                return;
              }

              handleQueueStateChangedEvent(payload.queue);
            },
          );
        }

        const shouldResync = hasConnectedOnceRef.current;
        hasConnectedOnceRef.current = true;

        if (!shouldResync) {
          return;
        }

        void (async () => {
          const [restoredQueueState, restoredMatchState] = await Promise.all([
            readQueueState(),
            readMatchState(),
          ]);

          if (stompClientRef.current !== client) {
            return;
          }

          if (restoredQueueState?.inQueue) {
            logMatchingDebug("ws reconnect resync queue/me", restoredQueueState);
            setQueueState({
              ...restoredQueueState,
              requiredCount: restoredQueueState.requiredCount ?? DEFAULT_REQUIRED_COUNT,
            });
            setMatchState(defaultMatchState);
            setQueueStartedAt((current) => current ?? new Date().toISOString());
            setTerminalMessage(null);
            setModalMode("SEARCHING");
            setPollStage("QUEUE");
            setError(null);
            setFeedback("?湲곗뿴?먯꽌 ?곷?瑜?李얘퀬 ?덉뒿?덈떎.");
            return;
          }

          if (restoredMatchState && restoredMatchState.status !== "IDLE") {
            logMatchingDebug("ws reconnect resync matches/me", restoredMatchState);
            clearQueueTopicSubscription();
            applyMatchSnapshot(restoredMatchState);
            return;
          }

          clearQueueTopicSubscription();
          logMatchingDebug("ws reconnect resync idle");
          resetFlow();
        })();
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      personalSubscriptionRef.current?.unsubscribe();
      personalSubscriptionRef.current = null;
      clearQueueTopicSubscription();
      stompClientRef.current = null;
      hasConnectedOnceRef.current = false;
      void client.deactivate();
    };
  }, [
    applyMatchSnapshot,
    clearQueueTopicSubscription,
    handleMatchStateEvent,
    handleQueueStateChangedEvent,
    handleReadyCheckStartedEvent,
    resetFlow,
    session.authenticated,
    sessionLoaded,
  ]);

  useEffect(() => {
    if (!session.authenticated) {
      return;
    }

    let active = true;

    void (async () => {
      const loadedCategories = await readTagCategories();

      if (!active || !loadedCategories) {
        return;
      }

      setCategoryOptions(loadedCategories);
      setCategory((current) => {
        if (loadedCategories.some((item) => item.value === current)) {
          return current;
        }

        return loadedCategories.find((item) => !item.disabled)?.value ?? current;
      });
    })();

    return () => {
      active = false;
    };
  }, [session.authenticated]);

  useEffect(() => {
    const editorPane = editorPaneRef.current;

    if (!editorPane) {
      return;
    }

    const resolveEditorMetrics = (width: number) => {
      if (width >= 1920) {
        return { lineHeight: 34, fontSize: 14 };
      }

      if (width >= 1280) {
        return { lineHeight: 33, fontSize: 13 };
      }

      if (width >= 1024) {
        return { lineHeight: 32, fontSize: 13 };
      }

      return { lineHeight: 30, fontSize: 13 };
    };

    const updateEditorMetrics = () => {
      const { lineHeight, fontSize } = resolveEditorMetrics(window.innerWidth);
      const usableHeight = Math.max(window.innerHeight - 180, lineHeight);
      const safetyBufferLines = 8;
      const nextLineCount = Math.max(
        24,
        Math.ceil(usableHeight / lineHeight) + safetyBufferLines,
      );

      setEditorLineHeight((current) => (current === lineHeight ? current : lineHeight));
      setEditorFontSize((current) => (current === fontSize ? current : fontSize));
      setEditorLineCount((current) => (current === nextLineCount ? current : nextLineCount));
    };

    updateEditorMetrics();

    window.addEventListener("resize", updateEditorMetrics);

    return () => {
      window.removeEventListener("resize", updateEditorMetrics);
    };
  }, []);

  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        resetFlow();
        return;
      }

      const [nextQueueState, nextMatchState] = await Promise.all([
        readQueueState(),
        readMatchState(),
      ]);

      if (!active) {
        return;
      }

      if (nextQueueState?.inQueue) {
        setQueueState({
          ...nextQueueState,
          requiredCount: nextQueueState.requiredCount ?? DEFAULT_REQUIRED_COUNT,
        });
        logMatchingDebug("initial restore queue/me inQueue=true", nextQueueState);
        setMatchState(defaultMatchState);
        setQueueStartedAt((current) => current ?? new Date().toISOString());
        setTerminalMessage(null);
        setModalMode("SEARCHING");
        setPollStage("QUEUE");
        setError(null);
        setFeedback("대기열에서 상대를 찾고 있습니다.");
        return;
      }

      if (nextMatchState && nextMatchState.status !== "IDLE") {
        logMatchingDebug("initial restore matches/me", nextMatchState);
        applyMatchSnapshot(nextMatchState);
        return;
      }

      resetFlow();
    })();

    return () => {
      active = false;
    };
  }, [applyMatchSnapshot, resetFlow, session.authenticated, sessionLoaded]);

  useEffect(() => {
    if (
      !session.authenticated ||
      pollStage !== "QUEUE" ||
      !queueState.inQueue ||
      !queueState.category ||
      !queueState.difficulty
    ) {
      clearQueueTopicSubscription();
      return;
    }

    syncQueueTopicSubscription(queueState.category, queueState.difficulty);
  }, [
    clearQueueTopicSubscription,
    pollStage,
    queueState.category,
    queueState.difficulty,
    queueState.inQueue,
    session.authenticated,
    syncQueueTopicSubscription,
  ]);

  useEffect(() => {
    if (!session.authenticated || pollStage !== "QUEUE") {
      return;
    }

    // SEARCHING 단계에서는 queue/me interval polling 대신 queue topic WebSocket만 사용한다.
    return;

    let active = true;

    const poll = async () => {
      const nextQueueState = await readQueueState();

      if (!active || !nextQueueState) {
        return;
      }

      if (nextQueueState.inQueue) {
        logMatchingDebug("poll queue/me inQueue=true", nextQueueState);
        setQueueState({
          ...nextQueueState,
          requiredCount: nextQueueState.requiredCount ?? DEFAULT_REQUIRED_COUNT,
        });
        setModalMode("SEARCHING");
        setError(null);
        setFeedback("대기열에서 상대를 찾고 있습니다.");
        return;
      }

      clearQueueTopicSubscription();
      logMatchingDebug("poll queue/me inQueue=false -> switch to matches/me", nextQueueState);
      setQueueState(nextQueueState);
      setQueueStartedAt(null);
      setModalMode("READY_CHECK");
      setPollStage("MATCH");
      setError(null);
      setFeedback("ready-check 세션을 확인하는 중입니다.");

      const nextMatchState = await readMatchState();

      if (!active || !nextMatchState) {
        return;
      }

      if (nextMatchState.status === "IDLE") {
        logMatchingDebug("poll matches/me status=IDLE -> reset flow");
        resetFlow("매칭이 취소되었거나 종료되었습니다. 다시 시작할 수 있습니다.");
        return;
      }

      logMatchingDebug("poll matches/me state", nextMatchState);
      logMatchingDebug("poll matches/me state", nextMatchState);
      applyMatchSnapshot(nextMatchState);
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, SEARCH_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    applyMatchSnapshot,
    clearQueueTopicSubscription,
    pollStage,
    resetFlow,
    session.authenticated,
  ]);

  useEffect(() => {
    if (!session.authenticated || pollStage !== "MATCH") {
      return;
    }

    // READY_CHECK 상태는 개인 matching WebSocket snapshot으로만 갱신한다.
    return;

    let active = true;

    const poll = async () => {
      const nextMatchState = await readMatchState();

      if (!active || !nextMatchState) {
        return;
      }

      if (nextMatchState.status === "IDLE") {
        logMatchingDebug("poll match stage status=IDLE -> reset flow");
        resetFlow("ready-check 세션이 종료되었습니다. 다시 매칭을 시작하세요.");
        return;
      }

      applyMatchSnapshot(nextMatchState);
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, SEARCH_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [applyMatchSnapshot, pollStage, resetFlow, session.authenticated]);

  useEffect(() => {
    const roomId = matchState.room?.roomId ?? null;

    if (!session.authenticated || modalMode !== "ROOM_READY" || roomId === null) {
      return;
    }

    void attemptRoomEntry(roomId);
  }, [attemptRoomEntry, matchState.room?.roomId, modalMode, session.authenticated]);

  async function handleStartMatch() {
    if (!session.authenticated) {
      router.push("/login?next=/");
      return;
    }

    if (category === "RANDOM") {
      setError("현재는 구체적인 카테고리만 매칭할 수 있습니다.");
      return;
    }

    if (modalMode && modalMode !== "TERMINAL") {
      setError("이미 진행 중인 매칭 흐름이 있습니다.");
      return;
    }

    setBusyAction("start");
    setError(null);
    setTerminalMessage(null);

    try {
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          category,
          difficulty,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | QueueStatusResponse
        | ApiErrorResponse
        | null;

      if ((response.ok || response.status === 409) && isQueueStatusResponse(payload)) {
        setQueueState({
          inQueue: true,
          category: payload.category,
          difficulty: payload.difficulty,
          waitingCount: payload.waitingCount,
          requiredCount: payload.requiredCount ?? DEFAULT_REQUIRED_COUNT,
        });
        setMatchState(defaultMatchState);
        setQueueStartedAt(new Date().toISOString());
        setModalMode("SEARCHING");
        setPollStage("QUEUE");
        setFeedback(payload.message);
        syncQueueTopicSubscription(payload.category, payload.difficulty);
        return;
      }

      setError(getApiErrorMessage(payload, "매칭 참가 요청에 실패했습니다."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancelMatch() {
    if (modalMode !== "SEARCHING") {
      return;
    }

    setBusyAction("cancel");
    setError(null);

    try {
      const response = await fetch("/api/queue/cancel", {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as
        | QueueStatusResponse
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        setError(getApiErrorMessage(payload, "매칭 취소 요청에 실패했습니다."));
        return;
      }

      clearQueueTopicSubscription();
      resetFlow(getApiErrorMessage(payload, "매칭 대기열에서 취소됐습니다."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAcceptMatch() {
    const matchId = matchState.readyCheck?.matchId;

    if (!matchId) {
      return;
    }

    setBusyAction("accept");
    setError(null);

    try {
      const { response, payload } = await postMatchDecision(matchId, "accept");

      if (!response.ok || !isMatchStateResponse(payload)) {
        setError(getApiErrorMessage(payload, "매칭 수락 요청에 실패했습니다."));
        return;
      }

      setFeedback(
        payload.message ??
          "매칭 수락 요청을 전송했습니다. 다른 참가자의 응답을 기다리고 있습니다.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeclineMatch() {
    const matchId = matchState.readyCheck?.matchId;

    if (!matchId) {
      return;
    }

    setBusyAction("decline");
    setError(null);

    try {
      const { response, payload } = await postMatchDecision(matchId, "decline");

      if (!response.ok || !isMatchStateResponse(payload)) {
        setError(getApiErrorMessage(payload, "매칭 거절 요청에 실패했습니다."));
        return;
      }

      setFeedback(payload.message ?? "매칭 거절 요청을 전송했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleCloseTerminal() {
    resetFlow("종료 상태를 정리했습니다. 메인에서 다시 매칭을 시작할 수 있습니다.");
  }

  const isBusy = busyAction !== null;
  const waitingCount = queueState.inQueue ? Math.max(queueState.waitingCount, 1) : 0;
  const requiredCount =
    queueState.requiredCount ||
    matchState.readyCheck?.requiredCount ||
    DEFAULT_REQUIRED_COUNT;
  const activeCategoryLabel = getQueueCategoryLabel(
    queueState.category ?? category,
    categoryOptions,
  );
  const activeDifficultyLabel = queueState.difficulty ?? difficulty;
  const queueElapsedSeconds = getElapsedSeconds(queueStartedAt, now);
  const countdownSeconds = getRemainingSeconds(matchState.readyCheck?.deadline ?? null, now);
  const canStartMatch = !(isBusy || (modalMode !== null && modalMode !== "TERMINAL"));
  const roomId = matchState.room?.roomId ?? null;
  const editorLineNumbers = Array.from({ length: editorLineCount }, (_, index) => 41 + index);
  const editorLineStyle = {
    height: `${editorLineHeight}px`,
    lineHeight: `${editorLineHeight}px`,
  };
  const editorRowStyle = {
    minHeight: `${editorLineHeight}px`,
    lineHeight: `${editorLineHeight}px`,
  };
  const editorContentStyle = {
    fontSize: `${editorFontSize}px`,
  };

  return (
    <div className="relative h-full min-h-0">
      <QueueEditorPane
        editorPaneRef={editorPaneRef}
        editorContentStyle={editorContentStyle}
        editorLineNumbers={editorLineNumbers}
        editorLineStyle={editorLineStyle}
        editorRowStyle={editorRowStyle}
        canStartMatch={canStartMatch}
        onStartMatch={() => {
          void handleStartMatch();
        }}
        category={category}
        onCategoryChange={setCategory}
        categoryOptions={categoryOptions}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        difficultyOptions={difficultyOptions}
        queueMemo={queueMemo}
        onQueueMemoChange={setQueueMemo}
        showStopQueueButton={modalMode === "SEARCHING"}
        onCancelQueue={() => {
          void handleCancelMatch();
        }}
        isBusy={isBusy}
        error={error}
        terminalMessage={terminalMessage}
      />

      <QueueModal
        mode={modalMode}
        categoryLabel={activeCategoryLabel}
        difficultyLabel={activeDifficultyLabel}
        currentUserId={session.member?.memberId ?? null}
        roomId={roomId}
        error={error}
        feedback={feedback}
        isPending={isBusy}
        queueElapsedSeconds={queueElapsedSeconds}
        waitingCount={waitingCount}
        requiredCount={requiredCount}
        readyCheck={matchState.readyCheck}
        countdownSeconds={countdownSeconds}
        terminalMessage={terminalMessage}
        onCancel={() => {
          void handleCancelMatch();
        }}
        onAccept={() => {
          void handleAcceptMatch();
        }}
        onDecline={() => {
          void handleDeclineMatch();
        }}
        onRetryRoomEntry={() => {
          if (roomId !== null) {
            void attemptRoomEntry(roomId);
          }
        }}
        onCloseTerminal={handleCloseTerminal}
      />
    </div>
  );
}
