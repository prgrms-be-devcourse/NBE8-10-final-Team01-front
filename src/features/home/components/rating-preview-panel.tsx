"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  RankingDashboardGateProgress,
  RankingDashboardResponse,
  RankingDashboardTagStat,
  RankingDashboardTrendPoint,
} from "@/shared/api/contracts";

interface ApiErrorResponse {
  message?: string;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

async function readRankingDashboard(signal: AbortSignal) {
  const response = await fetch("/api/v1/rankings/me/dashboard", {
    cache: "no-store",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;

    throw new Error(payload?.message ?? "랭킹 대시보드를 불러오지 못했습니다.");
  }

  return (await response.json()) as RankingDashboardResponse;
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${numberFormatter.format(value)}`;
  return numberFormatter.format(value);
}

function getGateTone(index: number) {
  const tones = [
    "from-app-accent to-app-accent-soft",
    "from-app-warn to-app-success",
    "from-app-success to-app-accent-soft",
  ];

  return tones[index % tones.length];
}

function getGatePercent(item: RankingDashboardGateProgress) {
  if (item.target <= 0 || item.current >= item.target) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round((item.current / item.target) * 100)));
}

function getTrendPoints(scoreTrend: RankingDashboardTrendPoint[]) {
  if (scoreTrend.length === 0) {
    return "";
  }

  const scores = scoreTrend.map((item) => item.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(1, max - min);

  return scoreTrend
    .map((item, index) => {
      const x = scoreTrend.length === 1 ? 50 : 10 + index * (84 / (scoreTrend.length - 1));
      const y = 70 - ((item.score - min) / range) * 48;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendChart({ scoreTrend }: { scoreTrend: RankingDashboardTrendPoint[] }) {
  const points = useMemo(() => getTrendPoints(scoreTrend), [scoreTrend]);
  const scores = scoreTrend.map((item) => item.score);
  const min = scores.length > 0 ? Math.min(...scores) : 0;
  const max = scores.length > 0 ? Math.max(...scores) : 0;
  const range = Math.max(1, max - min);

  if (scoreTrend.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-app-border/80 bg-app-elevated/40 text-xs text-app-dim">
        아직 표시할 배틀 레이팅 추이가 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-app-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
      <svg
        viewBox="0 0 100 78"
        role="img"
        aria-label="최근 배틀 레이팅 변화 그래프"
        className="h-40 w-full overflow-visible"
      >
        <defs>
          <linearGradient id="ratingDashboardTrendGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {[18, 34, 50, 66].map((y) => (
          <line
            key={y}
            x1="8"
            x2="94"
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="0.45"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="url(#ratingDashboardTrendGradient)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {scoreTrend.map((item, index) => {
          const x = scoreTrend.length === 1 ? 50 : 10 + index * (84 / (scoreTrend.length - 1));
          const y = 70 - ((item.score - min) / range) * 48;

          return (
            <g key={`${item.label}-${item.occurredAt}`}>
              <circle cx={x} cy={y} r="2.6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.4" />
              <text x={x} y="77" textAnchor="middle" className="fill-app-dim text-[4px]">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GateProgressList({ items }: { items: RankingDashboardGateProgress[] }) {
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-app-border/80 bg-app-elevated/40 px-3 py-5 text-xs text-app-dim">
        다음 티어 조건 데이터가 아직 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => {
        const percent = getGatePercent(item);
        const completed = percent >= 100;

        return (
          <div key={item.key}>
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span className="text-app-secondary">{item.label}</span>
              <span className={completed ? "text-app-success" : "text-app-primary"}>
                {numberFormatter.format(item.current)}
                {item.suffix} / {numberFormatter.format(item.target)}
                {item.suffix}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getGateTone(index)}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TagStatsList({ items }: { items: RankingDashboardTagStat[] }) {
  if (items.length === 0) {
    return <p className="mt-3 text-xs text-app-dim">태그별 통계는 아직 없습니다.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {items.slice(0, 4).map((item) => (
        <div key={item.tag}>
          <div className="mb-1 flex justify-between font-mono text-[11px]">
            <span className="text-app-secondary">{item.tag}</span>
            <span className="text-app-primary">{item.accuracy}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-app-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-app-accent to-app-success"
              style={{ width: `${Math.max(0, Math.min(100, item.accuracy))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-app-dim">
            solved {numberFormatter.format(item.solvedCount)} / submissions{" "}
            {numberFormatter.format(item.submissionCount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <section className="mt-5 max-w-6xl rounded-lg border border-app-border/80 bg-app-surface/70 p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded bg-app-elevated" />
        <div className="h-6 w-72 rounded bg-app-elevated" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-20 rounded bg-app-elevated" />
          <div className="h-20 rounded bg-app-elevated" />
          <div className="h-20 rounded bg-app-elevated" />
        </div>
        <div className="h-44 rounded bg-app-elevated" />
      </div>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="mt-5 max-w-6xl rounded-lg border border-app-border/80 bg-app-surface/70 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-app-accent-soft">
        RATING_MONITOR
      </p>
      <div className="mt-3 rounded-md border border-app-danger/50 bg-app-danger/10 px-3 py-3 text-xs text-app-danger">
        {message}
      </div>
    </section>
  );
}

export default function RatingPreviewPanel() {
  const [dashboard, setDashboard] = useState<RankingDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);
        const nextDashboard = await readRankingDashboard(controller.signal);
        setDashboard(nextDashboard);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "랭킹 대시보드를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !dashboard) {
    return <ErrorState message={error ?? "랭킹 대시보드 데이터가 없습니다."} />;
  }

  const { profile } = dashboard;
  const nextTierLabel = profile.nextTier ?? "최고 티어";
  const tierDistributionMax = Math.max(
    1,
    ...dashboard.tierDistribution.map((item) => item.percentage),
  );

  return (
    <section className="mt-5 max-w-6xl rounded-lg border border-app-border/80 bg-app-surface/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-app-accent-soft">
            RATING_MONITOR
          </p>
          <h2 className="mt-1 text-lg font-semibold text-app-primary">
            내 성장/랭킹 대시보드
          </h2>
          <p className="mt-1 text-xs text-app-secondary">
            {profile.nickname}님의 배틀 레이팅, 승급 조건, 주변 랭킹을 실시간 운영 데이터로 보여줍니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs sm:grid-cols-5">
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">TIER</p>
            <p className="mt-1 text-app-warn">{profile.tier}</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">RANK</p>
            <p className="mt-1 text-app-primary">#{numberFormatter.format(profile.rank)}</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">SCORE</p>
            <p className="mt-1 text-app-success">{numberFormatter.format(profile.score)}</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">TOP2</p>
            <p className="mt-1 text-app-accent-soft">{profile.top2Rate}%</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">MATCH</p>
            <p className="mt-1 text-app-primary">
              {numberFormatter.format(profile.battleMatchCount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
        <div className="rounded-lg border border-app-border bg-app-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-app-dim">battle score trend</p>
              <p className="mt-1 text-sm font-semibold text-app-primary">최근 배틀 레이팅 변화</p>
            </div>
            <span
              className={`rounded-full border px-2 py-1 font-mono text-xs ${
                profile.scoreDeltaTotal >= 0
                  ? "border-app-success/40 bg-app-success/10 text-app-success"
                  : "border-app-danger/40 bg-app-danger/10 text-app-danger"
              }`}
            >
              {formatSignedNumber(profile.scoreDeltaTotal)}
            </span>
          </div>

          <TrendChart scoreTrend={dashboard.scoreTrend} />
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <p className="font-mono text-xs text-app-dim">promotion gate</p>
            <p className="mt-1 text-sm font-semibold text-app-primary">
              {profile.nextTier ? `${nextTierLabel}까지 남은 조건` : "최고 티어 구간"}
            </p>
            <GateProgressList items={dashboard.gateProgress} />
          </div>

          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs text-app-dim">nearby ranking</p>
              <span className="font-mono text-xs text-app-accent-soft">
                TOP {profile.percentile.toFixed(1)}%
              </span>
            </div>
            {dashboard.nearbyRanking.length === 0 ? (
              <p className="text-xs text-app-dim">주변 랭킹 데이터가 아직 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {dashboard.nearbyRanking.map((item) => (
                  <div
                    key={item.memberId}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-xs ${
                      item.isMe
                        ? "border-app-accent/50 bg-app-accent/15 text-app-primary"
                        : "border-app-border bg-app-elevated/70 text-app-secondary"
                    }`}
                  >
                    <span>
                      #{numberFormatter.format(item.rank)} {item.nickname}
                    </span>
                    <span>{numberFormatter.format(item.score)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.8fr)]">
        <div className="rounded-lg border border-app-border bg-app-base p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-xs text-app-dim">tier distribution</p>
            <p className="font-mono text-xs text-app-secondary">내 위치: {profile.tier}</p>
          </div>
          {dashboard.tierDistribution.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-app-border/80 bg-app-elevated/40 text-xs text-app-dim">
              티어 분포 데이터가 아직 없습니다.
            </div>
          ) : (
            <div className="flex h-28 items-end gap-2">
              {dashboard.tierDistribution.map((item) => {
                const height = Math.max(6, Math.round((item.percentage / tierDistributionMax) * 100));

                return (
                  <div key={item.tier} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-20 w-full items-end overflow-hidden rounded-t-md bg-app-elevated">
                      <div
                        className={`w-full rounded-t-md ${
                          item.isMyTier
                            ? "bg-gradient-to-t from-app-accent to-app-success"
                            : "bg-gradient-to-t from-app-border-strong to-app-surface"
                        }`}
                        style={{ height: `${height}%` }}
                        title={`${item.tier}: ${item.count}명 (${item.percentage}%)`}
                      />
                    </div>
                    <span className="truncate font-mono text-[10px] text-app-dim">{item.tier}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <p className="font-mono text-xs text-app-dim">tag strength</p>
            <TagStatsList items={dashboard.tagStats} />
          </div>

          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <p className="font-mono text-xs text-app-dim">review queue</p>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                <p className="text-app-dim">TODAY</p>
                <p className="mt-1 text-app-warn">
                  {numberFormatter.format(dashboard.reviewSummary.dueTodayCount)}
                </p>
              </div>
              <div className="rounded-md border border-app-border bg-app-elevated px-3 py-2">
                <p className="text-app-dim">UPCOMING</p>
                <p className="mt-1 text-app-primary">
                  {numberFormatter.format(dashboard.reviewSummary.upcomingCount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
