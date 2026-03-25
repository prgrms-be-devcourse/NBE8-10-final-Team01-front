const toneByType: Record<string, string> = {
  BATTLE_STARTED: "border-emerald-300 bg-emerald-50 text-emerald-900",
  SUBMISSION: "border-sky-300 bg-sky-50 text-sky-900",
  PARTICIPANT_DONE: "border-indigo-300 bg-indigo-50 text-indigo-900",
  BATTLE_FINISHED: "border-zinc-400 bg-zinc-200 text-zinc-900",
  CODE_UPDATE: "border-amber-300 bg-amber-50 text-amber-900",
};

export function EventTimeline({
  events,
}: {
  events: Array<{
    timestamp: string;
    type: string;
    headline: string;
    detail: string;
  }>;
}) {
  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const toneClass =
          toneByType[event.type] ??
          "border-zinc-300 bg-zinc-100 text-zinc-800";

        return (
          <li
            key={`${event.timestamp}-${event.type}-${event.headline}`}
            className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {event.timestamp}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
              >
                {event.type}
              </span>
            </div>
            <p className="mt-3 font-medium text-zinc-950">{event.headline}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{event.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
