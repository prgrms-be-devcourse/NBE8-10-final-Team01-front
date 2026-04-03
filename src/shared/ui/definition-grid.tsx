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
      ? "rounded-2xl border border-zinc-700 bg-[#1b2130]"
      : "rounded-2xl border border-zinc-300 bg-zinc-50";
  const labelClass = variant === "dark" ? "text-zinc-500" : "text-zinc-500";
  const valueClass = variant === "dark" ? "text-zinc-100" : "text-zinc-900";

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
