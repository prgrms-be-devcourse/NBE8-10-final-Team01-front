import type { ReactNode } from "react";

export function DefinitionGrid({
  items,
  compact = false,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  compact?: boolean;
}) {
  return (
    <dl className={`grid sm:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border border-zinc-300 bg-zinc-50 ${compact ? "p-3" : "p-4"}`}
        >
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {item.label}
          </dt>
          <dd className={`mt-1.5 text-sm text-zinc-900 ${compact ? "leading-6" : "leading-7"}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
