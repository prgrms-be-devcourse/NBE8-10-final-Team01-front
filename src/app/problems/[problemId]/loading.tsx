function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function ProblemSoloLoading() {
  return (
    <div className="flex h-[calc(100vh-var(--app-header-h))] gap-0 overflow-hidden -mx-4 md:-mx-6">
      {/* 왼쪽: 문제 설명 */}
      <div className="w-full max-w-[480px] border-r border-app-border bg-app-surface overflow-y-auto p-6 space-y-5 shrink-0">
        <div className="space-y-3">
          <Sk className="h-5 w-20 rounded-full" />
          <Sk className="h-7 w-3/4" />
          <div className="flex gap-2">
            <Sk className="h-5 w-16 rounded-full" />
            <Sk className="h-5 w-20 rounded-full" />
          </div>
        </div>

        <div className="space-y-2">
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-5/6" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-4/5" />
        </div>

        <div className="rounded-xl border border-app-border bg-app-elevated p-4 space-y-2">
          <Sk className="h-3 w-16" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-3/4" />
        </div>

        <div className="rounded-xl border border-app-border bg-app-elevated p-4 space-y-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-4 w-full" />
          <Sk className="h-4 w-2/3" />
        </div>
      </div>

      {/* 오른쪽: 에디터 */}
      <div className="flex-1 flex flex-col bg-app-base">
        {/* 언어 선택 바 */}
        <div className="flex items-center gap-3 border-b border-app-border px-4 py-2">
          <Sk className="h-7 w-28 rounded-lg" />
          <Sk className="h-5 w-px" />
          <Sk className="h-5 w-20" />
        </div>

        {/* 에디터 영역 */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Sk className="h-4 w-6 shrink-0" />
              <Sk className={`h-4 ${i % 3 === 0 ? "w-1/3" : i % 3 === 1 ? "w-2/3" : "w-1/2"}`} />
            </div>
          ))}
        </div>

        {/* 하단 실행 버튼 */}
        <div className="flex items-center justify-end gap-3 border-t border-app-border px-4 py-3">
          <Sk className="h-9 w-24 rounded-2xl" />
          <Sk className="h-9 w-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
