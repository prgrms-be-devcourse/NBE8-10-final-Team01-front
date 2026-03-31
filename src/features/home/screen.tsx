"use client";

import Link from "next/link";
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
  ApiCallout,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

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
  const acceptedCount = matchState.readyCheck?.acceptedCount ?? 0;
  const roomId = matchState.room?.roomId ?? null;

  const flowStatusValue =
    modalMode === "SEARCHING"
      ? "대기 중"
      : modalMode === "READY_CHECK"
        ? "수락 대기"
        : modalMode === "ROOM_READY"
          ? "방 준비 완료"
          : modalMode === "TERMINAL"
            ? "종료 안내"
            : "대기 없음";

  const flowStatusHint =
    modalMode === "SEARCHING"
      ? `${waitingCount} / ${requiredCount}명 대기`
      : modalMode === "READY_CHECK"
        ? `${acceptedCount} / ${requiredCount}명 수락`
        : modalMode === "ROOM_READY"
          ? roomId !== null
            ? `roomId ${roomId}`
            : "roomId 확인 중"
          : modalMode === "TERMINAL"
            ? "종료 후 로컬 상태 초기화"
            : "메인에서 바로 시작";

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Main"
        title="프로필을 보고, ready-check까지 이어지는 메인 홈"
        description="메인 홈에서 category와 difficulty를 고른 뒤 매칭을 시작합니다. v2 흐름에서는 먼저 queue/me를 polling하고, 큐에서 빠진 뒤에는 matches/me로 전환해 수락 여부와 room 준비 상태를 확인합니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인 상태" : "게스트 상태"}
            </StatusPill>
            <StatusPill>ready-check v2</StatusPill>
            <StatusPill>HTTP polling</StatusPill>
          </>
        }
      />

      <div className="rounded-3xl border border-zinc-300 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-zinc-500">상단바</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
              Algo Battle
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {session.authenticated
                ? `${session.member?.nickname}님은 메인 홈에서 바로 매칭을 시작할 수 있습니다.`
                : "비로그인 상태에서는 메인 구조만 볼 수 있고, 실제 매칭 시작 시 로그인으로 이동합니다."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm">
              <p className="font-medium text-zinc-950">
                {session.member?.nickname ?? "게스트"}
              </p>
              <p className="text-zinc-500">
                {session.member?.role ?? "로그인 필요"} / 전적 API 연동 중
              </p>
            </div>
            {session.authenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => handleProtectedMove("/mypage")}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
                >
                  내 프로필
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isBusy}
                  className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
                >
                  회원가입
                </Link>
                <Link
                  href="/login?next=/"
                  className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
                >
                  로그인
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <MetricGrid>
        <MetricCard label="현재 상태" value={flowStatusValue} hint={flowStatusHint} />
        <MetricCard
          label="매칭 인원"
          value={`${requiredCount}명`}
          hint="현재 MVP는 4인 ready-check 기준"
        />
        <MetricCard
          label="카테고리"
          value={activeCategoryLabel}
          hint="큐 대기 중에는 queue/me 기준으로 표시합니다."
        />
        <MetricCard
          label="난이도"
          value={activeDifficultyLabel}
          hint="Easy / Medium / Hard"
        />
      </MetricGrid>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.85fr_1.3fr_0.85fr]">
        <Panel
          title="서비스 메뉴"
          description="주요 페이지별 작업 동선을 한곳에서 바로 열 수 있도록 진입점을 둡니다."
        >
          <div className="space-y-3">
            {dashboardMenus.map((menu) => {
              const href =
                menu.requiresAuth && !session.authenticated
                  ? `/login?next=${encodeURIComponent(menu.href)}`
                  : menu.href;

              return (
                <Link
                  key={menu.title}
                  href={href}
                  className="block rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 transition hover:border-zinc-500"
                >
                  <p className="font-medium text-zinc-950">{menu.title}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {menu.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="매칭 설정 영역"
          description="메인 홈의 가장 중요한 기능은 카테고리와 난이도를 고른 뒤 바로 매칭을 시작하는 것입니다."
        >
          <div className="space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">알고리즘 카테고리</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as QueueCategoryValue)}
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
              >
                {queueCategories.map((item) => (
                  <option key={item.value} value={item.value} disabled={item.disabled}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm leading-6 text-zinc-500">
              현재는 실제 출제 가능한 카테고리만 사용하고, 전체(무작위)는 준비 중으로 둡니다.
            </p>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-zinc-700">난이도 선택</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {difficultyOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                      difficulty === option.value
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-300 bg-zinc-50 text-zinc-900"
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
              <button
                type="button"
                onClick={() => {
                  void handleStartMatch();
                }}
                disabled={isBusy || (modalMode !== null && modalMode !== "TERMINAL")}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {modalMode === "SEARCHING"
                  ? "매칭 진행 중"
                  : busyAction === "start"
                    ? "처리 중..."
                    : "매칭 시작"}
              </button>
              {modalMode === "SEARCHING" ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCancelMatch();
                  }}
                  disabled={isBusy}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  매칭 취소
                </button>
              ) : null}
            </div>

            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-zinc-300 bg-zinc-50 text-zinc-700"
              }`}
            >
              {error ?? terminalMessage ?? feedback}
            </div>
          </div>
        </Panel>

        <Panel
          title="개인 통계 요약"
          description="메인에서는 보조 정보만 보여주고, 실제 전적과 점수 API는 마이페이지에서 더 자세히 확인합니다."
          className="lg:col-span-2 xl:col-span-1"
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              티어/총점: API 연결 전
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              현재 단계: {flowStatusValue}
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              {modalMode === "SEARCHING"
                ? `현재 큐: ${activeCategoryLabel} / ${activeDifficultyLabel} / ${waitingCount}명 대기`
                : modalMode === "READY_CHECK"
                  ? `ready-check: ${acceptedCount} / ${requiredCount}명 수락`
                  : modalMode === "ROOM_READY"
                    ? `방 입장 준비: roomId ${roomId ?? "확인 중"}`
                    : "현재는 대기 중이 아닙니다."}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="현재 연결 사인"
        description="메인과 인접한 흐름에서 이번 단계에 실제로 붙여 둔 API 경로들입니다."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ApiCallout
            method="POST"
            path="/api/queue/join"
            note="큐 참가 후에는 응답 메시지를 고정 상태로 쓰지 않고, queue/me polling으로 실제 대기 상태를 그립니다."
          />
          <ApiCallout
            method="GET"
            path="/api/queue/me"
            note="SEARCHING 단계 전용입니다. waitingCount와 requiredCount를 이용해 1/4, 2/4 같은 대기 UI를 만듭니다."
          />
          <ApiCallout
            method="GET"
            path="/api/matches/me"
            note="queue/me에서 inQueue=false가 되면 이쪽으로 전환해 ready-check, room 준비, 종료 상태를 확인합니다."
          />
          <ApiCallout
            method="POST"
            path="/api/matches/[matchId]/accept"
            note="내 decision을 ACCEPTED로 바꾸고, 마지막 수락이면 ROOM_READY까지 이어집니다."
          />
          <ApiCallout
            method="POST"
            path="/api/matches/[matchId]/decline"
            note="한 명이라도 거절하면 세션 전체가 CANCELLED로 바뀌고 종료 안내를 보여줍니다."
          />
          <ApiCallout
            method="POST"
            path="/api/battle/rooms/{roomId}/join"
            note="ROOM_READY가 되면 기존 battle room join API를 재사용해서 실제 방으로 입장합니다."
          />
        </div>
      </Panel>

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
