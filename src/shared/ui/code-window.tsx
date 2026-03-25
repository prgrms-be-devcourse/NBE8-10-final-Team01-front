import type { ReactNode } from "react";

export function CodeWindow({
  title,
  code,
  footer,
}: {
  title: string;
  code: string;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-950 text-zinc-50">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-zinc-100">
        <code>{code}</code>
      </pre>
      {footer ? (
        <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
