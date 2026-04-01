"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApiErrorResponse,
  Difficulty,
  MatchStateResponse,
  QueueStateResponse,
  QueueStatusResponse,
  SessionResponse,
} from "@/shared/api/contracts";

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

const DEFAULT_FEEDBACK = "메인에서 바로 매칭을 시작할 수 있습니다.";

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

async function readSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      authenticated: false,
      member: null,
    } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
}

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
  const response = await fetch("/api/tags", {
    cache: "no-store",
  });

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

  return normalized.length > 0 ? normalized : null;
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

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
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
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const [editorLineCount, setEditorLineCount] = useState(28);
  const [editorLineHeight, setEditorLineHeight] = useState(32);
  const [editorFontSize, setEditorFontSize] = useState(13);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
      const fallbackHeight = Math.max(window.innerHeight - 180, lineHeight);
      const measuredHeight = editorPane.getBoundingClientRect().height;
      const usableHeight = Math.max(measuredHeight, fallbackHeight);
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

    const resizeObserver = new ResizeObserver(() => {
      updateEditorMetrics();
    });

    resizeObserver.observe(editorPane);
    window.addEventListener("resize", updateEditorMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateEditorMetrics);
    };
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const nextSession = await readSession();

      if (!active) {
        return;
      }

      setSession(nextSession);

      if (!nextSession.authenticated) {
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
        setQueueState(nextQueueState);
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
        applyMatchSnapshot(nextMatchState);
        return;
      }

      resetFlow();
    })();

    return () => {
      active = false;
    };
  }, [applyMatchSnapshot, resetFlow]);

  useEffect(() => {
    if (!session.authenticated || pollStage !== "QUEUE") {
      return;
    }

    let active = true;

    const poll = async () => {
      const nextQueueState = await readQueueState();

      if (!active || !nextQueueState) {
        return;
      }

      if (nextQueueState.inQueue) {
        setQueueState(nextQueueState);
        setModalMode("SEARCHING");
        setError(null);
        setFeedback("대기열에서 상대를 찾고 있습니다.");
        return;
      }

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
        setMatchState(defaultMatchState);
        setFeedback("ready-check 세션을 확인하는 중입니다.");
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
  }, [applyMatchSnapshot, pollStage, session.authenticated]);

  useEffect(() => {
    if (!session.authenticated || pollStage !== "MATCH") {
      return;
    }

    let active = true;

    const poll = async () => {
      const nextMatchState = await readMatchState();

      if (!active || !nextMatchState) {
        return;
      }

      if (nextMatchState.status === "IDLE") {
        setMatchState(defaultMatchState);
        setModalMode("READY_CHECK");
        setError(null);
        setFeedback("ready-check 세션을 확인하는 중입니다.");
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
  }, [applyMatchSnapshot, pollStage, session.authenticated]);

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

      applyMatchSnapshot(payload);
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

      applyMatchSnapshot(payload);
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
    <div className="h-full min-h-0">
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
