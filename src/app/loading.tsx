// Home (/) 스켈레톤

function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-20 rounded-full" />
        <Sk className="h-9 w-2/3" />
        <div className="space-y-2">
          <Sk className="h-4 w-full max-w-lg" />
          <Sk className="h-4 w-4/5 max-w-md" />
        </div>
        <div className="flex gap-2 pt-1">
          <Sk className="h-9 w-36 rounded-2xl" />
        </div>
      </div>

      {/* MetricGrid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-4 space-y-3">
            <Sk className="h-3 w-16" />
            <Sk className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Panel: 매칭 설정 */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 space-y-4">
        <Sk className="h-5 w-32" />
        <Sk className="h-3 w-56" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Sk className="h-10 rounded-xl" />
          <Sk className="h-10 rounded-xl" />
        </div>
        <Sk className="h-10 w-36 rounded-2xl" />
      </div>

      {/* Panel: 최근 전적 */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 space-y-4">
        <Sk className="h-5 w-24" />
        <Sk className="h-3 w-48" />
        <div className="space-y-3 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Sk className="h-4 w-16" />
              <Sk className="h-4 flex-1" />
              <Sk className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
