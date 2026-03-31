"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  MyBattleResultItem,
  MyBattleResultsResponse,
  PageInfo,
  SessionResponse,
} from "@/shared/api/contracts";
import {
  EmptyPanel,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date-time";
import { formatRoleLabel } from "@/shared/utils/format-role-label";

const PAGE_SIZE = 20;

const defaultPageInfo: PageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
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

async function readMyBattleResults(page: number, size: number) {
  const response = await fetch(`/api/members/me/battle-results?page=${page}&size=${size}`, {
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

function formatRank(rank: number) {
  return `${rank}등`;
}

function formatScoreDelta(scoreDelta: number) {
  const sign = scoreDelta > 0 ? "+" : "";
  return `${sign}${scoreDelta}`;
}

function ScoreDeltaText({ scoreDelta }: { scoreDelta: number }) {
  const toneClass =
    scoreDelta > 0
      ? "text-emerald-700"
      : scoreDelta < 0
        ? "text-rose-700"
        : "text-zinc-600";

  return <span className={`font-semibold ${toneClass}`}>{formatScoreDelta(scoreDelta)}</span>;
}

function ResultCard({ item }: { item: MyBattleResultItem }) {
  return (
    <Link
      href={`/battle/results/${item.roomId}`}
      className="block rounded-2xl border border-zinc-300 bg-zinc-50 p-5 transition hover:border-zinc-500 hover:bg-white"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            roomId {item.roomId} · problemId {item.problemId}
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
            {item.problemTitle}
          </h3>
          <p className="text-sm text-zinc-600">{formatDateTime(item.playedAt)} 플레이</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={item.solved ? "success" : "warn"}>
            {item.solved ? "성공" : "미해결"}
          </StatusPill>
          <StatusPill tone={item.finalRank === 1 ? "success" : "default"}>
            {formatRank(item.finalRank)}
          </StatusPill>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            최종 순위
          </p>
          <p className="mt-2 text-base font-semibold text-zinc-950">{formatRank(item.finalRank)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            점수 변화
          </p>
          <p className="mt-2 text-base">
            <ScoreDeltaText scoreDelta={item.scoreDelta} />
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            정답 처리 시각
          </p>
          <p className="mt-2 text-base font-medium text-zinc-950">
            {item.finishTime ? formatDateTime(item.finishTime) : "기록 없음"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-zinc-300 bg-zinc-50 p-5"
        >
          <div className="h-3 w-32 rounded bg-zinc-200" />
          <div className="mt-4 h-6 w-2/3 rounded bg-zinc-200" />
          <div className="mt-3 h-4 w-40 rounded bg-zinc-200" />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="h-20 rounded-2xl bg-white" />
            <div className="h-20 rounded-2xl bg-white" />
            <div className="h-20 rounded-2xl bg-white" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyPageScreen() {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [battleResults, setBattleResults] = useState<MyBattleResultItem[]>([]);
  const [pageInfo, setPageInfo] = useState(defaultPageInfo);
  const [message, setMessage] = useState("내 전적을 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const nextSession = await readSession();

      if (!active) {
        return;
      }

      setSession(nextSession);

      if (!nextSession.authenticated) {
        setIsLoading(false);
        setMessage("로그인 후 내 전적을 확인할 수 있습니다.");
        return;
      }

      const { ok, status, payload } = await readMyBattleResults(0, PAGE_SIZE);

      if (!active) {
        return;
      }

      if (status === 401 || payload?.resultCode === "MEMBER_401") {
        setSession({
          authenticated: false,
          member: null,
        });
        setBattleResults([]);
        setPageInfo(defaultPageInfo);
        setError(null);
        setMessage(payload?.msg ?? "로그인이 필요합니다.");
        setIsLoading(false);
        return;
      }

      if (!ok || !payload || payload.resultCode !== "200" || !payload.data) {
        setBattleResults([]);
        setPageInfo(defaultPageInfo);
        setError(payload?.msg ?? "내 전적을 불러오지 못했습니다.");
        setMessage(payload?.msg ?? "내 전적 조회에 실패했습니다.");
        setIsLoading(false);
        return;
      }

      setBattleResults(payload.data.battleResults);
      setPageInfo(payload.data.pageInfo);
      setMessage(payload.msg);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleLoadMore() {
    if (!session.authenticated || !pageInfo.hasNext || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    const nextPage = pageInfo.page + 1;
    const { ok, status, payload } = await readMyBattleResults(nextPage, pageInfo.size);

    if (status === 401 || payload?.resultCode === "MEMBER_401") {
      setSession({
        authenticated: false,
        member: null,
      });
      setBattleResults([]);
      setPageInfo(defaultPageInfo);
      setError(null);
      setMessage(payload?.msg ?? "로그인이 필요합니다.");
      setIsLoadingMore(false);
      return;
    }

    if (!ok || !payload || payload.resultCode !== "200" || !payload.data) {
      setError(payload?.msg ?? "다음 전적을 불러오지 못했습니다.");
      setIsLoadingMore(false);
      return;
    }

    setBattleResults((current) => [...current, ...payload.data!.battleResults]);
    setPageInfo(payload.data.pageInfo);
    setMessage(payload.msg);
    setError(null);
    setIsLoadingMore(false);
  }

  const solvedCount = battleResults.filter((item) => item.solved).length;
  const loadedCount = battleResults.length;
  const currentPage = pageInfo.totalPages > 0 ? pageInfo.page + 1 : 0;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="My Page"
        title="프로필과 전적 화면의 최소 운영 골격"
        description="현재 백엔드에는 `/me`, 티어, 총점 API가 아직 없습니다. 그래서 세션 쿠키에서 복원 가능한 식별 정보는 먼저 보여주고, 내 전적 목록은 실제 API로 연결해 확인할 수 있도록 구성합니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인 상태" : "로그인 필요"}
            </StatusPill>
            <StatusPill>Profile placeholder</StatusPill>
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          label="닉네임"
          value={session.member?.nickname ?? "게스트"}
          hint="현재 로그인 사용자 기준"
        />
        <MetricCard
          label="이메일"
          value={session.member?.email ?? "-"}
          hint="실제 members 조회 API 연동 전"
        />
        <MetricCard
          label="티어"
          value="연결 전"
          hint="백엔드 프로필 API 필요"
        />
        <MetricCard
          label="총점"
          value="연결 전"
          hint="전적/점수 API 필요"
        />
      </MetricGrid>

      {session.authenticated ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="프로필 영역" description="현재 세션에서 바로 읽을 수 있는 정보">
            <div className="space-y-3 text-sm leading-7 text-zinc-700">
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                닉네임: {session.member?.nickname}
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                이메일: {session.member?.email}
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                역할: {formatRoleLabel(session.member?.role)}
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-600">
                전적 상태: {error ?? message}
              </div>
            </div>
          </Panel>

          <Panel
            title="전적 리스트 자리"
            description="실제 전적 API를 연결해 최신 전적을 확인할 수 있도록 구성합니다."
          >
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  전체 전적
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">{pageInfo.totalElements}</p>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  현재 페이지
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {currentPage > 0 ? `${currentPage} / ${pageInfo.totalPages}` : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  로드된 전적
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {loadedCount}개{session.authenticated ? ` / 해결 ${solvedCount}개` : ""}
                </p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <LoadingRows />
            ) : battleResults.length === 0 ? (
              <EmptyPanel
                title="아직 전적이 없습니다"
                description="배틀을 한 번 이상 완료하면 이곳에서 최근 전적을 확인할 수 있습니다."
              />
            ) : (
              <div className="space-y-3">
                {battleResults.map((item) => (
                  <ResultCard key={`${item.roomId}-${item.problemId}`} item={item} />
                ))}
              </div>
            )}

            {!isLoading && battleResults.length > 0 ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-600">
                  {loadedCount}개 로드됨 / 전체 {pageInfo.totalElements}개
                </p>
                {pageInfo.hasNext ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    {isLoadingMore ? "불러오는 중..." : "다음 전적 더 보기"}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    마지막 페이지입니다.
                  </div>
                )}
              </div>
            ) : null}
          </Panel>
        </div>
      ) : (
        <Panel title="로그인이 필요합니다" description="내 전적 화면은 로그인한 사용자만 볼 수 있습니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/mypage"
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/signup"
              className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900"
            >
              회원가입
            </Link>
          </div>
        </Panel>
      )}
    </div>
  );
}
