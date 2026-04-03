import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  children,
  className = "",
  variant = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "dark";
}) {
  const panelClass =
    variant === "dark"
      ? "rounded-2xl border border-app-border bg-app-surface p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
      : "rounded-2xl border border-app-border bg-app-elevated p-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]";
  const titleClass = "text-app-primary";
  const descriptionClass = variant === "dark" ? "text-app-muted" : "text-app-secondary";

  return (
    <section
      className={`${panelClass} ${className}`.trim()}
    >
      <div className="mb-4">
        <h2 className={`text-lg font-semibold ${titleClass}`}>{title}</h2>
        {description ? (
          <p className={`mt-1 text-sm leading-6 ${descriptionClass}`}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
