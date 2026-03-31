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
      <section className="overflow-hidden rounded-3xl border border-violet-300/80 bg-white/70 shadow-[0_24px_60px_-40px_rgba(76,29,149,0.3)] md:h-full md:min-h-0">
        <div className="grid gap-4 p-4 md:h-full md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1.45fr)_240px] lg:p-5 xl:grid-cols-[200px_minmax(0,1.65fr)_280px]">
          <aside className="space-y-4 rounded-2xl border border-violet-200 bg-white/80 p-4 text-zinc-900 md:min-h-0 md:overflow-y-auto">
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">빠른 메뉴</p>
              <div className="mt-2 space-y-1.5">
                {dashboardMenus.map((menu) => {
                  const href =
                    menu.requiresAuth && !session.authenticated
                      ? `/login?next=${encodeURIComponent(menu.href)}`
                      : menu.href;

                  return (
                    <Link
                      key={menu.title}
                      href={href}
                      className="block rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-zinc-700 transition hover:border-violet-400 hover:bg-violet-100"
                    >
                      {menu.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="space-y-4 md:min-h-0 md:overflow-y-auto">
            <div className="rounded-2xl border border-violet-200 bg-white/90 p-5 text-zinc-900">
              <div className="mb-5 flex flex-col gap-4 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-700">매칭 제어</p>
                  <h2 className="mt-2 text-xl font-semibold">매칭 설정</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    카테고리와 난이도를 선택한 뒤 큐에 참가합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleStartMatch();
                  }}
                  disabled={isBusy || (modalMode !== null && modalMode !== "TERMINAL")}
                  className="min-h-12 rounded-xl bg-violet-300 px-8 text-base font-semibold text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
                >
                  {modalMode === "SEARCHING"
                    ? "매칭 진행 중"
                    : busyAction === "start"
                      ? "처리 중..."
                      : "매칭 시작"}
                </button>
              </div>

              <div className="space-y-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-700">알고리즘 카테고리</span>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as QueueCategoryValue)}
                      className="w-full appearance-none rounded-xl border border-violet-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
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
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
                      ▾
                    </span>
                  </div>
                </label>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-zinc-700">난이도 선택</legend>
                  <div className="grid gap-3 md:grid-cols-3">
                    {difficultyOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-sm transition ${
                          difficulty === option.value
                            ? "border-violet-300 bg-violet-300 text-zinc-900"
                            : "border-violet-200 bg-white text-zinc-700 hover:border-violet-400 hover:bg-violet-50"
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
                </fieldset>

                <div className="flex flex-wrap gap-3">
                  {modalMode === "SEARCHING" ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleCancelMatch();
                      }}
                      disabled={isBusy}
                      className="rounded-xl border border-violet-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:border-violet-500 hover:bg-violet-50 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                    >
                      매칭 취소
                    </button>
                  ) : null}
                </div>

                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    error
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-violet-200 bg-violet-50/80 text-zinc-700"
                  }`}
                >
                  {error ?? terminalMessage ?? feedback}
                </div>
              </div>
            </div>

          </div>

          <aside className="space-y-4 rounded-2xl border border-violet-200 bg-white/80 p-4 text-zinc-900 md:col-span-2 md:min-h-0 md:overflow-y-auto lg:col-span-1">
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">프로필</p>
                <StatusPill tone={session.authenticated ? "success" : "warn"}>
                  {session.authenticated ? "로그인됨" : "게스트"}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm font-semibold">{session.member?.nickname ?? "게스트"}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatRoleLabel(session.member?.role)}</p>
            </div>

            <div className="grid gap-2">
              {session.authenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleProtectedMove("/mypage")}
                    className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-violet-500 hover:bg-violet-50"
                  >
                    내 프로필
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isBusy}
                    className="rounded-xl bg-violet-300 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-900 transition hover:border-violet-500 hover:bg-violet-50"
                  >
                    회원가입
                  </Link>
                  <Link
                    href="/login?next=/"
                    className="rounded-xl bg-violet-300 px-3 py-2 text-center text-sm font-semibold text-zinc-900 transition hover:bg-violet-200"
                  >
                    로그인
                  </Link>
                </>
              )}
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">전적 미리보기</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-700">
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
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  resultsPreviewError
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-violet-200 bg-white text-zinc-600"
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
