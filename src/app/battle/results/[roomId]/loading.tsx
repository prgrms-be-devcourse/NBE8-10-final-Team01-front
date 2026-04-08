function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function BattleResultLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-28 rounded-full" />
        <Sk className="h-9 w-1/2" />
        <Sk className="h-4 w-72" />
        <div className="flex gap-2">
          <Sk className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* MetricGrid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-4 space-y-3">
            <Sk className="h-3 w-16" />
            <Sk className="h-7 w-20" />
          </div>
        ))}
      </div>

      {/* 순위 카드 */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-5">
            <div className="flex items-center gap-4">
              <Sk className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-5 w-32" />
                <Sk className="h-4 w-24" />
              </div>
              <Sk className="h-6 w-20 rounded-full" />
              <Sk className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* 코드 패널 */}
      <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border">
          <Sk className="h-3 w-3 rounded-full" />
          <Sk className="h-3 w-3 rounded-full" />
          <Sk className="h-3 w-3 rounded-full" />
          <Sk className="h-4 w-40 ml-2" />
        </div>
        <div className="p-4 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Sk className="h-4 w-5 shrink-0" />
              <Sk className={`h-4 ${i % 3 === 0 ? "w-1/3" : i % 3 === 1 ? "w-3/5" : "w-2/5"}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
