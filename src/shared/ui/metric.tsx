import type { ReactNode } from "react";

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
        {label}
      </p>
      <div className="mt-2 text-2xl font-semibold text-app-primary">{value}</div>
      {hint ? <p className="mt-2 text-sm text-app-secondary">{hint}</p> : null}
    </div>
  );
}
