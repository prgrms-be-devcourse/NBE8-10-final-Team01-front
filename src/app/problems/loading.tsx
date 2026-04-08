function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function ProblemsLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-24 rounded-full" />
        <Sk className="h-9 w-1/2" />
        <Sk className="h-4 w-full max-w-md" />
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

      {/* 검색 / 필터 */}
      <div className="flex gap-3">
        <Sk className="h-10 flex-1 rounded-xl" />
        <Sk className="h-10 w-32 rounded-xl" />
      </div>

      {/* 문제 목록 테이블 */}
      <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden">
        {/* 헤더 */}
        <div className="flex gap-4 px-5 py-3 border-b border-app-border">
          <Sk className="h-3 w-8" />
          <Sk className="h-3 w-32" />
          <Sk className="h-3 w-16 ml-auto" />
          <Sk className="h-3 w-12" />
        </div>
        {/* 행 */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-app-border last:border-0">
            <Sk className="h-4 w-8" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-5 w-16 rounded-full ml-auto" />
            <Sk className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
