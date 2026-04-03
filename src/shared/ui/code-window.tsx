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
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-base text-app-primary">
      <div className="border-b border-app-border px-4 py-3 text-sm font-medium text-app-secondary">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-app-primary">
        <code>{code}</code>
      </pre>
      {footer ? (
        <div className="border-t border-app-border px-4 py-3 text-xs text-app-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
