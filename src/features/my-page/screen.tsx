"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  MyBattleResultItem,
  MyBattleResultsResponse,
  MyInfoApiResponse,
  MyInfoResponse,
  PageInfo,
  RatingProgressApiResponse,
  RatingProgressResponse,
  RatingRequirementProgress,
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

async function readMyInfo() {
  const response = await fetch("/api/members/me", {
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as MyInfoApiResponse | null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function readMyRatingProgress() {
  const response = await fetch("/api/members/me/rating-progress", {
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json().catch(() => null)) as RatingProgressApiResponse | null;

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

function formatRequirementValue(requirement: RatingRequirementProgress, value: number) {
  if (requirement.key === "recentTop2Ratio") {
    return `${Math.round(value * 100)}%`;
  }

  if (requirement.key === "godSeatRank") {
    return `${Math.max(1, Math.round(value))}위`;
  }

  return `${Math.round(value)}`;
}

function formatRequirementRemaining(requirement: RatingRequirementProgress) {
  if (requirement.remaining <= 0) {
    return "0";
  }

  if (requirement.key === "recentTop2Ratio") {
    return `${Math.round(requirement.remaining * 100)}%`;
  }

  if (requirement.key === "godSeatRank") {
    return `${Math.round(requirement.remaining)}위`;
  }

  return `${Math.round(requirement.remaining)}`;
}

function buildRequirementActionGuide(requirement: RatingRequirementProgress) {
  if (requirement.satisfied) {
    return "현재 조건을 충족했습니다. 다음 조건을 계속 채우면 승급에 가까워집니다.";
  }

  if (requirement.key === "battleRating") {
    const remaining = Math.max(0, Math.ceil(requirement.required - requirement.current));
    const normalFast = Math.max(1, Math.ceil(remaining / 15));
    const normalSafe = Math.max(1, Math.ceil(remaining / 8));
    const earlyFast = Math.max(1, Math.ceil(remaining / 25));
    const earlySafe = Math.max(1, Math.ceil(remaining / 15));
    const absoluteMin = Math.max(1, Math.ceil(remaining / 35));

    if (remaining <= 20) {
      return `배틀 SR 근접 구간입니다. 남은 ${remaining}점 기준 동급 매칭 체감(+8~15)으로 약 ${normalFast}~${normalSafe}판, 초반 K 구간(+15~25)에서는 약 ${earlyFast}판(이론 최소 ${absoluteMin}판)으로 도달 가능합니다.`;
    }

    if (remaining <= 60) {
      return `배틀 SR 중간 구간입니다. 남은 ${remaining}점 기준 동급 매칭 체감(+8~15)으로 약 ${normalFast}~${normalSafe}판, 초반 K 구간(+15~25) 기준 약 ${earlyFast}~${earlySafe}판이 필요합니다.`;
    }

    return `배틀 SR 장기 구간입니다. 남은 ${remaining}점 기준 동급 매칭 체감(+8~15)으로 약 ${normalFast}~${normalSafe}판이 필요하고, 초반 K 구간(+15~25)에서도 약 ${earlyFast}~${earlySafe}판이 필요합니다. (+35는 상한이라 이론 최소 ${absoluteMin}판)`;
  }

  if (requirement.key === "activityPoint" || requirement.key === "firstSolveScore") {
    const remaining = Math.max(0, requirement.required - requirement.current);
    const fastTrack = Math.max(1, Math.ceil(remaining / 20));
    const safeTrack = Math.max(1, Math.ceil(remaining / 10));
    if (fastTrack === safeTrack) {
      return `문제 first solve(문제당 +10~20 AP) 기준으로 약 ${fastTrack}문제 추가 해결이 필요합니다.`;
    }
    return `문제 first solve(문제당 +10~20 AP) 기준으로 약 ${fastTrack}~${safeTrack}문제 추가 해결이 필요합니다.`;
  }

  if (requirement.key === "solved1400Plus") {
    const remaining = Math.max(1, Math.ceil(requirement.required - requirement.current));
    return `1400+ 난이도 문제를 first solve로 ${remaining}개 더 달성하면 조건을 채울 수 있습니다.`;
  }

  if (requirement.key === "solved1700Plus") {
    const remaining = Math.max(1, Math.ceil(requirement.required - requirement.current));
    return `1700+ 난이도 문제를 first solve로 ${remaining}개 더 달성하면 조건을 채울 수 있습니다.`;
  }

  if (requirement.key === "solved2000Plus") {
    const remaining = Math.max(1, Math.ceil(requirement.required - requirement.current));
    return `2000+ 난이도 문제를 first solve로 ${remaining}개 더 달성하면 조건을 채울 수 있습니다.`;
  }

  if (requirement.key === "solved2300Plus") {
    const remaining = Math.max(1, Math.ceil(requirement.required - requirement.current));
    return `2300+ 난이도 문제를 first solve로 ${remaining}개 더 달성하면 조건을 채울 수 있습니다.`;
  }

  if (requirement.key === "recentTop2Ratio") {
    const currentTop2Wins = Math.round(requirement.current * 20);
    const targetTop2Wins = Math.ceil(requirement.required * 20);
    const neededTop2Wins = Math.max(1, targetTop2Wins - currentTop2Wins);
    return `최근 20판 기준 Top2 비율 조건입니다. 현재 약 ${currentTop2Wins}/20, 목표 ${targetTop2Wins}/20으로 최소 ${neededTop2Wins}회 추가 Top2가 필요합니다.`;
  }

  if (requirement.key === "godSeatRank") {
    const currentRank = Math.max(1, Math.round(requirement.current));
    const targetRank = Math.max(1, Math.round(requirement.required));
    const rankGap = Math.max(1, currentRank - targetRank);
    return `GOD는 좌석제입니다. 현재 ${currentRank}위에서 ${targetRank}위 이내로 올라야 하며, 최소 ${rankGap}계단 상승이 필요합니다.`;
  }

  return "이 조건은 누적 성과가 반영되면 자동으로 갱신됩니다.";
}

const statCardClass =
  "rounded-xl border border-app-border bg-app-surface px-3 py-2 shadow-[0_10px_22px_rgba(0,0,0,0.18)]";
const infoCardClass = "rounded-xl border border-app-border bg-app-elevated px-3 py-2";

function ResultCard({ item }: { item: MyBattleResultItem }) {
  return (
    <Link
      href={`/battle/results/${item.roomId}`}
      className="group block rounded-2xl border border-app-border bg-app-surface p-4 shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition hover:border-app-border-strong hover:bg-app-elevated"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-app-dim">
            roomId {item.roomId} · problemId {item.problemId}
          </p>
          <h3 className="mt-1 text-base font-semibold text-app-primary group-hover:text-app-accent-soft">
            {item.problemTitle}
          </h3>
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
        <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
          <p className="text-xs text-app-dim">최종 순위</p>
          <p className="mt-1 font-semibold text-app-primary">{formatRank(item.finalRank)}</p>
        </div>
        <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
          <p className="text-xs text-app-dim">점수 변화</p>
          <p className={`mt-1 font-semibold ${toneForScore(item.scoreDelta)}`}>
            {formatScoreDelta(item.scoreDelta)}
          </p>
        </div>
        <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
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
          className="animate-pulse rounded-2xl border border-app-border bg-app-surface p-4"
        >
          <div className="h-3 w-36 rounded bg-app-base" />
          <div className="mt-3 h-4 w-2/3 rounded bg-app-base" />
          <div className="mt-1 h-3 w-40 rounded bg-app-base" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-14 rounded-xl bg-app-base" />
            <div className="h-14 rounded-xl bg-app-base" />
            <div className="h-14 rounded-xl bg-app-base" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyPageScreen() {
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [myInfo, setMyInfo] = useState<MyInfoResponse | null>(null);
  const [myInfoError, setMyInfoError] = useState<string | null>(null);
  const [ratingProgress, setRatingProgress] = useState<RatingProgressResponse | null>(null);
  const [ratingProgressError, setRatingProgressError] = useState<string | null>(null);
  const [battleResults, setBattleResults] = useState<MyBattleResultItem[]>([]);
  const [pageInfo, setPageInfo] = useState(defaultPageInfo);
  const [message, setMessage] = useState("내 전적을 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        setMyInfo(null);
        setMyInfoError(null);
        setRatingProgress(null);
        setRatingProgressError(null);
        setBattleResults([]);
        setPageInfo(defaultPageInfo);
        setError(null);
        setIsLoading(false);
        setMessage("로그인 후 내 전적을 확인할 수 있습니다.");
        return;
      }

      const [myInfoResponse, battleResultsResponse, ratingProgressResponse] = await Promise.all([
        readMyInfo(),
        readMyBattleResults(0, PAGE_SIZE),
        readMyRatingProgress(),
      ]);

      if (!active) {
        return;
      }

      const isUnauthorized =
        myInfoResponse.status === 401 ||
        myInfoResponse.payload?.resultCode === "MEMBER_401" ||
        ratingProgressResponse.status === 401 ||
        ratingProgressResponse.payload?.resultCode === "MEMBER_401" ||
        battleResultsResponse.status === 401 ||
        battleResultsResponse.payload?.resultCode === "MEMBER_401";

      if (isUnauthorized) {
        void refreshSession();
        setMyInfo(null);
        setMyInfoError(null);
        setRatingProgress(null);
        setRatingProgressError(null);
        setBattleResults([]);
        setPageInfo(defaultPageInfo);
        setError(null);
        setMessage(
          myInfoResponse.payload?.msg ??
            ratingProgressResponse.payload?.msg ??
            battleResultsResponse.payload?.msg ??
            "로그인이 필요합니다.",
        );
        setIsLoading(false);
        return;
      }

      if (
        myInfoResponse.ok &&
        myInfoResponse.payload &&
        myInfoResponse.payload.resultCode === "200" &&
        myInfoResponse.payload.data
      ) {
        setMyInfo(myInfoResponse.payload.data);
        setMyInfoError(null);
      } else {
        setMyInfo(null);
        setMyInfoError(myInfoResponse.payload?.msg ?? "내 레이팅 정보를 불러오지 못했습니다.");
      }

      if (
        ratingProgressResponse.ok &&
        ratingProgressResponse.payload &&
        ratingProgressResponse.payload.resultCode === "200" &&
        ratingProgressResponse.payload.data
      ) {
        setRatingProgress(ratingProgressResponse.payload.data);
        setRatingProgressError(null);
      } else {
        setRatingProgress(null);
        setRatingProgressError(
          ratingProgressResponse.payload?.msg ?? "다음 티어 조건을 불러오지 못했습니다.",
        );
      }

      const { ok, payload } = battleResultsResponse;

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

  const battleMatchCount = ratingProgress?.current.battleMatchCount ?? myInfo?.battleMatchCount ?? null;
  const firstSolvedProblemCount =
    ratingProgress?.current.firstSolvedProblemCount ?? myInfo?.firstSolvedProblemCount ?? null;
  const shouldDisplayUnranked =
    battleMatchCount !== null &&
    firstSolvedProblemCount !== null &&
    battleMatchCount === 0 &&
    firstSolvedProblemCount === 0;
  const displayTier = ratingProgress?.current.displayTier ?? (shouldDisplayUnranked ? "UNRANKED" : (myInfo?.tier ?? "-"));
  const battleRating =
    ratingProgress?.current.battleRating ??
    myInfo?.battleRating ??
    (typeof myInfo?.score === "number" ? myInfo.score : null);
  const firstSolveScore = ratingProgress?.current.activityPoint ?? myInfo?.firstSolveScore ?? null;
  const tierScore = myInfo?.tierScore ?? battleRating;
  const recentTop2Ratio =
    typeof ratingProgress?.current.recentTop2Ratio === "number"
      ? ratingProgress.current.recentTop2Ratio
      : typeof myInfo?.recentTop2Rate === "number"
        ? myInfo.recentTop2Rate
        : null;
  const nextTier = ratingProgress?.next ?? null;
  const nextRequirements = nextTier?.requirements ?? [];
  const apRequirement =
    nextRequirements.find(
      (requirement) => requirement.key === "activityPoint" || requirement.key === "firstSolveScore",
    ) ?? null;
  const satisfiedRequirementCount = nextRequirements.filter((requirement) => requirement.satisfied).length;

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
        <div className="w-full px-4 py-6 sm:px-6">
          <section className="mb-5 rounded-2xl border border-app-border bg-gradient-to-r from-app-surface to-app-elevated px-4 py-4 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-app-dim">my-page.json</p>
                <h1 className="mt-2 text-xl font-semibold text-app-primary">마이페이지</h1>
                <p className="mt-1 text-sm text-app-muted">
                  내 계정 정보와 최근 배틀 전적을 확인합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-7 items-center rounded-full border border-app-border bg-app-base px-3 text-xs font-semibold text-app-secondary">
                  PROFILE
                </span>
                <span className="inline-flex h-7 items-center rounded-full border border-app-border bg-app-base px-3 text-xs font-semibold text-app-secondary">
                  HISTORY
                </span>
              </div>
            </div>
            {session.authenticated ? (
              <p className="mt-3 text-xs text-app-dim">
                {pageInfo.totalElements > 0
                  ? `총 ${pageInfo.totalElements}개 · ${currentPage}/${pageInfo.totalPages} 페이지`
                  : "전적 데이터 준비 중"}
              </p>
            ) : (
              <p className="mt-3 text-xs text-app-dim">로그인 후 내 전적을 확인할 수 있습니다.</p>
            )}
          </section>

          {!session.authenticated ? (
            <div className="space-y-4 rounded-2xl border border-app-border bg-app-surface px-4 py-4">
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className={statCardClass}>
                  <p className="text-xs text-app-dim">표시 티어</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {displayTier}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs text-app-dim">SR (battleRating)</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {battleRating ?? "-"}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs text-app-dim">AP (firstSolveScore)</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {firstSolveScore ?? "-"}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs text-app-dim">배틀 판수</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {battleMatchCount ?? "-"}
                  </p>
                </div>
                <div className={infoCardClass}>
                  <p className="text-xs text-app-dim">first solve 문제 수</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {firstSolvedProblemCount ?? "-"}
                  </p>
                </div>
                <div className={infoCardClass}>
                  <p className="text-xs text-app-dim">최근 Top2 비율</p>
                  <p className="mt-1 text-base font-semibold text-app-primary">
                    {recentTop2Ratio !== null ? `${Math.round(recentTop2Ratio * 100)}%` : "-"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdvancedStats((prev) => !prev)}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-xs font-medium text-app-secondary transition hover:border-app-border-strong hover:bg-app-surface hover:text-app-primary"
                >
                  {showAdvancedStats ? "고급 지표 숨기기" : "고급 지표 보기"}
                </button>
              </div>

              {showAdvancedStats ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">랭킹 표시 점수 (tierScore)</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">{tierScore ?? "-"}</p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">닉네임 / 역할</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">
                        {myInfo?.nickname ?? session.member?.nickname ?? "-"}
                      </p>
                      <p className="mt-0.5 text-xs text-app-muted">
                        {formatRoleLabel(myInfo?.role ?? session.member?.role)}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">2300+ 해결</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">
                        {ratingProgress?.current.solved2300Plus ?? myInfo?.solved2300Plus ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">1400+ 해결</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">
                        {ratingProgress?.current.solved1400Plus ?? myInfo?.solved1400Plus ?? "-"}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">1700+ 해결</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">
                        {ratingProgress?.current.solved1700Plus ?? myInfo?.solved1700Plus ?? "-"}
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <p className="text-xs text-app-dim">2000+ 해결</p>
                      <p className="mt-1 text-base font-semibold text-app-primary">
                        {ratingProgress?.current.solved2000Plus ?? myInfo?.solved2000Plus ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <section className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-app-primary">다음 티어 진행도</h2>
                    <p className="mt-1 text-xs text-app-muted">
                      현재 티어에서 다음 티어로 올라가기 위해 필요한 조건입니다.
                    </p>
                  </div>
                  {nextTier ? (
                    <span className="inline-flex h-7 items-center rounded-full border border-app-border-strong bg-app-base px-3 text-xs font-semibold text-app-primary">
                      {displayTier} → {nextTier.tier}
                    </span>
                  ) : (
                    <span className="inline-flex h-7 items-center rounded-full border border-app-border-strong bg-app-base px-3 text-xs font-semibold text-app-primary">
                      최상위 티어
                    </span>
                  )}
                </div>

                {ratingProgressError ? (
                  <p className="text-sm text-app-warn">{ratingProgressError}</p>
                ) : !ratingProgress ? (
                  <p className="text-sm text-app-muted">티어 진행도를 불러오는 중입니다.</p>
                ) : !nextTier ? (
                  <p className="text-sm text-app-success">현재 GOD 티어입니다. 더 높은 티어는 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {apRequirement ? (
                      <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-app-primary">AP (firstSolveScore)</p>
                          <p className="text-xs font-semibold text-app-accent-soft">승급 필수</p>
                        </div>
                        <p className="mt-1 text-xs text-app-muted">
                          현재 {Math.round(firstSolveScore ?? 0)} / 목표 {Math.round(apRequirement.required)} · 남은 값{" "}
                          {Math.max(0, Math.round(apRequirement.required - apRequirement.current))}
                        </p>
                        <p className="mt-2 text-xs text-app-secondary">
                          다음 티어 승급에 AP 조건이 포함됩니다. first solve를 누적해 목표를 채우세요.
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p className="text-app-secondary">{nextTier.message}</p>
                      <p className="text-app-dim">
                        충족 {satisfiedRequirementCount}/{nextRequirements.length}
                      </p>
                    </div>

                    {nextRequirements.map((requirement) => {
                      const progressPercent =
                        requirement.comparison === "AT_LEAST"
                          ? Math.min(100, Math.round((requirement.current / Math.max(requirement.required, 1)) * 100))
                          : requirement.satisfied
                            ? 100
                            : 0;
                      const actionGuide = buildRequirementActionGuide(requirement);

                      return (
                        <div
                          key={requirement.key}
                          className="rounded-xl border border-app-border bg-app-base px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-app-primary">{requirement.label}</p>
                            <p
                              className={`text-xs font-semibold ${
                                requirement.satisfied ? "text-app-success" : "text-app-warn"
                              }`}
                            >
                              {requirement.satisfied ? "충족" : "미충족"}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-app-muted">
                            현재 {formatRequirementValue(requirement, requirement.current)} / 목표{" "}
                            {formatRequirementValue(requirement, requirement.required)}
                            {requirement.satisfied ? "" : ` · 남은 값 ${formatRequirementRemaining(requirement)}`}
                          </p>
                          <div className="mt-2 h-1.5 rounded-full bg-app-border">
                            <div
                              className={`h-1.5 rounded-full ${
                                requirement.satisfied ? "bg-app-success" : "bg-app-accent"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-app-secondary">{actionGuide}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {myInfoError ? (
                <div className="rounded-xl border border-app-warn/60 bg-app-warn/15 px-3 py-2 text-sm text-app-warn">
                  {myInfoError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-app-danger/60 bg-app-danger/20 px-3 py-2 text-sm text-app-danger">
                  {error}
                </div>
              ) : (
                <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-secondary">
                  {message}
                </div>
              )}

              {isLoading ? (
                <LoadingRows />
              ) : battleResults.length === 0 ? (
                <div className="rounded-xl border border-app-border bg-app-surface px-4 py-6 text-center text-sm text-app-muted">
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
                    <div className="inline-flex h-10 items-center rounded-md border border-app-border bg-app-surface px-4 text-sm text-app-muted">
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
