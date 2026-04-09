"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  RankingDashboardGateProgress,
  RankingDashboardResponse,
  RankingDashboardTagStat,
  RankingDashboardTierDistribution,
  RankingDashboardTrendPoint,
} from "@/shared/api/contracts";

interface ApiErrorResponse {
  message?: string;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");
const TIER_BUCKETS = ["UNRANKED", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "GOD"] as const;
type TierBucket = (typeof TIER_BUCKETS)[number];
const BUCKET_SUBTIERS: Record<TierBucket, string[]> = {
  UNRANKED: ["UNRANKED"],
  BRONZE: ["BRONZE_5", "BRONZE_4", "BRONZE_3", "BRONZE_2", "BRONZE_1"],
  SILVER: ["SILVER_5", "SILVER_4", "SILVER_3", "SILVER_2", "SILVER_1"],
  GOLD: ["GOLD_5", "GOLD_4", "GOLD_3", "GOLD_2", "GOLD_1"],
  PLATINUM: ["PLATINUM_5", "PLATINUM_4", "PLATINUM_3", "PLATINUM_2", "PLATINUM_1"],
  DIAMOND: ["DIAMOND_5", "DIAMOND_4", "DIAMOND_3", "DIAMOND_2", "DIAMOND_1"],
  MASTER: ["MASTER_4", "MASTER_3", "MASTER_2", "MASTER_1"],
  GOD: ["GOD"],
};

function bucketFillClass(bucket: TierBucket) {
  switch (bucket) {
    case "UNRANKED":
      return "from-slate-600 to-slate-400";
    case "BRONZE":
      return "from-amber-700 to-amber-500";
    case "SILVER":
      return "from-sky-500 to-cyan-300";
    case "GOLD":
      return "from-yellow-600 to-yellow-300";
    case "PLATINUM":
      return "from-teal-500 to-emerald-300";
    case "DIAMOND":
      return "from-blue-600 to-indigo-300";
    case "MASTER":
      return "from-violet-600 to-fuchsia-400";
    case "GOD":
      return "from-pink-600 to-rose-400";
    default:
      return "from-slate-600 to-slate-400";
  }
}

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

function buildTrendGeometry(scoreTrend: RankingDashboardTrendPoint[]) {
  if (scoreTrend.length === 0) {
    return null;
  }

  const scores = scoreTrend.map((item) => item.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(1, max - min);
  const canvasWidth = Math.max(680, 140 + (scoreTrend.length - 1) * 72);
  const xStart = 56;
  const xEnd = canvasWidth - 40;
  const yTop = 18;
  const yBottom = 86;
  const gridYs = [yTop, yTop + (yBottom - yTop) / 3, yTop + ((yBottom - yTop) * 2) / 3, yBottom];
  const labelStep = Math.max(1, Math.ceil(scoreTrend.length / 10));

  const plotted = scoreTrend.map((item, index) => {
    const x = scoreTrend.length === 1 ? (xStart + xEnd) / 2 : xStart + index * ((xEnd - xStart) / (scoreTrend.length - 1));
    const y = yBottom - ((item.score - min) / range) * (yBottom - yTop);
    return { x, y, item, index };
  });

  return {
    min,
    max,
    canvasWidth,
    xStart,
    xEnd,
    yTop,
    yBottom,
    gridYs,
    labelStep,
    plotted,
    points: plotted.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
  };
}

function TrendChart({ scoreTrend }: { scoreTrend: RankingDashboardTrendPoint[] }) {
  const geometry = useMemo(() => buildTrendGeometry(scoreTrend), [scoreTrend]);

  if (scoreTrend.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-app-border/80 bg-app-elevated/40 text-xs text-app-dim">
        아직 표시할 배틀 레이팅 추이가 없습니다.
      </div>
    );
  }

  if (!geometry) {
    return null;
  }

  const { min, max, canvasWidth, xStart, xEnd, yTop, yBottom, gridYs, labelStep, plotted, points } = geometry;

  return (
    <div className="mt-4 rounded-md border border-app-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
      <div className="overflow-x-auto">
        <svg
          width={canvasWidth}
          viewBox={`0 0 ${canvasWidth} 112`}
          role="img"
          aria-label="최근 배틀 레이팅 변화 그래프"
          className="h-56 min-w-full"
        >
          <defs>
            <linearGradient id="ratingDashboardTrendGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          {gridYs.map((y) => (
            <line
              key={y}
              x1={xStart}
              x2={xEnd}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="1"
            />
          ))}
          <text x="10" y={yTop + 2} className="fill-app-dim text-[10px]">
            {numberFormatter.format(max)}
          </text>
          <text x="10" y={yBottom + 2} className="fill-app-dim text-[10px]">
            {numberFormatter.format(min)}
          </text>
          <polyline
            points={points}
            fill="none"
            stroke="url(#ratingDashboardTrendGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {plotted.map(({ x, y, item, index }) => {
            const shouldShowLabel = index % labelStep === 0 || index === plotted.length - 1;
            const signedDelta = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;
            return (
              <g key={`${item.label}-${item.occurredAt}`}>
                <circle cx={x} cy={y} r="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <title>{`${item.label} | SR ${numberFormatter.format(item.score)} (${signedDelta})`}</title>
                {shouldShowLabel ? (
                  <text x={x} y="106" textAnchor="middle" className="fill-app-dim text-[10px]">
                    {item.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 px-1 text-[11px] text-app-dim">
        각 점은 해당 배틀 정산 직후의 SR입니다. 데이터가 늘어나면 그래프는 오른쪽으로 확장되며 가로 스크롤로 볼 수 있습니다.
      </p>
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

function tierBucketOf(tier: string): TierBucket {
  if (tier === "UNRANKED") return "UNRANKED";
  const [head] = tier.split("_");
  if (head === "BRONZE") return "BRONZE";
  if (head === "SILVER") return "SILVER";
  if (head === "GOLD") return "GOLD";
  if (head === "PLATINUM") return "PLATINUM";
  if (head === "DIAMOND") return "DIAMOND";
  if (head === "MASTER") return "MASTER";
  if (head === "GOD") return "GOD";
  return "UNRANKED";
}

function buildTierBucketDistribution(
  items: RankingDashboardTierDistribution[],
  myTier: string,
): {
  bucket: TierBucket;
  count: number;
  percentage: number;
  isMyBucket: boolean;
  tooltip: string;
}[] {
  const countByTier = new Map<string, number>();
  items.forEach((item) => {
    countByTier.set(item.tier, item.count);
  });

  const countByBucket = new Map<TierBucket, number>(TIER_BUCKETS.map((bucket) => [bucket, 0]));

  items.forEach((item) => {
    const bucket = tierBucketOf(item.tier);
    const current = countByBucket.get(bucket) ?? 0;
    countByBucket.set(bucket, current + item.count);
  });

  const total = Math.max(
    1,
    Array.from(countByBucket.values()).reduce((sum, count) => sum + count, 0),
  );
  const myBucket = tierBucketOf(myTier);

  return TIER_BUCKETS.map((bucket) => {
    const count = countByBucket.get(bucket) ?? 0;
    const percentage = Math.round((count * 1000) / total) / 10;
    const subtiers = BUCKET_SUBTIERS[bucket];
    const lines = [`${bucket}: ${numberFormatter.format(count)}명 (${percentage}%)`];

    if (subtiers.length > 1) {
      subtiers.forEach((tier) => {
        const tierCount = countByTier.get(tier) ?? 0;
        const ratioInBucket = count > 0 ? Math.round((tierCount * 1000) / count) / 10 : 0;
        const mineMark = tier === myTier ? "★ " : "";
        lines.push(`${mineMark}${tier}: ${numberFormatter.format(tierCount)}명 (${ratioInBucket}%)`);
      });
    }

    const tooltip = lines.join("\n");

    return {
      bucket,
      count,
      percentage,
      isMyBucket: bucket === myBucket,
      tooltip,
    };
  });
}

function LoadingState() {
  return (
    <section className="mt-5 w-full rounded-lg border border-app-border/80 bg-app-surface/70 p-4">
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
    <section className="mt-5 w-full rounded-lg border border-app-border/80 bg-app-surface/70 p-4">
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
  const tierBucketDistribution = buildTierBucketDistribution(dashboard.tierDistribution, profile.tier);
  const tierDistributionMax = Math.max(1, ...tierBucketDistribution.map((item) => item.count));
  const totalInDistribution = tierBucketDistribution.reduce((sum, item) => sum + item.count, 0);
  const myBucket = tierBucketOf(profile.tier);
  const myBucketInfo = tierBucketDistribution.find((item) => item.isMyBucket);

  return (
    <section className="mt-5 w-full rounded-lg border border-app-border/80 bg-app-surface/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
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

        <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs md:grid-cols-5">
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">TIER</p>
            <p className="mt-1 text-app-warn">{profile.tier}</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">RANK</p>
            <p className="mt-1 text-app-primary">#{numberFormatter.format(profile.rank)}</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">SR</p>
            <p className="mt-1 text-app-success">{numberFormatter.format(profile.battleRating)}</p>
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
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="rounded border border-app-border px-2 py-0.5 text-app-primary">
                  #{numberFormatter.format(profile.rank)}
                </span>
                <span className="text-app-accent-soft">TOP {profile.percentile.toFixed(1)}%</span>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-app-dim">순위 숫자가 작을수록 상위권입니다.</p>
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
                      {numberFormatter.format(item.rank)}위 {item.nickname}
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
          </div>
          {tierBucketDistribution.every((item) => item.count === 0) ? (
            <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-app-border/80 bg-app-elevated/40 text-xs text-app-dim">
              티어 분포 데이터가 아직 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex h-32 items-end gap-2">
                {tierBucketDistribution.map((item) => {
                  const height = Math.max(6, Math.round(item.percentage));
                  const fillClass = bucketFillClass(item.bucket);

                  return (
                    <div key={item.bucket} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <div
                        className={`relative flex h-20 w-full items-end overflow-hidden rounded-t-md bg-app-elevated ${
                          item.isMyBucket
                            ? "ring-2 ring-app-accent/75 shadow-[0_0_20px_rgba(139,92,246,0.35)]"
                            : "ring-1 ring-app-border/70"
                        }`}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-b ${fillClass} opacity-15 transition-opacity group-hover:opacity-25`}
                          title={item.tooltip}
                        />
                        <div
                          className={`w-full rounded-t-md bg-gradient-to-t ${fillClass} ${
                            item.isMyBucket ? "opacity-100" : "opacity-85"
                          }`}
                          style={{ height: `${height}%` }}
                          title={item.tooltip}
                        />
                        <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-app-base px-2 py-1 text-[10px] text-app-primary opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-opacity group-hover:opacity-100">
                          {item.bucket} · {numberFormatter.format(item.count)}명 · {item.percentage}%
                        </div>
                      </div>
                      <span
                        className={`truncate font-mono text-[10px] ${
                          item.isMyBucket ? "text-app-primary" : "text-app-dim"
                        }`}
                      >
                        {item.bucket}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="font-mono text-xs text-app-secondary">
                전체 {numberFormatter.format(totalInDistribution)}명 중 내 구간({myBucket}){" "}
                {numberFormatter.format(myBucketInfo?.count ?? 0)}명 ({myBucketInfo?.percentage ?? 0}%)
              </p>
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
