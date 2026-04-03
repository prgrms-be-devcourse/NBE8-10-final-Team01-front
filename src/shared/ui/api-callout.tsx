export function ApiCallout({
  method,
  path,
  note,
}: {
  method: string;
  path: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-app-border-strong bg-app-elevated p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-app-base px-2 py-1 font-semibold text-app-accent-soft">
          {method}
        </span>
        <code className="text-app-primary">{path}</code>
      </div>
      <p className="mt-2 text-sm leading-6 text-app-secondary">{note}</p>
    </div>
  );
}
