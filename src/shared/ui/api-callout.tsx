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
    <div className="rounded-2xl border border-dashed border-zinc-400 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-zinc-900 px-2 py-1 font-semibold text-zinc-50">
          {method}
        </span>
        <code className="text-zinc-900">{path}</code>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{note}</p>
    </div>
  );
}
