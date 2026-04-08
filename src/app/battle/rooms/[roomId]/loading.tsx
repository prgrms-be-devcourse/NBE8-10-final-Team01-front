function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function BattleRoomLoading() {
  return (
    <div className="flex h-[calc(100vh-var(--app-header-h))] gap-0 overflow-hidden -mx-4 md:-mx-6">
      {/* 왼쪽: 문제 설명 */}
      <div className="w-full max-w-[460px] border-r border-app-border bg-app-surface overflow-y-auto p-6 space-y-5 shrink-0">
        {/* 타이머 + 참여자 */}
        <div className="flex items-center justify-between">
          <Sk className="h-8 w-20" />
          <div className="flex gap-2">
            <Sk className="h-6 w-24 rounded-full" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        </div>

        <div className="space-y-3">
          <Sk className="h-7 w-3/4" />
          <div className="flex gap-2">
            <Sk className="h-5 w-16 rounded-full" />
            <Sk className="h-5 w-20 rounded-full" />
          </div>
        </div>

        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Sk key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
          ))}
        </div>

        <div className="rounded-xl border border-app-border bg-app-elevated p-4 space-y-2">
          <Sk className="h-3 w-16" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-4/5" />
        </div>

        <div className="rounded-xl border border-app-border bg-app-elevated p-4 space-y-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-4 w-3/4" />
        </div>
      </div>

      {/* 오른쪽: 에디터 */}
      <div className="flex-1 flex flex-col bg-app-base">
        {/* 언어 선택 바 */}
        <div className="flex items-center gap-3 border-b border-app-border px-4 py-2">
          <Sk className="h-7 w-28 rounded-lg" />
          <div className="ml-auto flex gap-2">
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        </div>

        {/* 에디터 영역 */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Sk className="h-4 w-6 shrink-0" />
              <Sk className={`h-4 ${i % 4 === 0 ? "w-1/4" : i % 4 === 1 ? "w-3/5" : i % 4 === 2 ? "w-1/2" : "w-2/5"}`} />
            </div>
          ))}
        </div>

        {/* 제출 버튼 */}
        <div className="flex items-center justify-between border-t border-app-border px-4 py-3">
          <Sk className="h-4 w-32" />
          <div className="flex gap-2">
            <Sk className="h-9 w-24 rounded-2xl" />
            <Sk className="h-9 w-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
