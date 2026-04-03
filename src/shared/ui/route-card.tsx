import Link from "next/link";

export function RouteCard({
  href,
  title,
  description,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-app-border bg-app-surface p-5 shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:border-app-accent/55"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-app-primary">{title}</h3>
        <span className="rounded-full border border-app-border px-2 py-1 text-xs text-app-dim">
          {meta}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-app-secondary">{description}</p>
      <span className="mt-4 inline-flex text-sm font-medium text-app-primary group-hover:text-app-accent-soft group-hover:underline">
        화면 열기
      </span>
    </Link>
  );
}
