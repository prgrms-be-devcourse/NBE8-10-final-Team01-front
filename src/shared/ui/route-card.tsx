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
      className="group rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-zinc-500"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
        <span className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-500">
          {meta}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
      <span className="mt-4 inline-flex text-sm font-medium text-zinc-950 group-hover:underline">
        화면 열기
      </span>
    </Link>
  );
}
