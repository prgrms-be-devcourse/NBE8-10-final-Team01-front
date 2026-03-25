"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type {
  ApiErrorResponse,
  Difficulty,
  QueueStateResponse,
  QueueStatusResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import { ApiCallout, MetricCard, MetricGrid, PageHero, Panel, StatusPill } from "@/shared/ui";

import {
  acceptMatchTicket,
  createMatchTicket,
  dashboardMenus,
  difficultyOptions,
  getCountdownSeconds,
  getElapsedSeconds,
  getQueueCategoryLabel,
  queueCategories,
  READY_CHECK_CHANNEL,
  type MatchTicketState,
  type ReadyCheckMessage,
} from "./data";
import QueueModal from "./queue-modal";

const defaultQueueState: QueueStateResponse = {
  inQueue: false,
  category: null,
  difficulty: null,
  waitingCount: 0,
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
    return defaultQueueState;
  }

  return (await response.json()) as QueueStateResponse;
}

function broadcastReadyCheckMessage(message: ReadyCheckMessage) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return;
  }

  const channel = new BroadcastChannel(READY_CHECK_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [queueState, setQueueState] = useState(defaultQueueState);
  const [category, setCategory] = useState<(typeof queueCategories)[number]["value"]>("dp");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [queueStartedAt, setQueueStartedAt] = useState<string | null>(null);
  const [matchTicket, setMatchTicket] = useState<MatchTicketState | null>(null);
  const [feedback, setFeedback] = useState("메인에서 바로 매칭을 시작하는 구조를 기본값으로 둡니다.");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [isPending, startTransition] = useTransition();

  const sessionRef = useRef(session);
  const queueStateRef = useRef(queueState);
  const matchTicketRef = useRef(matchTicket);
  const suppressQueueDropNoticeRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    queueStateRef.current = queueState;
  }, [queueState]);

  useEffect(() => {
    matchTicketRef.current = matchTicket;
  }, [matchTicket]);

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

      if (nextSession.authenticated) {
        const nextQueueState = await readQueueState();
        setQueueState(nextQueueState);

        if (nextQueueState.inQueue) {
          setQueueStartedAt(new Date().toISOString());
        }

        if (nextQueueState.inQueue && nextQueueState.category === "RANDOM") {
          setError(
            "이전 요청으로 전체(무작위) 큐에 들어가 있습니다. 큐를 취소한 뒤 구체 카테고리로 다시 시작해주세요.",
          );
        }

        if (nextQueueState.inQueue && nextQueueState.category === "GRAPH") {
          setError(
            "이전 요청으로 GRAPH 큐에 들어가 있습니다. 큐를 취소한 뒤 새 그래프 카테고리로 다시 시작해주세요.",
          );
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(READY_CHECK_CHANNEL);

    const handleMessage = (event: MessageEvent<ReadyCheckMessage>) => {
      const message = event.data;
      const currentSession = sessionRef.current;
      const currentQueueState = queueStateRef.current;
      const currentTicket = matchTicketRef.current;

      if (!currentSession.member) {
        return;
      }

      if (message.type === "MATCH_FOUND") {
        if (currentTicket?.ticketId === message.ticket.ticketId) {
          return;
        }

        const isSameQueue =
          currentQueueState.inQueue &&
          currentQueueState.category === message.ticket.category &&
          currentQueueState.difficulty === message.ticket.difficulty;

        if (!isSameQueue) {
          return;
        }

        suppressQueueDropNoticeRef.current = true;
        setQueueState(defaultQueueState);
        setMatchTicket(message.ticket);
        setError(null);
        setFeedback("매칭이 성사됐습니다. 15초 안에 준비 완료를 눌러주세요.");
        return;
      }

      if (!currentTicket || currentTicket.ticketId !== message.ticketId) {
        return;
      }

      if (message.type === "ACCEPTED") {
        const nextTicket = {
          ...currentTicket,
          acceptedMemberIds: message.acceptedMemberIds,
          status:
            message.acceptedMemberIds.length >= message.maxPlayers
              ? "READY_TO_ENTER"
              : "ACCEPTED",
        } satisfies MatchTicketState;

        setMatchTicket(nextTicket);
        setError(null);
        setFeedback(
          nextTicket.status === "READY_TO_ENTER"
            ? "전원 수락 완료. 배틀룸으로 이동합니다."
            : `${message.acceptedMemberIds.length}/${message.maxPlayers}명이 준비 완료했습니다.`,
        );
        return;
      }

      if (message.type === "DECLINED") {
        const selfMemberId = currentSession.member.memberId;
        const selfAccepted = currentTicket.acceptedMemberIds.includes(selfMemberId);
        const selfDeclined = message.memberId === selfMemberId;

        setMatchTicket(null);
        setError(null);

        if (selfDeclined || !selfAccepted) {
          setQueueState(defaultQueueState);
          setQueueStartedAt(null);
          setFeedback("수락을 완료하지 않아 큐에서 제외되었습니다.");
          return;
        }

        // TODO(front-backend): 서버에서 ready-check 실패 후 남은 인원을 다시 큐에 넣고 waitingCount를 내려줘야 한다.
        setQueueState({
          inQueue: true,
          category: currentTicket.category,
          difficulty: currentTicket.difficulty,
          waitingCount: message.acceptedMemberIds.length,
        });
        setQueueStartedAt(new Date().toISOString());
        setFeedback("한 명이 수락하지 않아 남은 인원으로 다시 큐를 찾습니다.");
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  useEffect(() => {
    if (!session.authenticated || !queueState.inQueue || matchTicket) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        const nextQueueState = await readQueueState();

        if (!nextQueueState.inQueue) {
          if (suppressQueueDropNoticeRef.current) {
            suppressQueueDropNoticeRef.current = false;
          } else {
            setError(
              "큐는 종료됐지만 ready-check 정보는 아직 프론트 브로드캐스트 임시 구조에 의존합니다. 백엔드에 내 매칭 방 조회 API가 붙으면 이 경로는 교체됩니다.",
            );
            setFeedback("큐 상태가 종료되었습니다.");
          }
        }

        setQueueState(nextQueueState);
      })();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [matchTicket, queueState.inQueue, session.authenticated]);

  useEffect(() => {
    if (!matchTicket || matchTicket.status === "READY_TO_ENTER") {
      return;
    }

    const remainingSeconds = getCountdownSeconds(matchTicket.deadlineAt, now);

    if (remainingSeconds > 0 || !session.member) {
      return;
    }

    const memberId = session.member.memberId;

    const timeoutId = window.setTimeout(() => {
      const selfAccepted = matchTicket.acceptedMemberIds.includes(memberId);

      setMatchTicket(null);
      setError(null);

      if (selfAccepted) {
        // TODO(front-backend): 수락 제한 시간이 지나면 서버가 남은 인원을 다시 큐에 올리고 새 ticket을 만들어줘야 한다.
        setQueueState({
          inQueue: true,
          category: matchTicket.category,
          difficulty: matchTicket.difficulty,
          waitingCount: matchTicket.acceptedMemberIds.length,
        });
        setQueueStartedAt(new Date().toISOString());
        setFeedback("한 명이 확인하지 않아 남은 인원으로 다시 큐를 찾습니다.");
        return;
      }

      setQueueState(defaultQueueState);
      setQueueStartedAt(null);
      setFeedback("수락 시간이 지나 큐에서 제외되었습니다.");
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [matchTicket, now, session.member]);

  useEffect(() => {
    if (
      !matchTicket ||
      matchTicket.status !== "READY_TO_ENTER" ||
      !session.member ||
      !matchTicket.acceptedMemberIds.includes(session.member.memberId)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(`roomId ${matchTicket.roomId} 배틀룸으로 이동합니다.`);
      setMatchTicket(null);
      setQueueStartedAt(null);
      router.push(`/battle/rooms/${matchTicket.roomId}`);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [matchTicket, router, session.member]);

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

    if (queueState.inQueue || matchTicket) {
      setFeedback("이미 큐 또는 수락 모달이 진행 중입니다.");
      return;
    }

    setError(null);
    setQueueStartedAt(new Date().toISOString());

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

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setQueueStartedAt(null);
          setError(payload?.message ?? "큐 참가 요청에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as QueueStatusResponse;
        setFeedback(payload.message);

        if (payload.matchedRoomId) {
          const nextTicket = createMatchTicket({
            roomId: payload.matchedRoomId,
            category: payload.category,
            difficulty: payload.difficulty,
          });

          suppressQueueDropNoticeRef.current = true;
          setQueueState(defaultQueueState);
          setMatchTicket(nextTicket);
          setFeedback("매칭이 성사됐습니다. 15초 안에 준비 완료를 눌러주세요.");

          // TODO(front-backend): /api/matchmaking/me 또는 내 매칭 방 조회 API가 생기면 이 브로드캐스트 임시 동기화를 제거한다.
          broadcastReadyCheckMessage({
            type: "MATCH_FOUND",
            ticket: nextTicket,
          });
          return;
        }

        setQueueState({
          inQueue: true,
          category: payload.category,
          difficulty: payload.difficulty,
          waitingCount: payload.waitingCount,
        });
      })();
    });
  }

  function handleCancelMatch() {
    setError(null);
    suppressQueueDropNoticeRef.current = true;

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/queue/cancel", {
          method: "DELETE",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setError(payload?.message ?? "큐 취소 요청에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as QueueStatusResponse;
        setFeedback(payload.message);
        setQueueState(defaultQueueState);
        setQueueStartedAt(null);
      })();
    });
  }

  function handleAcceptMatch() {
    if (!matchTicket || !session.member) {
      return;
    }

    const nextTicket = acceptMatchTicket(matchTicket, session.member.memberId);
    setMatchTicket(nextTicket);
    setError(null);
    setFeedback(
      nextTicket.status === "READY_TO_ENTER"
        ? "전원 수락 완료. 배틀룸으로 이동합니다."
        : `${nextTicket.acceptedMemberIds.length}/${nextTicket.maxPlayers}명이 준비 완료했습니다.`,
    );

    // TODO(front-backend): POST /api/matchmaking/{ticketId}/accept 응답으로 acceptedCount, deadlineAt, roomId를 받아야 한다.
    broadcastReadyCheckMessage({
      type: "ACCEPTED",
      ticketId: nextTicket.ticketId,
      roomId: nextTicket.roomId,
      memberId: session.member.memberId,
      acceptedMemberIds: nextTicket.acceptedMemberIds,
      maxPlayers: nextTicket.maxPlayers,
    });
  }

  function handleDeclineMatch() {
    if (!matchTicket || !session.member) {
      return;
    }

    setMatchTicket(null);
    setQueueState(defaultQueueState);
    setQueueStartedAt(null);
    setError(null);
    setFeedback("수락을 거절해 큐에서 제외되었습니다.");

    // TODO(front-backend): POST /api/matchmaking/{ticketId}/decline 후 서버가 남은 인원을 다시 큐에 넣어야 한다.
    broadcastReadyCheckMessage({
      type: "DECLINED",
      ticketId: matchTicket.ticketId,
      memberId: session.member.memberId,
      acceptedMemberIds: matchTicket.acceptedMemberIds.filter(
        (memberId) => memberId !== session.member?.memberId,
      ),
    });
  }

  function handleLogout() {
    suppressQueueDropNoticeRef.current = true;

    startTransition(() => {
      void (async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setSession({
          authenticated: false,
          member: null,
        });
        setQueueState(defaultQueueState);
        setQueueStartedAt(null);
        setMatchTicket(null);
        setFeedback("로그아웃되었습니다.");
        router.refresh();
      })();
    });
  }

  const activeCategoryLabel = getQueueCategoryLabel(
    matchTicket?.category ?? queueState.category ?? category,
  );
  const activeDifficultyLabel = matchTicket?.difficulty ?? queueState.difficulty ?? difficulty;
  const hasAccepted = Boolean(
    matchTicket && session.member && matchTicket.acceptedMemberIds.includes(session.member.memberId),
  );
  const queueElapsedSeconds = getElapsedSeconds(queueStartedAt, now);
  const readyCountdownSeconds = matchTicket ? getCountdownSeconds(matchTicket.deadlineAt, now) : 0;
  const queueStatusValue = matchTicket
    ? matchTicket.status === "READY_TO_ENTER"
      ? "입장 준비 완료"
      : "수락 확인 중"
    : queueState.inQueue
      ? "대기 중"
      : "대기 전";
  const queueStatusHint = matchTicket
    ? `${matchTicket.acceptedMemberIds.length}/${matchTicket.maxPlayers} 수락`
    : queueState.inQueue
      ? `${queueState.waitingCount}명 대기`
      : "메인에서 바로 시작";

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Main"
        title="메인에서 큐를 잡고, 수락 확인 뒤 배틀룸으로 이동"
        description="비로그인 사용자는 서비스 구조를 볼 수 있고, 실제 매칭 시작이나 보호 화면 진입 시 `/login`으로 이동합니다. 로그인 후에는 메인에서 큐 대기, 수락 모달, 배틀룸 진입까지 이어집니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인 상태" : "게스트 상태"}
            </StatusPill>
            <StatusPill>4 player queue</StatusPill>
            <StatusPill>Ready check</StatusPill>
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
          hint="같은 조건의 4명이 모이면 수락 모달 표시"
        />
        <MetricCard
          label="난이도"
          value={activeDifficultyLabel}
          hint="Easy / Medium / Hard"
        />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.3fr_0.85fr]">
        <Panel title="사이드 메뉴" description="팀이 페이지별로 나눠 작업할 수 있도록 진입점을 분리합니다.">
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

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={handleStartMatch}
                disabled={isPending || queueState.inQueue || matchTicket !== null}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {isPending ? "처리 중..." : queueState.inQueue || matchTicket ? "큐 진행 중" : "매칭 시작"}
              </button>
              <button
                type="button"
                onClick={handleCancelMatch}
                disabled={isPending || !queueState.inQueue}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                큐 취소
              </button>
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
              {matchTicket
                ? `현재 상태: ${matchTicket.acceptedMemberIds.length}/${matchTicket.maxPlayers} 수락 / ${activeCategoryLabel} / ${activeDifficultyLabel}`
                : `현재 큐: ${
                    queueState.inQueue
                      ? `${getQueueCategoryLabel(queueState.category)} / ${queueState.difficulty} / ${queueState.waitingCount}명 대기`
                      : "대기 중 아님"
                  }`}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="현재 연결 포인트"
        description="메인과 인증 흐름에서 이미 실제 API로 연결된 지점"
      >
        <div className="grid gap-4 lg:grid-cols-3">
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
        </div>
      </Panel>

      <QueueModal
        categoryLabel={activeCategoryLabel}
        difficultyLabel={activeDifficultyLabel}
        error={error}
        feedback={feedback}
        hasAccepted={hasAccepted}
        isPending={isPending}
        queueElapsedSeconds={queueElapsedSeconds}
        queueState={queueState}
        readyCountdownSeconds={readyCountdownSeconds}
        ticket={matchTicket}
        onAccept={handleAcceptMatch}
        onCancel={handleCancelMatch}
        onDecline={handleDeclineMatch}
      />
    </div>
  );
}
