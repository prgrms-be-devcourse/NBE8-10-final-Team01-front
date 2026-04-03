import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className = "",
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  tone?: "default" | "dark";
}) {
  const rootToneClass =
    tone === "dark"
      ? "border-app-border bg-app-surface text-app-primary"
      : "border-app-border bg-app-elevated text-app-primary";
  const eyebrowToneClass = "text-app-dim";
  const titleToneClass = "text-app-primary";
  const descriptionToneClass = tone === "dark" ? "text-app-secondary" : "text-app-muted";

  return (
    <section
      className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${rootToneClass} ${className}`.trim()}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${eyebrowToneClass}`}>
        {eyebrow}
      </p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${titleToneClass}`}>
            {title}
          </h1>
          <p className={`mt-3 text-sm leading-7 sm:text-base ${descriptionToneClass}`}>
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
