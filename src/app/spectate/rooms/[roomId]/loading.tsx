function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function SpectateRoomLoading() {
  return (
    <div className="space-y-8">
      {/* PageHero */}
      <div className="space-y-4 py-2">
        <Sk className="h-5 w-28 rounded-full" />
        <Sk className="h-9 w-3/5" />
        <Sk className="h-4 w-72" />
        <div className="flex gap-2">
          <Sk className="h-6 w-16 rounded-full" />
          <Sk className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* 상태 메시지 바 */}
      <div className="rounded-2xl border border-app-border bg-app-surface px-4 py-3">
        <Sk className="h-4 w-48" />
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

      {/* 코드 윈도우 그리드 (참여자별) */}
      <div className="grid gap-4 xl:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-app-border bg-app-surface overflow-hidden">
            {/* 윈도우 헤더 */}
            <div className="flex items-center gap-3 border-b border-app-border px-4 py-3 bg-app-elevated">
              <div className="flex gap-1.5">
                <Sk className="h-3 w-3 rounded-full" />
                <Sk className="h-3 w-3 rounded-full" />
                <Sk className="h-3 w-3 rounded-full" />
              </div>
              <Sk className="h-4 w-40" />
            </div>
            {/* 코드 라인 */}
            <div className="p-4 space-y-2">
              {[...Array(12)].map((_, j) => (
                <div key={j} className="flex gap-4">
                  <Sk className="h-4 w-5 shrink-0" />
                  <Sk className={`h-4 ${j % 4 === 0 ? "w-1/4" : j % 4 === 1 ? "w-3/5" : j % 4 === 2 ? "w-2/5" : "w-1/2"}`} />
                </div>
              ))}
            </div>
            {/* 윈도우 푸터 */}
            <div className="border-t border-app-border px-4 py-2">
              <Sk className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* 돌아가기 버튼 */}
      <Sk className="h-10 w-40 rounded-2xl" />
    </div>
  );
}
