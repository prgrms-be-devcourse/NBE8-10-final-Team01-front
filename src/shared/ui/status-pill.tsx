import type { ReactNode } from "react";

export function StatusPill({
  children,
  tone = "default",
  variant = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warn" | "danger";
  variant?: "default" | "dark";
}) {
  const toneClass =
    variant === "dark"
      ? tone === "success"
        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
        : tone === "warn"
          ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
          : tone === "danger"
            ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
            : "border-zinc-700 bg-[#1f2736] text-zinc-200"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : tone === "danger"
            ? "border-rose-300 bg-rose-50 text-rose-900"
            : "border-zinc-300 bg-zinc-100 text-zinc-800";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
