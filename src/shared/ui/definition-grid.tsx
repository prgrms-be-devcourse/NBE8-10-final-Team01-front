import type { ReactNode } from "react";

export function DefinitionGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4"
        >
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm leading-7 text-zinc-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
