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
      ? "rounded-2xl border border-zinc-700 bg-[#171c26] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
      : "rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm";
  const titleClass = variant === "dark" ? "text-zinc-100" : "text-zinc-950";
  const descriptionClass = variant === "dark" ? "text-zinc-400" : "text-zinc-600";

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
