function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function MyPageLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-20 rounded-full" />
        <Sk className="h-9 w-1/3" />
        <Sk className="h-4 w-64" />
      </div>

      {/* 프로필 카드 */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-6">
        <div className="flex items-center gap-5">
          <Sk className="h-16 w-16 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Sk className="h-6 w-36" />
            <Sk className="h-4 w-48" />
          </div>
          <Sk className="h-9 w-24 rounded-2xl" />
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

      {/* 배틀 히스토리 */}
      <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden">
        <div className="flex gap-4 px-5 py-3 border-b border-app-border">
          <Sk className="h-3 w-24" />
          <Sk className="h-3 w-20 ml-auto" />
          <Sk className="h-3 w-16" />
          <Sk className="h-3 w-14" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-app-border last:border-0">
            <Sk className="h-4 w-32" />
            <Sk className="h-5 w-16 rounded-full ml-auto" />
            <Sk className="h-4 w-16" />
            <Sk className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
