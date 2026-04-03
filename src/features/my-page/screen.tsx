"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  MyBattleResultItem,
  MyBattleResultsResponse,
  PageInfo,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
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

function toneForScore(scoreDelta: number) {
  if (scoreDelta > 0) {
    return "text-app-success";
  }

  if (scoreDelta < 0) {
    return "text-app-danger";
  }

  return "text-app-secondary";
}

function ResultCard({ item }: { item: MyBattleResultItem }) {
  return (
    <Link
      href={`/battle/results/${item.roomId}`}
      className="block rounded-md border border-app-border bg-app-elevated p-4 transition hover:bg-app-elevated/90"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-app-dim">
            roomId {item.roomId} · problemId {item.problemId}
          </p>
          <h3 className="mt-1 text-base font-semibold text-app-primary">{item.problemTitle}</h3>
          <p className="mt-1 text-xs text-app-muted">{formatDateTime(item.playedAt)} 플레이</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex h-6 items-center rounded-full border px-2 font-semibold ${
              item.solved
                ? "border-app-success/60 bg-app-success/20 text-app-success"
                : "border-app-warn/60 bg-app-warn/20 text-app-warn"
            }`}
          >
            {item.solved ? "성공" : "미해결"}
          </span>
          <span className="inline-flex h-6 items-center rounded-full border border-app-border-strong bg-app-base px-2 font-semibold text-app-primary">
            {formatRank(item.finalRank)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
          <p className="text-xs text-app-dim">최종 순위</p>
          <p className="mt-1 font-semibold text-app-primary">{formatRank(item.finalRank)}</p>
        </div>
        <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
          <p className="text-xs text-app-dim">점수 변화</p>
          <p className={`mt-1 font-semibold ${toneForScore(item.scoreDelta)}`}>
            {formatScoreDelta(item.scoreDelta)}
          </p>
        </div>
        <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
          <p className="text-xs text-app-dim">정답 처리 시각</p>
          <p className="mt-1 font-medium text-app-primary">
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
          className="animate-pulse rounded-md border border-app-border bg-app-elevated p-4"
        >
          <div className="h-3 w-36 rounded bg-app-elevated" />
          <div className="mt-3 h-4 w-2/3 rounded bg-app-elevated" />
          <div className="mt-1 h-3 w-40 rounded bg-app-elevated" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-14 rounded-md bg-app-elevated" />
            <div className="h-14 rounded-md bg-app-elevated" />
            <div className="h-14 rounded-md bg-app-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyPageScreen() {
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [battleResults, setBattleResults] = useState<MyBattleResultItem[]>([]);
  const [pageInfo, setPageInfo] = useState(defaultPageInfo);
  const [message, setMessage] = useState("내 전적을 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        setIsLoading(false);
        setMessage("로그인 후 내 전적을 확인할 수 있습니다.");
        return;
      }

      const { ok, status, payload } = await readMyBattleResults(0, PAGE_SIZE);

      if (!active) {
        return;
      }

      if (status === 401 || payload?.resultCode === "MEMBER_401") {
        void refreshSession();
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
  }, [refreshSession, session.authenticated, sessionLoaded]);

  async function handleLoadMore() {
    if (!session.authenticated || !pageInfo.hasNext || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    const nextPage = pageInfo.page + 1;
    const { ok, status, payload } = await readMyBattleResults(nextPage, pageInfo.size);

    if (status === 401 || payload?.resultCode === "MEMBER_401") {
      void refreshSession();
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
    <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
        <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
          <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path
                d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.2 8.2h5.6M5.2 10.2h5.6" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
          <span>my-page.json</span>
          <span className="text-app-dim">×</span>
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-app-base">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-app-border/70 pb-3">
            <div>
              <h1 className="text-xl font-semibold text-app-primary">마이페이지</h1>
              <p className="mt-1 text-sm text-app-muted">
                내 계정 정보와 최근 배틀 전적을 확인합니다.
              </p>
            </div>
            {session.authenticated ? (
              <p className="text-xs text-app-dim">
                {pageInfo.totalElements > 0
                  ? `총 ${pageInfo.totalElements}개 · ${currentPage}/${pageInfo.totalPages} 페이지`
                  : "전적 데이터 준비 중"}
              </p>
            ) : null}
          </div>

          {!session.authenticated ? (
            <div className="space-y-4 rounded-md border border-app-border bg-app-elevated px-4 py-4">
              <p className="text-sm text-app-secondary">{message}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login?next=/mypage"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white transition hover:bg-app-accent-hover"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-app-border bg-app-base px-4 text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                >
                  회원가입
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                  <p className="text-xs text-app-dim">닉네임</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {session.member?.nickname ?? "-"}
                  </p>
                </div>
                <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                  <p className="text-xs text-app-dim">이메일</p>
                  <p className="mt-1 truncate text-base font-semibold text-app-primary">
                    {session.member?.email ?? "-"}
                  </p>
                </div>
                <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                  <p className="text-xs text-app-dim">역할</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {formatRoleLabel(session.member?.role)}
                  </p>
                </div>
                <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                  <p className="text-xs text-app-dim">해결 / 전체</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {solvedCount} / {loadedCount}
                  </p>
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-app-danger/60 bg-app-danger/20 px-3 py-2 text-sm text-app-danger">
                  {error}
                </div>
              ) : (
                <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2 text-sm text-app-secondary">
                  {message}
                </div>
              )}

              {isLoading ? (
                <LoadingRows />
              ) : battleResults.length === 0 ? (
                <div className="rounded-md border border-app-border bg-app-elevated px-4 py-6 text-center text-sm text-app-muted">
                  아직 전적이 없습니다. 배틀을 완료하면 이곳에서 확인할 수 있습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {battleResults.map((item) => (
                    <ResultCard key={`${item.roomId}-${item.problemId}`} item={item} />
                  ))}
                </div>
              )}

              {!isLoading && battleResults.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-app-muted">
                    {loadedCount}개 로드됨 / 전체 {pageInfo.totalElements}개
                  </p>
                  {pageInfo.hasNext ? (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white transition hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:bg-app-elevated disabled:text-app-secondary"
                    >
                      {isLoadingMore ? "불러오는 중..." : "다음 전적 더 보기"}
                    </button>
                  ) : (
                    <div className="inline-flex h-10 items-center rounded-md border border-app-border bg-app-elevated px-4 text-sm text-app-muted">
                      마지막 페이지입니다.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
