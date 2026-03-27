"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type {
  ApiErrorResponse,
  Difficulty,
  MatchStatusResponse,
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
  difficultyOptions,
  getElapsedSeconds,
  getQueueCategoryLabel,
  queueCategories,
  SEARCH_POLL_INTERVAL_MS,
} from "./data";
import QueueModal from "./queue-modal";

const defaultQueueState: QueueStateResponse = {
  inQueue: false,
  category: null,
  difficulty: null,
  waitingCount: 0,
};

const defaultMatchState: MatchStatusResponse = {
  status: "IDLE",
  roomId: null,
};

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return {
      authenticated: false,
      member: null,
    } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
}

async function readQueueState() {
  const response = await fetch("/api/queue/me", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as QueueStateResponse;
}

async function readMatchState() {
  const response = await fetch("/api/matches/me", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MatchStatusResponse;
}

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [queueState, setQueueState] = useState(defaultQueueState);
  const [matchState, setMatchState] = useState(defaultMatchState);
  const [category, setCategory] = useState<(typeof queueCategories)[number]["value"]>("dp");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [queueStartedAt, setQueueStartedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("메인에서 바로 매칭을 시작하는 구조를 기본값으로 둡니다.");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [isPending, startTransition] = useTransition();

  const redirectingRoomIdRef = useRef<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);

      if (!nextSession.authenticated) {
        setQueueState(defaultQueueState);
        setMatchState(defaultMatchState);
        setQueueStartedAt(null);
        return;
      }

      const [nextQueueState, nextMatchState] = await Promise.all([
        readQueueState(),
        readMatchState(),
      ]);

      const resolvedMatchState = nextMatchState ?? defaultMatchState;
      const resolvedQueueState =
        nextQueueState ??
        (resolvedMatchState.status === "SEARCHING"
          ? {
              ...defaultQueueState,
              inQueue: true,
            }
          : defaultQueueState);

      setQueueState(resolvedQueueState);
      setMatchState(resolvedMatchState);

      if (resolvedMatchState.status === "MATCHED" && resolvedMatchState.roomId !== null) {
        redirectingRoomIdRef.current = resolvedMatchState.roomId;
        setError(null);
        setFeedback(`roomId ${resolvedMatchState.roomId} 배틀룸으로 이동합니다.`);
        router.push(`/battle/rooms/${resolvedMatchState.roomId}`);
        return;
      }

      if (resolvedMatchState.status === "SEARCHING" || resolvedQueueState.inQueue) {
        setQueueStartedAt((current) => current ?? new Date().toISOString());
        setFeedback("플레이어를 찾는 중입니다. /matches/me가 MATCHED를 반환하면 배틀룸으로 이동합니다.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session.authenticated || matchState.status !== "SEARCHING") {
      return;
    }

    let active = true;

    const poll = async () => {
      const nextMatchState = await readMatchState();

      if (!active || !nextMatchState) {
        return;
      }

      if (nextMatchState.status === "MATCHED" && nextMatchState.roomId !== null) {
        setMatchState(nextMatchState);
        redirectingRoomIdRef.current = nextMatchState.roomId;
        setError(null);
        setFeedback(`roomId ${nextMatchState.roomId} 배틀룸으로 이동합니다.`);
        router.push(`/battle/rooms/${nextMatchState.roomId}`);
        return;
      }

      if (nextMatchState.status === "SEARCHING") {
        setMatchState(nextMatchState);

        const nextQueueState = await readQueueState();

        if (!active) {
          return;
        }

        setQueueState(
          nextQueueState ??
            ({
              ...defaultQueueState,
              inQueue: true,
            } satisfies QueueStateResponse),
        );
        setQueueStartedAt((current) => current ?? new Date().toISOString());
        return;
      }

      setMatchState(nextMatchState);
      setQueueState(defaultQueueState);
      setQueueStartedAt(null);
      setFeedback("큐 상태가 종료되었습니다.");
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, SEARCH_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState.status, session.authenticated]);

  function handleProtectedMove(href: string) {
    if (!session.authenticated) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }

    router.push(href);
  }

  function handleStartMatch() {
    if (!session.authenticated) {
      router.push("/login?next=/");
      return;
    }

    if (category === "RANDOM") {
      setError(
        "현재 백엔드 문제 선정은 전체(무작위)를 지원하지 않습니다. 구체 카테고리를 선택해주세요.",
      );
      return;
    }

    if (matchState.status === "SEARCHING") {
      setFeedback("이미 큐가 진행 중입니다.");
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/queue/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category,
            difficulty,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | QueueStatusResponse
          | ApiErrorResponse
          | null;

        if (response.status === 409 && payload && "category" in payload) {
          setQueueState({
            inQueue: true,
            category: payload.category,
            difficulty: payload.difficulty,
            waitingCount: payload.waitingCount,
          });
          setMatchState({
            status: "SEARCHING",
            roomId: null,
          });
          setQueueStartedAt((current) => current ?? new Date().toISOString());
          setFeedback(payload.message);
          return;
        }

        if (!response.ok || !payload || !("category" in payload)) {
          setQueueStartedAt(null);
          setError(payload && "message" in payload ? payload.message : "큐 참가 요청에 실패했습니다.");
          return;
        }

        setQueueState({
          inQueue: true,
          category: payload.category,
          difficulty: payload.difficulty,
          waitingCount: payload.waitingCount,
        });
        setMatchState({
          status: "SEARCHING",
          roomId: null,
        });
        setQueueStartedAt(new Date().toISOString());
        setFeedback(payload.message);

        const nextMatchState = await readMatchState();

        if (nextMatchState?.status === "MATCHED" && nextMatchState.roomId !== null) {
          setMatchState(nextMatchState);
          redirectingRoomIdRef.current = nextMatchState.roomId;
          setError(null);
          setFeedback(`roomId ${nextMatchState.roomId} 배틀룸으로 이동합니다.`);
          router.push(`/battle/rooms/${nextMatchState.roomId}`);
        }
      })();
    });
  }

  function handleCancelMatch() {
    if (matchState.status !== "SEARCHING") {
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/queue/cancel", {
          method: "DELETE",
        });

        const payload = (await response.json().catch(() => null)) as
          | QueueStatusResponse
          | ApiErrorResponse
          | null;

        if (!response.ok) {
          setError(payload && "message" in payload ? payload.message : "큐 취소 요청에 실패했습니다.");
          return;
        }

        setQueueState(defaultQueueState);
        setMatchState(defaultMatchState);
        setQueueStartedAt(null);
        setFeedback(payload && "message" in payload ? payload.message : "큐 취소가 완료되었습니다.");
      })();
    });
  }

  function handleLogout() {
    startTransition(() => {
      void (async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setSession({
          authenticated: false,
          member: null,
        });
        setQueueState(defaultQueueState);
        setMatchState(defaultMatchState);
        setQueueStartedAt(null);
        redirectingRoomIdRef.current = null;
        setFeedback("로그아웃되었습니다.");
        router.refresh();
      })();
    });
  }

  const isSearching = session.authenticated && matchState.status === "SEARCHING";
  const waitingCount = Math.max(queueState.waitingCount, isSearching ? 1 : 0);
  const activeCategoryLabel = getQueueCategoryLabel(queueState.category ?? category);
  const activeDifficultyLabel = queueState.difficulty ?? difficulty;
  const queueElapsedSeconds = getElapsedSeconds(queueStartedAt, now);
  const queueStatusValue = isSearching ? "대기 중" : "대기 전";
  const queueStatusHint = isSearching
    ? `${waitingCount}명 대기`
    : "메인에서 바로 시작";

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Main"
        title="메인에서 큐를 잡고, 매칭 성사 뒤 배틀룸으로 이동"
        description="비로그인 사용자는 서비스 구조를 볼 수 있고, 실제 매칭 시작이나 보호 화면 진입 시 `/login`으로 이동합니다. 로그인 후에는 메인에서 큐 대기, `/matches/me` 폴링, 배틀룸 진입까지 이어집니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인 상태" : "게스트 상태"}
            </StatusPill>
            <StatusPill>4인 매칭</StatusPill>
            <StatusPill>매칭 상태 폴링</StatusPill>
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
                ? `${session.member?.nickname}님, 메인에서 바로 매칭을 시작할 수 있습니다.`
                : "로그인 전에도 메인 구조는 볼 수 있지만, 실제 큐 참가 시 로그인으로 이동합니다."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm">
              <p className="font-medium text-zinc-950">
                {session.member?.nickname ?? "게스트"}
              </p>
              <p className="text-zinc-500">
                {session.member?.role ?? "로그인 필요"} / 티어 API 준비 전
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
                  disabled={isPending}
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
        <MetricCard label="큐 상태" value={queueStatusValue} hint={queueStatusHint} />
        <MetricCard label="매칭 인원" value="4명" hint="현재 MVP는 4인 고정" />
        <MetricCard
          label="카테고리"
          value={activeCategoryLabel}
          hint="같은 조건의 4명이 모이면 즉시 방을 배정합니다."
        />
        <MetricCard
          label="난이도"
          value={activeDifficultyLabel}
          hint="Easy / Medium / Hard"
        />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.3fr_0.85fr]">
        <Panel
          title="사이드 메뉴"
          description="팀이 페이지별로 나눠 작업할 수 있도록 진입점을 분리합니다."
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
          description="메인의 가장 중요한 기능은 카테고리와 난이도를 고르고 큐를 잡는 것입니다."
        >
          <div className="space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">알고리즘 카테고리</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as (typeof queueCategories)[number]["value"])
                }
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
              현재 백엔드 출제기는 실제 태그 카테고리만 지원합니다. `전체(무작위)`는 준비 중으로 둡니다.
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
                onClick={handleStartMatch}
                disabled={isPending || isSearching}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {isSearching ? "큐 진행 중" : isPending ? "처리 중..." : "매칭 시작"}
              </button>
              {isSearching ? (
                <button
                  type="button"
                  onClick={handleCancelMatch}
                  disabled={isPending}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  큐 취소
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
              {error ?? feedback}
            </div>
          </div>
        </Panel>

        <Panel
          title="개인 통계 요약"
          description="메인에서는 보조 정보로만 두고, 실제 통계 API가 생기면 마이페이지와 같이 연결합니다."
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              내 승률: API 준비 전
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              최근 score 추이: API 준비 전
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
              {isSearching
                ? `현재 큐: ${activeCategoryLabel} / ${activeDifficultyLabel} / ${waitingCount}명 대기`
                : `현재 큐: 대기 중 아님`}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="현재 연결 포인트"
        description="메인과 인증 흐름에서 이미 실제 API로 연결된 지점"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <ApiCallout
            method="POST"
            path="/api/auth/login"
            note="프론트 BFF가 백엔드 로그인 응답의 accessToken 쿠키를 프론트 도메인으로 중계한다."
          />
          <ApiCallout
            method="POST"
            path="/api/queue/join"
            note="JWT subject를 userId로 읽어 백엔드 `/api/v1/queue/join`으로 전달한다."
          />
          <ApiCallout
            method="GET"
            path="/api/queue/me"
            note="현재 로그인 사용자의 큐 상태를 메인 진입 시 바로 조회한다."
          />
          <ApiCallout
            method="GET"
            path="/api/matches/me"
            note="매칭 성사 여부와 roomId는 이 API를 폴링해서 확인한다."
          />
        </div>
      </Panel>

      <QueueModal
        isOpen={isSearching}
        categoryLabel={activeCategoryLabel}
        difficultyLabel={activeDifficultyLabel}
        error={error}
        feedback={feedback}
        isPending={isPending}
        queueElapsedSeconds={queueElapsedSeconds}
        waitingCount={waitingCount}
        onCancel={handleCancelMatch}
      />
    </div>
  );
}
