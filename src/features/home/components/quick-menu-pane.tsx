import Link from "next/link";

export type QuickMenuTreeIcon =
  | "root"
  | "folder"
  | "folderAccent"
  | "package"
  | "class"
  | "file"
  | "fileAccent";

export interface QuickMenuTreeItem {
  key: string;
  label: string;
  depth: number;
  icon: QuickMenuTreeIcon;
  hasChildren?: boolean;
  expanded?: boolean;
  subtitle?: string;
  rowTone?: "amber" | "green" | "selected";
  href?: string;
}

const ideRailTopItems = [
  { icon: "project", title: "Project" },
  { icon: "sliders", title: "Services" },
  { icon: "branch", title: "Git" },
  { icon: "layout", title: "Layout" },
  { icon: "more", title: "More" },
];

const ideRailBottomItems = [
  { icon: "cube", title: "AI" },
  { icon: "tools", title: "Tools" },
  { icon: "play", title: "Run" },
  { icon: "terminal", title: "Terminal" },
  { icon: "issue", title: "Problems" },
  { icon: "nodes", title: "Connections" },
];

function renderRailIcon(name: string) {
  const baseClass = "h-4 w-4";

  switch (name) {
    case "project":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path
            d="M2 4.5h4l1.1 1.2H14v6.8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M2.2 6h11.6" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case "sliders":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path
            d="M2 5.2h12M2 10.8h12"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="6" cy="5.2" r="1.6" fill="var(--app-bg-surface)" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="10" cy="10.8" r="1.6" fill="var(--app-bg-surface)" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "branch":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="4" cy="3.8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="11.8" cy="6.8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8.2" cy="12.2" r="1.3" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M5.3 4.4c2 .2 3.4.7 4.8 1.6M11 8c-.5 1.5-1.3 2.4-2.2 3.2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "layout":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2.2 7.8h11.6M7.8 2.2v11.6" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case "more":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="4" cy="8" r="1" fill="currentColor" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
          <circle cx="12" cy="8" r="1" fill="currentColor" />
        </svg>
      );
    case "cube":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M8 2.4 12.8 5v6L8 13.6 3.2 11V5L8 2.4Z" stroke="currentColor" strokeWidth="1.1" />
          <path d="m8 2.4 4.8 2.6L8 7.5 3.2 5 8 2.4ZM8 7.5V13.6" stroke="currentColor" strokeWidth="1.1" />
          <path d="m12.2 2.2.8.8m0 0 .8-.8M13 3v1.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="m4 5 7 7M11.5 4.5a2 2 0 0 0-2.6 2.6l2.6-2.6ZM3.2 10.8l2-2L7 10.6l-2 2-1.8-1.8Z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m9 3 1.2 1.2M8 4l1.2 1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M4.2 3.8h7.6v8.4H4.2z" stroke="currentColor" strokeWidth="1.1" transform="rotate(-30 8 8)" />
          <path d="m6.6 5.9 4 2.1-4 2.1V5.9Z" fill="currentColor" />
        </svg>
      );
    case "terminal":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
          <path d="m5.1 6.7 2 1.5-2 1.5M8.8 9.8h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "issue":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 5.4v3.2M8 11h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "nodes":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="11.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="11.3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6.4 5.2h3.6M10.8 6.8l-2 3.1M6.8 10l-1.2-3.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function renderProjectTreeIcon(icon: QuickMenuTreeIcon) {
  switch (icon) {
    case "class":
      return (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-app-accent/60 text-[8px] font-semibold leading-none text-app-accent-soft">
          C
        </span>
      );
    case "package":
      return (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-app-accent-soft">
          <path d="M2.2 5h3.2l.9.9h7.5v6.1a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V5Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "folderAccent":
      return (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-app-warn">
          <path d="M2.2 4.8h3.4l1 1h7.2v6.2a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V4.8Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "root":
    case "folder":
      return (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-app-secondary">
          <path d="M2.2 4.8h3.4l1 1h7.2v6.2a1.3 1.3 0 0 1-1.3 1.3H3.5A1.3 1.3 0 0 1 2.2 12V4.8Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "fileAccent":
      return (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-app-accent-soft">
          <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "file":
    default:
      return (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-app-secondary">
          <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
  }
}

interface QuickMenuPaneProps {
  isQuickMenuOpen: boolean;
  onToggleQuickMenu: () => void;
  sessionAuthenticated: boolean;
  projectTreeItems: QuickMenuTreeItem[];
  pathname: string;
}

export default function QuickMenuPane({
  isQuickMenuOpen,
  onToggleQuickMenu,
  sessionAuthenticated,
  projectTreeItems,
  pathname,
}: QuickMenuPaneProps) {
  const isCurrent = (href: string | undefined) => {
    if (!href) return false;
    return href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="min-h-0 border-b border-app-border-strong/80 bg-app-elevated md:border-b-0 md:border-r">
      <div className={`grid h-full ${isQuickMenuOpen ? "grid-cols-[48px_minmax(0,1fr)]" : "grid-cols-[48px]"}`}>
        <div className="flex min-h-0 flex-col items-center justify-between border-r border-app-border-strong/80 bg-app-rail py-2">
          <div className="flex flex-col items-center gap-2">
            {ideRailTopItems.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (item.icon === "project") {
                    onToggleQuickMenu();
                  }
                }}
                title={item.title}
                aria-label={item.title}
                className={`h-8 w-8 rounded-md border text-[10px] font-semibold tracking-wide transition ${
                  item.icon === "project" && isQuickMenuOpen
                    ? "border-app-accent/70 bg-app-accent/15 text-app-accent-soft"
                    : item.icon === "project"
                      ? "border-app-border-strong bg-app-elevated/95 text-app-primary"
                      : "border-transparent text-app-muted hover:bg-app-elevated/90 hover:text-app-secondary"
                }`}
              >
                <span className="flex items-center justify-center">{renderRailIcon(item.icon)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            {ideRailBottomItems.map((item) => (
              <button
                key={item.title}
                type="button"
                title={item.title}
                aria-label={item.title}
                className="h-8 w-8 rounded-md border border-transparent text-[10px] font-semibold tracking-wide text-app-dim transition hover:bg-app-elevated/90 hover:text-app-secondary"
              >
                <span className="flex items-center justify-center">{renderRailIcon(item.icon)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`min-h-0 flex-col ${isQuickMenuOpen ? "flex" : "hidden"}`}>
          <div className="flex h-12 items-center justify-between border-b border-app-border-strong/80 px-4">
            <p className="text-sm font-semibold text-app-primary">BRACKET {}</p>
            <span className="text-xs text-app-dim">▼</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-sm text-app-secondary">
            {projectTreeItems.map((item) => {
              const rowToneClass =
                item.rowTone === "amber"
                  ? "bg-app-warn/15"
                  : item.rowTone === "green"
                    ? "bg-app-success/15"
                    : isCurrent(item.href)
                      ? "bg-app-accent/20"
                      : "hover:bg-app-elevated/90";

              const content = (
                <div
                  className={`flex h-7 items-center gap-1.5 rounded-sm px-1.5 ${rowToneClass}`}
                  style={{ paddingLeft: `${item.depth * 8 + 4}px` }}
                >
                  <span className="inline-flex w-3 items-center justify-center text-[10px] text-app-dim">
                    {item.hasChildren ? (item.expanded ? "▾" : "▸") : ""}
                  </span>
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                    {renderProjectTreeIcon(item.icon)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-app-primary">
                    {item.label}
                  </span>
                  {item.subtitle ? (
                    <span className="truncate pl-1 text-[12px] text-app-dim">{item.subtitle}</span>
                  ) : null}
                </div>
              );

              if (item.href) {
                const href =
                  item.href === "/"
                    ? "/"
                    : !sessionAuthenticated
                      ? `/login?next=${encodeURIComponent(item.href)}`
                      : item.href;

                return (
                  <Link key={item.key} href={href} prefetch={false}>
                    {content}
                  </Link>
                );
              }

              return <div key={item.key}>{content}</div>;
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
