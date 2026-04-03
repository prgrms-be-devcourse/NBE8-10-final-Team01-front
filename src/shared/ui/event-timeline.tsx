const toneByType: Record<string, string> = {
  BATTLE_STARTED: "border-app-success/35 bg-app-success/10 text-app-success",
  SUBMISSION: "border-sky-400/35 bg-sky-400/10 text-sky-300",
  PARTICIPANT_DONE: "border-indigo-400/35 bg-indigo-400/10 text-indigo-300",
  BATTLE_FINISHED: "border-app-border-strong bg-app-elevated text-app-primary",
  CODE_UPDATE: "border-app-warn/35 bg-app-warn/10 text-app-warn",
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
          "border-app-border bg-app-elevated text-app-secondary";

        return (
          <li
            key={`${event.timestamp}-${event.type}-${event.headline}`}
            className="rounded-2xl border border-app-border bg-app-surface p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                {event.timestamp}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
              >
                {event.type}
              </span>
            </div>
            <p className="mt-3 font-medium text-app-primary">{event.headline}</p>
            <p className="mt-2 text-sm leading-6 text-app-secondary">{event.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
