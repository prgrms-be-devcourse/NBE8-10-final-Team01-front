const ratingTrend = [
  { label: "D-6", value: 1216 },
  { label: "D-5", value: 1224 },
  { label: "D-4", value: 1239 },
  { label: "D-3", value: 1228 },
  { label: "D-2", value: 1257 },
  { label: "D-1", value: 1271 },
  { label: "NOW", value: 1284 },
];

const gateProgress = [
  { label: "AP", value: 140, target: 220, tone: "from-app-accent to-app-accent-soft" },
  { label: "1400+", value: 8, target: 12, tone: "from-app-warn to-app-success" },
  { label: "Top2", value: 45, target: 55, suffix: "%", tone: "from-app-success to-app-accent-soft" },
];

const nearbyRanks = [
  { rank: 40, nickname: "j10@aa.com", score: 1291 },
  { rank: 41, nickname: "n3@aa.com", score: 1288 },
  { rank: 42, nickname: "nm2@aa.com", score: 1284, isMe: true },
  { rank: 43, nickname: "j2@aa.com", score: 1279 },
];

const tierDistribution = [
  { tier: "B5", value: 22 },
  { tier: "B4", value: 34 },
  { tier: "B3", value: 48 },
  { tier: "B2", value: 39 },
  { tier: "B1", value: 26 },
  { tier: "S5", value: 18 },
  { tier: "S4", value: 9 },
];

const trendValues = ratingTrend.map((item) => item.value);
const trendMin = Math.min(...trendValues);
const trendMax = Math.max(...trendValues);
const trendRange = Math.max(1, trendMax - trendMin);
const trendPoints = ratingTrend
  .map((item, index) => {
    const x = 10 + index * 14;
    const y = 70 - ((item.value - trendMin) / trendRange) * 48;

    return `${x},${y.toFixed(1)}`;
  })
  .join(" ");

export default function RatingPreviewPanel() {
  return (
    <section className="mt-5 max-w-6xl rounded-lg border border-app-border/80 bg-app-surface/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-app-accent-soft">
            RATING_MONITOR
          </p>
          <h2 className="mt-1 text-lg font-semibold text-app-primary">
            내 성장 그래프 미리보기
          </h2>
          <p className="mt-1 text-xs text-app-secondary">
            mock data로 구성한 랭킹 대시보드 예시입니다. 실제 API가 붙으면 현재 티어, 승급 게이트,
            주변 랭킹을 함께 보여줄 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">TIER</p>
            <p className="mt-1 text-app-warn">BRONZE_1</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">RANK</p>
            <p className="mt-1 text-app-primary">#42</p>
          </div>
          <div className="rounded-md border border-app-border bg-app-base px-3 py-2">
            <p className="text-app-dim">SR</p>
            <p className="mt-1 text-app-success">1284</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
        <div className="rounded-lg border border-app-border bg-app-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-app-dim">battleRating trend</p>
              <p className="mt-1 text-sm font-semibold text-app-primary">최근 7회 SR 변화</p>
            </div>
            <span className="rounded-full border border-app-success/40 bg-app-success/10 px-2 py-1 font-mono text-xs text-app-success">
              +68 SR
            </span>
          </div>

          <div className="mt-4 rounded-md border border-app-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
            <svg viewBox="0 0 100 78" role="img" aria-label="최근 7회 레이팅 변화 그래프" className="h-40 w-full overflow-visible">
              <defs>
                <linearGradient id="ratingTrendGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="55%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              {[18, 34, 50, 66].map((y) => (
                <line key={y} x1="8" x2="94" y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="0.45" />
              ))}
              <polyline points={trendPoints} fill="none" stroke="url(#ratingTrendGradient)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              {ratingTrend.map((item, index) => {
                const x = 10 + index * 14;
                const y = 70 - ((item.value - trendMin) / trendRange) * 48;

                return (
                  <g key={item.label}>
                    <circle cx={x} cy={y} r="2.6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.4" />
                    <text x={x} y="77" textAnchor="middle" className="fill-app-dim text-[4px]">
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <p className="font-mono text-xs text-app-dim">promotion gate</p>
            <p className="mt-1 text-sm font-semibold text-app-primary">SILVER_5까지 남은 조건</p>
            <div className="mt-4 space-y-3">
              {gateProgress.map((item) => {
                const percent = Math.min(100, Math.round((item.value / item.target) * 100));

                return (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between font-mono text-xs">
                      <span className="text-app-secondary">{item.label}</span>
                      <span className="text-app-primary">
                        {item.value}
                        {item.suffix ?? ""} / {item.target}
                        {item.suffix ?? ""}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
                      <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-app-border bg-app-base p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs text-app-dim">nearby ranking</p>
              <span className="font-mono text-xs text-app-accent-soft">TOP 18%</span>
            </div>
            <div className="space-y-2">
              {nearbyRanks.map((item) => (
                <div
                  key={item.rank}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-xs ${
                    item.isMe
                      ? "border-app-accent/50 bg-app-accent/15 text-app-primary"
                      : "border-app-border bg-app-elevated/70 text-app-secondary"
                  }`}
                >
                  <span>#{item.rank} {item.nickname}</span>
                  <span>{item.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-app-border bg-app-base p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs text-app-dim">tier distribution</p>
          <p className="font-mono text-xs text-app-secondary">내 위치는 BRONZE_1 끝자락</p>
        </div>
        <div className="flex h-28 items-end gap-2">
          {tierDistribution.map((item) => (
            <div key={item.tier} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative flex h-20 w-full items-end overflow-hidden rounded-t-md bg-app-elevated">
                <div
                  className={`w-full rounded-t-md ${
                    item.tier === "B1"
                      ? "bg-gradient-to-t from-app-accent to-app-success"
                      : "bg-gradient-to-t from-app-border-strong to-app-surface"
                  }`}
                  style={{ height: `${item.value}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-app-dim">{item.tier}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
