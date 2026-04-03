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
        ? "border-app-success/35 bg-app-success/10 text-app-success"
        : tone === "warn"
          ? "border-app-warn/35 bg-app-warn/10 text-app-warn"
          : tone === "danger"
            ? "border-app-danger/35 bg-app-danger/10 text-app-danger"
            : "border-app-border bg-app-elevated text-app-secondary"
      : tone === "success"
        ? "border-app-success/35 bg-app-success/10 text-app-success"
        : tone === "warn"
          ? "border-app-warn/35 bg-app-warn/10 text-app-warn"
          : tone === "danger"
            ? "border-app-danger/35 bg-app-danger/10 text-app-danger"
            : "border-app-border bg-app-elevated text-app-secondary";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
