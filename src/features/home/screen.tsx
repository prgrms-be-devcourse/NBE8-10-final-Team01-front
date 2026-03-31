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
  dashboardMenus,
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
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [pollStage, setPollStage] = useState<PollStage>("IDLE");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [now, setNow] = useState(Date.now());
  const [recentResults, setRecentResults] = useState<MyBattleResultItem[]>([]);
  const [resultsPreviewMessage, setResultsPreviewMessage] = useState("로그인 후 최근 전적을 확인할 수 있습니다.");
  const [resultsPreviewError, setResultsPreviewError] = useState<string | null>(null);

  const joiningRoomIdRef = useRef<number | null>(null);

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
  const roomId = matchState.room?.roomId ?? null;
  const previewPlayedCount = recentResults.length;
  const previewSolvedCount = recentResults.filter((item) => item.solved).length;
  const previewWinRate =
    previewPlayedCount > 0 ? Math.round((previewSolvedCount / previewPlayedCount) * 100) : null;
  const previewScoreDelta = recentResults.reduce((acc, item) => acc + item.scoreDelta, 0);

  return (
    <div className="md:h-[calc(100dvh-7.5rem)] md:overflow-hidden">
      <section className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-[linear-gradient(180deg,#20232b_0%,#1b1d25_100%)] shadow-[0_34px_82px_-42px_rgba(0,0,0,0.92),0_12px_24px_-16px_rgba(0,0,0,0.78)] md:h-full md:min-h-0">
        <div className="grid gap-4 p-4 md:h-full md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1.55fr)_280px] lg:p-5 xl:grid-cols-[230px_minmax(0,1.7fr)_300px]">
          <aside className="space-y-4 rounded-xl border border-zinc-700 bg-[#1f222a] p-4 text-zinc-100 md:min-h-0 md:overflow-y-auto">
            <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-400">Project</p>
                <span className="font-mono text-xs text-zinc-500">▼</span>
              </div>
              <div className="mt-3 space-y-1 font-mono text-xs text-zinc-300">
                <p className="flex items-center gap-2 px-2 py-1 text-zinc-200">
                  <span className="text-zinc-500">▾</span>
                  <span>BRACKET [front]</span>
                </p>
                {dashboardMenus.map((menu, index) => {
                  const href =
                    menu.requiresAuth && !session.authenticated
                      ? `/login?next=${encodeURIComponent(menu.href)}`
                      : menu.href;
                  const branchGlyph = index === dashboardMenus.length - 1 ? "└─" : "├─";

                  return (
                    <Link
                      key={menu.title}
                      href={href}
                      className="ml-4 flex items-center gap-2 rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5 text-zinc-200 transition hover:border-sky-400/45 hover:bg-sky-500/10"
                    >
                      <span className="text-zinc-500">{branchGlyph}</span>
                      <span>{menu.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] p-3">
              <p className="text-xs font-semibold text-zinc-400">Open Files</p>
              <div className="mt-2 space-y-1 font-mono text-xs text-zinc-300">
                <p className="rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">MatchControl.tsx</p>
                <p className="rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">QueueState.json</p>
                <p className="rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">ProfilePreview.sql</p>
              </div>
            </div>
          </aside>

          <div className="space-y-4 md:min-h-0 md:overflow-y-auto">
            <div className="overflow-hidden rounded-xl border border-zinc-700 bg-[#1f222a] text-zinc-100">
              <div className="flex items-center justify-between border-b border-zinc-700 bg-[#1a1d24] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-400" />
                  <span className="size-2 rounded-full bg-amber-400" />
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <p className="ml-2 font-mono text-xs text-zinc-300">MatchControl.tsx</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleStartMatch();
                  }}
                  disabled={isBusy || (modalMode !== null && modalMode !== "TERMINAL")}
                  className="rounded-lg border border-sky-300/40 bg-sky-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-600 disabled:text-zinc-300"
                >
                  {modalMode === "SEARCHING"
                    ? "매칭 진행 중"
                    : busyAction === "start"
                      ? "처리 중..."
                      : "매칭 시작"}
                </button>
              </div>

              <div className="space-y-3 p-4">
                <div className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-start gap-3">
                  <span className="font-mono text-xs text-zinc-500">1</span>
                  <p className="font-mono text-sm text-zinc-400">// queue options</p>
                </div>

                <label className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500">2</span>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                    <span className="text-sky-300">const</span>
                    <span className="text-zinc-200">category =</span>
                    <div className="relative min-w-[14rem] flex-1">
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value as QueueCategoryValue)}
                        className="w-full appearance-none rounded-md border border-zinc-700 bg-[#22262e] px-3 py-2 pr-8 text-sm text-zinc-100 outline-none transition focus:border-sky-400/55"
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
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-400">
                        ▾
                      </span>
                    </div>
                    <span className="text-zinc-500">;</span>
                  </div>
                </label>

                <div className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-start gap-3">
                  <span className="font-mono text-xs text-zinc-500">3</span>
                  <div className="space-y-2">
                    <p className="font-mono text-sm">
                      <span className="text-sky-300">const</span>{" "}
                      <span className="text-zinc-200">difficulty =</span>
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {difficultyOptions.map((option) => (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition ${
                            difficulty === option.value
                              ? "border-sky-300/40 bg-sky-500 text-zinc-950"
                              : "border-zinc-700 bg-[#22262e] text-zinc-100 hover:border-sky-400/45 hover:bg-sky-500/10"
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
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500">4</span>
                  {modalMode === "SEARCHING" ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleCancelMatch();
                      }}
                      disabled={isBusy}
                      className="w-fit rounded-md border border-zinc-700 bg-[#22262e] px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-sky-400/45 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      매칭 취소
                    </button>
                  ) : (
                    <p className="font-mono text-sm text-zinc-500">/* cancel disabled */</p>
                  )}
                </div>

                <div className="grid grid-cols-[1.6rem_minmax(0,1fr)] items-start gap-3">
                  <span className="font-mono text-xs text-zinc-500">5</span>
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      error
                        ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                        : "border-zinc-700 bg-[#1a1d24] text-zinc-200"
                    }`}
                  >
                    {error ?? terminalMessage ?? feedback}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border border-zinc-700 bg-[#1f222a] p-4 text-zinc-100 md:col-span-2 md:min-h-0 md:overflow-y-auto lg:col-span-1">
            <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] p-3">
              <p className="text-xs font-semibold text-zinc-400">Database</p>
              <div className="mt-2 space-y-1 font-mono text-xs text-zinc-300">
                <p className="px-1 text-zinc-400">▾ back@localhost</p>
                <p className="pl-4 text-zinc-400">▾ schemas</p>
                <p className="pl-7 text-zinc-400">▾ public</p>
                <p className="rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5 pl-10">▾ members</p>
                <p className="pl-14 text-zinc-500">member_id</p>
                <p className="pl-14 text-zinc-500">email</p>
                <p className="pl-14 text-zinc-500">nickname</p>
                <p className="pl-14 text-zinc-500">role</p>
                <p className="pl-14 text-zinc-500">score</p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] p-3">
              <p className="font-mono text-xs text-zinc-400">members.selected_row</p>
              <dl className="mt-2 space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">
                  <dt className="font-mono text-zinc-500">member_id</dt>
                  <dd className="font-mono text-zinc-200">{session.member?.memberId ?? "NULL"}</dd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">
                  <dt className="font-mono text-zinc-500">nickname</dt>
                  <dd className="font-mono text-zinc-200">{session.member?.nickname ?? "guest"}</dd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">
                  <dt className="font-mono text-zinc-500">role</dt>
                  <dd className="font-mono text-zinc-200">{formatRoleLabel(session.member?.role)}</dd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-[#22262e] px-2 py-1.5">
                  <dt className="font-mono text-zinc-500">recent_win_rate</dt>
                  <dd className="font-mono text-zinc-200">{session.authenticated ? `${previewWinRate ?? 0}%` : "NULL"}</dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-2">
              {session.authenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleProtectedMove("/mypage")}
                    className="rounded-lg border border-zinc-700 bg-[#22262e] px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-sky-400/45 hover:bg-sky-500/10"
                  >
                    내 프로필
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isBusy}
                    className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-lg border border-zinc-700 bg-[#22262e] px-3 py-2 text-center text-sm font-medium text-zinc-100 transition hover:border-sky-400/45 hover:bg-sky-500/10"
                  >
                    회원가입
                  </Link>
                  <Link
                    href="/login?next=/"
                    className="rounded-lg bg-sky-500 px-3 py-2 text-center text-sm font-semibold text-zinc-950 transition hover:bg-sky-400"
                  >
                    로그인
                  </Link>
                </>
              )}
            </div>

            <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] p-3">
              <p className="font-mono text-xs text-zinc-400">query_preview</p>
              <div className="mt-2 space-y-1 text-sm text-zinc-200">
                {session.authenticated ? (
                  <>
                    <p>최근 {previewPlayedCount}전 승률: {previewWinRate ?? 0}%</p>
                    <p>최근 정답 수: {previewSolvedCount}</p>
                    <p>
                      최근 점수 변화 합계: {previewScoreDelta > 0 ? "+" : ""}
                      {previewScoreDelta}
                    </p>
                  </>
                ) : (
                  <p>로그인 후 전적 미리보기를 확인할 수 있습니다.</p>
                )}
              </div>
              <div
                className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                  resultsPreviewError
                    ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                    : "border-zinc-700 bg-[#22262e] text-zinc-300"
                }`}
              >
                {resultsPreviewError ?? resultsPreviewMessage}
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
