function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function LoginLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        {/* 제목 */}
        <div className="space-y-2 text-center">
          <Sk className="mx-auto h-7 w-32" />
          <Sk className="mx-auto h-4 w-48" />
        </div>

        {/* 폼 */}
        <div className="rounded-2xl border border-app-border bg-app-surface p-6 space-y-4">
          <div className="space-y-1">
            <Sk className="h-3 w-12" />
            <Sk className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1">
            <Sk className="h-3 w-16" />
            <Sk className="h-10 w-full rounded-xl" />
          </div>
          <Sk className="h-10 w-full rounded-2xl" />
        </div>

        <Sk className="mx-auto h-4 w-40" />
      </div>
    </div>
  );
}
