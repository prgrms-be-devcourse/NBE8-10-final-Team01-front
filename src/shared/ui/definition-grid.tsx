import type { ReactNode } from "react";

export function DefinitionGrid({
  items,
  compact = false,
  variant = "default",
}: {
  items: Array<{ label: string; value: ReactNode }>;
  compact?: boolean;
  variant?: "default" | "dark";
}) {
  const cardClass =
    variant === "dark"
      ? "rounded-2xl border border-app-border bg-app-elevated"
      : "rounded-2xl border border-app-border bg-app-surface";
  const labelClass = "text-app-dim";
  const valueClass = variant === "dark" ? "text-app-primary" : "text-app-secondary";

  return (
    <dl className={`grid sm:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`${cardClass} ${compact ? "p-3" : "p-4"}`}
        >
          <dt className={`text-xs font-semibold uppercase tracking-[0.2em] ${labelClass}`}>
            {item.label}
          </dt>
          <dd className={`mt-1.5 text-sm ${valueClass} ${compact ? "leading-6" : "leading-7"}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
