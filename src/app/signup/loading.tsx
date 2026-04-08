function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function SignupLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Sk className="mx-auto h-7 w-28" />
          <Sk className="mx-auto h-4 w-52" />
        </div>

        <div className="rounded-2xl border border-app-border bg-app-surface p-6 space-y-4">
          {["h-3 w-12", "h-3 w-20", "h-3 w-16", "h-3 w-24"].map((label, i) => (
            <div key={i} className="space-y-1">
              <Sk className={label} />
              <Sk className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Sk className="h-10 w-full rounded-2xl" />
        </div>

        <Sk className="mx-auto h-4 w-36" />
      </div>
    </div>
  );
}
