function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function SpectateLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-20 rounded-full" />
        <Sk className="h-9 w-2/5" />
        <Sk className="h-4 w-full max-w-lg" />
        <div className="flex gap-2">
          <Sk className="h-6 w-24 rounded-full" />
          <Sk className="h-6 w-16 rounded-full" />
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

      {/* 방 목록 그리드 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Sk className="h-3 w-16" />
                <Sk className="h-6 w-48" />
              </div>
              <Sk className="h-6 w-20 rounded-full shrink-0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-app-border bg-app-elevated p-4 space-y-2">
                <Sk className="h-3 w-24" />
                <Sk className="h-6 w-16" />
              </div>
              <div className="rounded-2xl border border-app-border bg-app-elevated p-4 space-y-2">
                <Sk className="h-3 w-20" />
                <Sk className="h-6 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
