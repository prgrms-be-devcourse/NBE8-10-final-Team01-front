"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApiErrorResponse,
  Difficulty,
  MatchStateResponse,
  MyBattleResultItem,
  MyBattleResultsResponse,
  QueueStateResponse,
  QueueStatusResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import { StatusPill } from "@/shared/ui";
import { formatRoleLabel } from "@/shared/utils/format-role-label";

import {
  DEFAULT_REQUIRED_COUNT,
  difficultyOptions,
  getElapsedSeconds,
  getQueueCategoryLabel,
  getRemainingSeconds,
  queueCategories,
  SEARCH_POLL_INTERVAL_MS,
  type QueueCategoryValue,
} from "./data";
import QueueModal from "./queue-modal";

type ModalMode = "SEARCHING" | "READY_CHECK" | "ROOM_READY" | "TERMINAL" | null;
type PollStage = "IDLE" | "QUEUE" | "MATCH";
type BusyAction =
  | "start"
  | "cancel"
  | "accept"
  | "decline"
  | "join-room"
  | "logout"
  | null;

const DEFAULT_FEEDBACK = "메인에서 바로 매칭을 시작할 수 있습니다.";
const PREVIEW_RESULTS_SIZE = 5;

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

async function readMyBattleResultsPreview(size: number) {
  const response = await fetch(`/api/me/battle-results?page=0&size=${size}`, {
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as MyBattleResultsResponse | null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
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
  const [recentResults, setRecentResults] = useState<MyBattleResultItem[]>([]);
  const [resultsPreviewMessage, setResultsPreviewMessage] = useState("로그인 후 최근 전적을 확인할 수 있습니다.");
  const [resultsPreviewError, setResultsPreviewError] = useState<string | null>(null);

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
      const verticalPadding = lineHeight;
      const usableHeight = Math.max(editorPane.clientHeight - verticalPadding, lineHeight);
      const nextLineCount = Math.max(18, Math.floor(usableHeight / lineHeight));

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
    let active = true;

    if (!session.authenticated) {
      setRecentResults([]);
      setResultsPreviewError(null);
      setResultsPreviewMessage("로그인 후 최근 전적을 확인할 수 있습니다.");
      return () => {
        active = false;
      };
    }

    setResultsPreviewError(null);
    setResultsPreviewMessage("최근 전적을 불러오는 중입니다.");

    void (async () => {
      const { ok, status, payload } = await readMyBattleResultsPreview(PREVIEW_RESULTS_SIZE);

      if (!active) {
        return;
      }

      if (status === 401 || payload?.resultCode === "MEMBER_401") {
        setRecentResults([]);
        setResultsPreviewError(null);
        setResultsPreviewMessage(payload?.msg ?? "로그인이 필요합니다.");
        return;
      }

      if (!ok || !payload || payload.resultCode !== "200" || !payload.data) {
        setRecentResults([]);
        setResultsPreviewError(payload?.msg ?? "최근 전적을 불러오지 못했습니다.");
        setResultsPreviewMessage(payload?.msg ?? "전적 조회에 실패했습니다.");
        return;
      }

      const loaded = payload.data.battleResults;
      setRecentResults(loaded);
      setResultsPreviewError(null);
      setResultsPreviewMessage(
        loaded.length > 0 ? payload.msg : "아직 완료한 배틀 전적이 없습니다.",
      );
    })();

    return () => {
      active = false;
    };
  }, [session.authenticated]);

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

  function handleProtectedMove(href: string) {
    if (!session.authenticated) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }

    router.push(href);
  }

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

  async function handleLogout() {
    setBusyAction("logout");

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setSession({
        authenticated: false,
        member: null,
      });
      resetFlow("로그아웃했습니다.");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;
  const waitingCount = queueState.inQueue ? Math.max(queueState.waitingCount, 1) : 0;
  const requiredCount =
    queueState.requiredCount ||
    matchState.readyCheck?.requiredCount ||
    DEFAULT_REQUIRED_COUNT;
  const activeCategoryLabel = getQueueCategoryLabel(queueState.category ?? category);
  const activeDifficultyLabel = queueState.difficulty ?? difficulty;
  const queueElapsedSeconds = getElapsedSeconds(queueStartedAt, now);
  const countdownSeconds = getRemainingSeconds(matchState.readyCheck?.deadline ?? null, now);
  const canStartMatch = !(isBusy || (modalMode !== null && modalMode !== "TERMINAL"));
  const roomId = matchState.room?.roomId ?? null;
  const previewPlayedCount = recentResults.length;
  const previewSolvedCount = recentResults.filter((item) => item.solved).length;
  const previewWinRate =
    previewPlayedCount > 0 ? Math.round((previewSolvedCount / previewPlayedCount) * 100) : null;
  const previewScoreDelta = recentResults.reduce((acc, item) => acc + item.scoreDelta, 0);
  const previewScoreDeltaLabel =
    previewScoreDelta > 0 ? `+${previewScoreDelta}` : String(previewScoreDelta);
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
  const ideProjectTreeItems: Array<{
    key: string;
    label: string;
    depth: number;
    icon: "root" | "folder" | "folderAccent" | "package" | "class" | "file" | "fileAccent";
    hasChildren?: boolean;
    expanded?: boolean;
    subtitle?: string;
    rowTone?: "amber" | "green" | "selected";
    href?: string;
  }> = [
    {
      key: "root",
      label: "BRACKET {}",
      depth: 0,
      icon: "root",
      hasChildren: true,
      expanded: true,
    },
    {
      key: "quick-menu",
      label: "퀵메뉴",
      depth: 1,
      icon: "folderAccent",
      hasChildren: true,
      expanded: true,
      rowTone: "amber",
    },
    {
      key: "home-screen",
      label: "메인",
      depth: 2,
      icon: "class",
      rowTone: "selected",
      href: "/",
    },
    { key: "problem-list", label: "문제 목록", depth: 2, icon: "class", href: "/problems" },
    { key: "spectate-list", label: "관전", depth: 2, icon: "class", href: "/spectate" },
    { key: "mypage", label: "마이페이지", depth: 2, icon: "class", href: "/mypage" },
  ];
  const ideRailTopItems = [
    { icon: "project", active: true, title: "Project" },
    { icon: "sliders", title: "Services" },
    { icon: "branch", title: "Git" },
    { icon: "layout", title: "Layout" },
    { icon: "more", title: "More" },
  ];
  const ideRailBottomItems = [
    { icon: "cube", title: "AI" },
    { icon: "tools", title: "Tools" },
    { icon: "play", title: "Run" },
    { icon: "terminal", title: "Terminal" },
    { icon: "issue", title: "Problems" },
    { icon: "nodes", title: "Connections" },
  ];
  const ideDbRailTopItems = [
    { icon: "notifications", title: "알림" },
    { icon: "search", title: "검색" },
    { icon: "database", title: "데이터베이스", active: true },
    { icon: "gamepad", title: "게임" },
    { icon: "blocks", title: "서비스" },
    { icon: "docs", title: "문서" },
    { icon: "users", title: "사용자" },
    { icon: "cloud", title: "클라우드" },
    { icon: "link", title: "연결" },
  ];
  const ideDbRailBottomItems = [{ icon: "hammer", title: "도구" }];
  const renderRailIcon = (name: string) => {
    const baseClass = "h-4 w-4";

    switch (name) {
      case "project":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path
              d="M2 4.5h4l1.1 1.2H14v6.8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path d="M2.2 6h11.6" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        );
      case "sliders":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M2 5.2h12M2 10.8h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="6" cy="5.2" r="1.6" fill="#25272d" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="10" cy="10.8" r="1.6" fill="#25272d" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "branch":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="4" cy="3.8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11.8" cy="6.8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8.2" cy="12.2" r="1.3" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M5.3 4.4c2 .2 3.4.7 4.8 1.6M11 8c-.5 1.5-1.3 2.4-2.2 3.2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        );
      case "layout":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2.2 7.8h11.6M7.8 2.2v11.6" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        );
      case "more":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="4" cy="8" r="1" fill="currentColor" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
            <circle cx="12" cy="8" r="1" fill="currentColor" />
          </svg>
        );
      case "cube":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M8 2.4 12.8 5v6L8 13.6 3.2 11V5L8 2.4Z" stroke="currentColor" strokeWidth="1.1" />
            <path d="m8 2.4 4.8 2.6L8 7.5 3.2 5 8 2.4ZM8 7.5V13.6" stroke="currentColor" strokeWidth="1.1" />
            <path d="m12.2 2.2.8.8m0 0 .8-.8M13 3v1.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        );
      case "tools":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="m4 5 7 7M11.5 4.5a2 2 0 0 0-2.6 2.6l2.6-2.6ZM3.2 10.8l2-2L7 10.6l-2 2-1.8-1.8Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m9 3 1.2 1.2M8 4l1.2 1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        );
      case "play":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M4.2 3.8h7.6v8.4H4.2z" stroke="currentColor" strokeWidth="1.1" transform="rotate(-30 8 8)" />
            <path d="m6.6 5.9 4 2.1-4 2.1V5.9Z" fill="currentColor" />
          </svg>
        );
      case "terminal":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
            <path d="m5.1 6.7 2 1.5-2 1.5M8.8 9.8h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "issue":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5.4v3.2M8 11h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        );
      case "nodes":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="11.3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6.4 5.2h3.6M10.8 6.8l-2 3.1M6.8 10l-1.2-3.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };
  const renderProjectTreeIcon = (
    icon: "root" | "folder" | "folderAccent" | "package" | "class" | "file" | "fileAccent",
  ) => {
    switch (icon) {
      case "class":
        return (
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#3b78e7] text-[8px] font-semibold leading-none text-[#62a5ff]">
            C
          </span>
        );
      case "package":
        return (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#6ea5ff]">
            <path d="M2.2 5h3.2l.9.9h7.5v6.1a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V5Z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "folderAccent":
        return (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#cf8f4e]">
            <path d="M2.2 4.8h3.4l1 1h7.2v6.2a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V4.8Z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "root":
      case "folder":
        return (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-zinc-300">
            <path d="M2.2 4.8h3.4l1 1h7.2v6.2a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V4.8Z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "fileAccent":
        return (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#6ea5ff]">
            <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "file":
      default:
        return (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-zinc-300">
            <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
    }
  };
  const renderDbRailIcon = (name: string) => {
    const baseClass = "h-4 w-4";

    switch (name) {
      case "notifications":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M8 3a3 3 0 0 0-3 3v2.2l-1 1.6h8l-1-1.6V6a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="12.2" cy="3.8" r="1.4" fill="#ff5f6d" />
          </svg>
        );
      case "search":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="7" cy="7" r="3.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="m10 10 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "database":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <ellipse cx="8" cy="4.1" rx="4.7" ry="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.3 4.1v4.8c0 1.1 2.1 2 4.7 2s4.7-.9 4.7-2V4.1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "gamepad":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <rect x="3" y="6.2" width="10" height="5.8" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.4 9h2.2M6.5 7.9v2.2M10.6 8.4h.01M11.8 9.6h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "blocks":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <rect x="2.4" y="2.4" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8.8" y="2.4" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
            <rect x="5.6" y="8.8" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "docs":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9 2.5V6h3M5.2 8.2h5.6M5.2 10.2h5.6" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        );
      case "users":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <circle cx="6.1" cy="6.1" r="2.1" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11.1" cy="6.7" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.4 12c.5-1.7 1.6-2.7 2.9-2.7s2.4 1 2.9 2.7M9 12.1c.4-1.3 1.2-2.1 2.2-2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "cloud":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M4.8 11.8h6a2.2 2.2 0 1 0-.4-4.4 3.1 3.1 0 0 0-5.9.8 1.9 1.9 0 0 0 .3 3.6Z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      case "link":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="M6.5 9.5 9.5 6.5M5.3 11a2.3 2.3 0 0 1 0-3.2l1.5-1.5a2.3 2.3 0 1 1 3.2 3.2l-.6.6M10.7 5a2.3 2.3 0 0 1 0 3.2l-1.5 1.5a2.3 2.3 0 1 1-3.2-3.2l.6-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "hammer":
        return (
          <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
            <path d="m9.2 3.2 3.1 3.1M4.1 12.2 9.9 6.4 7.6 4.1 1.8 9.9l2.3 2.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="-my-4 ml-[calc(50%-50dvw)] w-[100dvw] max-w-none min-h-[calc(100dvh-var(--app-header-h))] xl:h-[calc(100dvh-var(--app-header-h))] xl:overflow-hidden">
      <section className="overflow-hidden bg-[#1e1f22] xl:h-full xl:min-h-0">
        <div className="grid h-full grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_250px] xl:grid-cols-[260px_minmax(0,1fr)_290px] 2xl:grid-cols-[290px_minmax(1200px,1fr)_320px]">
          <aside className="min-h-0 border-b border-zinc-800/90 bg-[#2b2d30] md:border-b-0 md:border-r">
            <div className="grid h-full grid-cols-[48px_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col items-center justify-between border-r border-zinc-800/90 bg-[#25272d] py-2">
                <div className="flex flex-col items-center gap-2">
                  {ideRailTopItems.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      title={item.title}
                      aria-label={item.title}
                      className={`h-8 w-8 rounded-md border text-[10px] font-semibold tracking-wide transition ${
                        item.active
                          ? "border-zinc-500 bg-zinc-700/70 text-zinc-100"
                          : "border-transparent text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-300"
                      }`}
                    >
                      <span className="flex items-center justify-center">{renderRailIcon(item.icon)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                  {ideRailBottomItems.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      title={item.title}
                      aria-label={item.title}
                      className="h-8 w-8 rounded-md border border-transparent text-[10px] font-semibold tracking-wide text-zinc-500 transition hover:bg-zinc-700/30 hover:text-zinc-300"
                    >
                      <span className="flex items-center justify-center">{renderRailIcon(item.icon)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="flex h-12 items-center justify-between border-b border-zinc-800/90 px-4">
                  <p className="text-sm font-semibold text-zinc-200">퀵 메뉴</p>
                  <span className="text-xs text-zinc-500">▼</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-sm text-zinc-300">
                  {ideProjectTreeItems.map((item) => {
                    const rowToneClass =
                      item.rowTone === "amber"
                        ? "bg-[#4a3924]/50"
                        : item.rowTone === "green"
                          ? "bg-[#1f3a2a]/55"
                          : item.rowTone === "selected"
                            ? "bg-zinc-600/70"
                            : "hover:bg-zinc-700/30";

                    const content = (
                      <div
                        className={`flex h-7 items-center gap-1.5 rounded-sm px-1.5 ${rowToneClass}`}
                        style={{ paddingLeft: `${item.depth * 8 + 4}px` }}
                      >
                        <span className="inline-flex w-3 items-center justify-center text-[10px] text-zinc-500">
                          {item.hasChildren ? (item.expanded ? "▾" : "▸") : ""}
                        </span>
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                          {renderProjectTreeIcon(item.icon)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                          {item.label}
                        </span>
                        {item.subtitle ? (
                          <span className="truncate pl-1 text-[12px] text-zinc-500">{item.subtitle}</span>
                        ) : null}
                      </div>
                    );

                    if (item.href) {
                      const href = item.href === "/"
                        ? "/"
                        : !session.authenticated
                          ? `/login?next=${encodeURIComponent(item.href)}`
                          : item.href;

                      return (
                        <Link key={item.key} href={href}>
                          {content}
                        </Link>
                      );
                    }

                    return <div key={item.key}>{content}</div>;
                  })}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-h-0 border-b border-zinc-700/80 bg-[#1e1f22] lg:border-b-0 lg:border-r">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-12 items-center justify-between border-b border-zinc-700/80 bg-[#1e1f22] px-3">
                <div className="flex h-full items-end gap-0.5 pt-1">
                  <div className="relative flex h-10 items-center gap-2 border-r border-zinc-700/70 bg-[#1e1f22] px-3 font-mono text-xs text-zinc-200">
                    <span className="inline-flex h-4 w-4 items-center justify-center text-[#7da2f7]">
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                        <path
                          d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="6.4" cy="10.8" r="0.7" fill="currentColor" />
                      </svg>
                    </span>
                    <span>.env</span>
                    <span className="text-zinc-500">×</span>
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-zinc-300" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleStartMatch();
                  }}
                  disabled={!canStartMatch}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#b08cff]/45 bg-[#9146ff] px-3 text-sm font-semibold text-white transition hover:bg-[#7f39fa] disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-600 disabled:text-zinc-300"
                  aria-label="매칭 시작"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[#7dd48c]">
                    <path
                      d="M8 2.3v3M5 3.4A4.9 4.9 0 1 0 11 3.4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>매칭 시작</span>
                  <span className="mx-0.5 h-4 w-px bg-white/35" />
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[#74cc84]">
                    <path d="m6 4 5 4-5 4V4Z" fill="currentColor" />
                  </svg>
                </button>
              </div>

              <div ref={editorPaneRef} className="flex-1 overflow-hidden bg-[#1e1f22]">
                <div
                  className="grid h-full grid-cols-[56px_minmax(0,1fr)] bg-[#1e1f22] font-mono"
                  style={editorContentStyle}
                >
                  <div className="border-r border-zinc-700/70 bg-[#1e1f22] px-3 py-4 text-right text-[#606366]">
                    {editorLineNumbers.map((line) => (
                      <div key={line} style={editorLineStyle}>
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-4 text-[#a9b7c6]">
                    <div className="whitespace-nowrap text-[#6a717d]" style={editorLineStyle}>
                      # queue config
                    </div>
                    <div className="whitespace-nowrap text-[#6a717d]" style={editorLineStyle}>
                      # 카테고리와 난이도를 선택하고 매칭 시작을 눌러 대기열에 참가합니다.
                    </div>
                    <div className="flex items-center gap-2" style={editorRowStyle}>
                      <span className="w-40 text-[#9cdcfe]">QUEUE_CATEGORY</span>
                      <span className="text-[#80889a]">=</span>
                      <div className="relative min-w-[11rem] max-w-[18rem] flex-1 leading-none">
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value as QueueCategoryValue)}
                          className="h-7 w-full appearance-none rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 pr-6 text-xs text-[#ce9178] outline-none transition focus:border-[#4e89ff]/70"
                        >
                          {queueCategories.map((item) => (
                            <option
                              key={item.value}
                              value={item.value}
                              disabled={"disabled" in item ? item.disabled : false}
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-500">
                          ▾
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" style={editorRowStyle}>
                      <span className="w-40 text-[#9cdcfe]">QUEUE_LEVEL</span>
                      <span className="text-[#80889a]">=</span>
                      <div className="flex flex-wrap gap-1 leading-none">
                        {difficultyOptions.map((option) => (
                          <label
                            key={option.value}
                            className={`rounded-sm border px-2 py-1 text-xs transition ${
                              difficulty === option.value
                                ? "border-[#4e89ff]/60 bg-[#2b3a52] text-[#dcdcaa]"
                                : "border-zinc-700 bg-[#2b2d30] text-[#9aa5b1] hover:bg-zinc-700/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="difficulty"
                              value={option.value}
                              checked={difficulty === option.value}
                              onChange={() => setDifficulty(option.value)}
                              className="sr-only"
                            />
                            {option.label.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" style={editorRowStyle}>
                      <span className="w-40 text-[#9cdcfe]">QUEUE_PARTY_SIZE</span>
                      <span className="text-[#80889a]">=</span>
                      <span className="inline-flex min-w-8 items-center justify-center rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 text-xs text-[#b5cea8]">
                        4
                      </span>
                    </div>
                    <div className="flex items-start gap-2" style={editorRowStyle}>
                      <span className="w-40 text-[#9cdcfe]">QUEUE_MEMO</span>
                      <span className="pt-1 text-[#80889a]">=</span>
                      <input
                        type="text"
                        value={queueMemo}
                        onChange={(event) => setQueueMemo(event.target.value)}
                        className="mt-0.5 h-7 w-full rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 text-xs text-[#ce9178] outline-none transition focus:border-[#4e89ff]/70"
                      />
                    </div>

                    <div className="mt-2 text-[#6a717d]" style={editorLineStyle}>
                      {modalMode === "SEARCHING" ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleCancelMatch();
                          }}
                          disabled={isBusy}
                          className="rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 py-0.5 text-xs text-zinc-100 transition hover:bg-zinc-700/40 disabled:cursor-not-allowed disabled:text-zinc-500"
                        >
                          stopQueue();
                        </button>
                      ) : null}
                    </div>
                    {error || terminalMessage ? (
                      <div
                        className={`mt-1 rounded-sm border px-3 py-2 text-xs ${
                          error
                            ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                            : "border-zinc-700 bg-[#2b2d30] text-zinc-300"
                        }`}
                      >
                        {error ?? terminalMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="min-h-0 bg-[#2b2d30] md:col-span-2 lg:col-span-1">
            <div className="grid h-full grid-cols-[minmax(0,1fr)_38px]">
              <div className="min-h-0">
                <div className="flex h-12 items-center justify-between border-b border-zinc-800/90 px-4">
                  <p className="text-sm font-semibold text-zinc-200">프로필</p>
                </div>
                <div className="h-full overflow-y-auto p-3 text-xs text-zinc-300">
                  <div className="rounded-md border border-zinc-800/90 bg-[#1f222b] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        계정
                      </p>
                      <StatusPill tone={session.authenticated ? "success" : "warn"}>
                        {session.authenticated ? "로그인됨" : "게스트"}
                      </StatusPill>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-base font-semibold text-zinc-100">
                        {session.member?.nickname ?? "게스트"}
                      </p>
                      <p className="text-zinc-400">
                        {session.authenticated
                          ? formatRoleLabel(session.member?.role)
                          : "로그인이 필요합니다."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-zinc-800/90 bg-[#1f222b] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      전적 요약
                    </p>
                    {session.authenticated ? (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded border border-zinc-700 bg-[#171a22] px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">최근 경기</p>
                            <p className="text-sm font-semibold text-zinc-100">{previewPlayedCount}</p>
                          </div>
                          <div className="rounded border border-zinc-700 bg-[#171a22] px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">클리어</p>
                            <p className="text-sm font-semibold text-zinc-100">{previewSolvedCount}</p>
                          </div>
                          <div className="rounded border border-zinc-700 bg-[#171a22] px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">승률</p>
                            <p className="text-sm font-semibold text-zinc-100">{previewWinRate ?? 0}%</p>
                          </div>
                          <div className="rounded border border-zinc-700 bg-[#171a22] px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">점수 변화</p>
                            <p className="text-sm font-semibold text-zinc-100">{previewScoreDeltaLabel}</p>
                          </div>
                        </div>
                        <p
                          className={`mt-2 text-[11px] ${
                            resultsPreviewError ? "text-rose-300" : "text-zinc-500"
                          }`}
                        >
                          {resultsPreviewError ?? resultsPreviewMessage}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        로그인 후 전적 요약을 확인할 수 있습니다.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 font-sans">
                    {session.authenticated ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleProtectedMove("/mypage")}
                          className="w-full rounded-md border border-zinc-700 bg-[#1e1f22] px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700/30"
                        >
                          내 프로필
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={isBusy}
                          className="w-full rounded-md bg-[#9146ff] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7f39fa] disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
                        >
                          로그아웃
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/signup"
                          className="block w-full rounded-md border border-zinc-700 bg-[#1e1f22] px-3 py-2 text-center text-sm font-medium text-zinc-100 transition hover:bg-zinc-700/30"
                        >
                          회원가입
                        </Link>
                        <Link
                          href="/login?next=/"
                          className="block w-full rounded-md bg-[#9146ff] px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#7f39fa]"
                        >
                          로그인
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col items-center justify-between border-l border-zinc-800/90 bg-[#25272d] py-2">
                <div className="flex flex-col items-center gap-2">
                  {ideDbRailTopItems.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      title={item.title}
                      aria-label={item.title}
                      className={`h-8 w-8 rounded-md border transition ${
                        item.active
                          ? "border-[#2f77ff] bg-[#2f77ff] text-white shadow-[0_0_0_1px_rgba(80,130,255,0.35)]"
                          : "border-transparent text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200"
                      }`}
                    >
                      <span className="flex items-center justify-center">{renderDbRailIcon(item.icon)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                  {ideDbRailBottomItems.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      title={item.title}
                      aria-label={item.title}
                      className="h-8 w-8 rounded-md border border-transparent text-zinc-500 transition hover:bg-zinc-700/30 hover:text-zinc-200"
                    >
                      <span className="flex items-center justify-center">{renderDbRailIcon(item.icon)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

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
