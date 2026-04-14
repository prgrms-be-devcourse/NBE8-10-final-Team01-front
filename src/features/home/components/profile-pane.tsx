import Link from "next/link";

import type { SessionResponse } from "@/shared/api/contracts";
import { StatusPill } from "@/shared/ui";
import { formatRoleLabel } from "@/shared/utils/format-role-label";
import type { NotificationItem } from "@/features/layout/ide-shell";

const ideDbRailTopItems = [
  { icon: "notifications", title: "알림" },
  { icon: "search", title: "검색" },
  { icon: "database", title: "데이터베이스" },
  { icon: "gamepad", title: "게임" },
  { icon: "blocks", title: "서비스" },
  { icon: "docs", title: "문서" },
  { icon: "users", title: "사용자" },
  { icon: "cloud", title: "클라우드" },
  { icon: "link", title: "연결" },
];

const ideDbRailBottomItems = [{ icon: "hammer", title: "도구" }];

function renderDbRailIcon(name: string) {
  const baseClass = "h-5 w-5";

  switch (name) {
    case "notifications":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M8 3a3 3 0 0 0-3 3v2.2l-1 1.6h8l-1-1.6V6a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="7" cy="7" r="3.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="m10 10 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "database":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <ellipse cx="8" cy="4.1" rx="4.7" ry="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3.3 4.1v4.8c0 1.1 2.1 2 4.7 2s4.7-.9 4.7-2V4.1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "gamepad":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <rect x="3" y="6.2" width="10" height="5.8" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.4 9h2.2M6.5 7.9v2.2M10.6 8.4h.01M11.8 9.6h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "blocks":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <rect x="2.4" y="2.4" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="8.8" y="2.4" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="5.6" y="8.8" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "docs":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 2.5V6h3M5.2 8.2h5.6M5.2 10.2h5.6" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <circle cx="6.1" cy="6.1" r="2.1" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="11.1" cy="6.7" r="1.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3.4 12c.5-1.7 1.6-2.7 2.9-2.7s2.4 1 2.9 2.7M9 12.1c.4-1.3 1.2-2.1 2.2-2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M4.8 11.8h6a2.2 2.2 0 1 0-.4-4.4 3.1 3.1 0 0 0-5.9.8 1.9 1.9 0 0 0 .3 3.6Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="M6.5 9.5 9.5 6.5M5.3 11a2.3 2.3 0 0 1 0-3.2l1.5-1.5a2.3 2.3 0 1 1 3.2 3.2l-.6.6M10.7 5a2.3 2.3 0 0 1 0 3.2l-1.5 1.5a2.3 2.3 0 1 1-3.2-3.2l.6-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "hammer":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={baseClass}>
          <path d="m9.2 3.2 3.1 3.1M4.1 12.2 9.9 6.4 7.6 4.1 1.8 9.9l2.3 2.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

interface ProfilePaneProps {
  isProfilePanelOpen: boolean;
  onToggleProfilePanel: () => void;
  isNotificationPanelOpen: boolean;
  onToggleNotificationPanel: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  session: SessionResponse;
  battleSidebarState?: {
    status: "WAITING" | "PLAYING" | "FINISHED";
    remainingTime: string;
    participants: Array<{
      userId: number;
      nickname: string;
      status: "READY" | "PLAYING" | "SOLVED" | "ABANDONED" | "TIMEOUT" | "QUIT";
    }>;
    myStatus: string | null;
    myUserId: number | null;
    isJoining: boolean;
  } | null;
  previewPlayedCount: number;
  previewSolvedCount: number;
  previewWinRate: number;
  previewScoreDeltaLabel: string;
  resultsPreviewMessage: string;
  resultsPreviewError: string | null;
  isBusy: boolean;
  onLogout: () => void;
}

export default function ProfilePane({
  isProfilePanelOpen,
  onToggleProfilePanel,
  isNotificationPanelOpen,
  onToggleNotificationPanel,
  notifications,
  onMarkNotificationRead,
  session,
  battleSidebarState,
  previewPlayedCount,
  previewSolvedCount,
  previewWinRate,
  previewScoreDeltaLabel,
  resultsPreviewMessage,
  resultsPreviewError,
  isBusy,
  onLogout,
}: ProfilePaneProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const battleStatusTone =
    battleSidebarState?.status === "PLAYING"
      ? "success"
      : battleSidebarState?.status === "WAITING"
        ? "warn"
        : "default";

  const participantTone = (status: string) => {
    if (status === "PLAYING" || status === "READY") {
      return "success" as const;
    }

    if (status === "ABANDONED") {
      return "danger" as const;
    }

    return "default" as const;
  };

  const isPanelOpen = isProfilePanelOpen || isNotificationPanelOpen;

  return (
    <aside className="min-h-0 bg-app-elevated md:col-span-2 lg:col-span-1">
      <div className={`grid h-full ${isPanelOpen ? "grid-cols-[minmax(0,1fr)_44px]" : "grid-cols-[44px]"}`}>
        <div className={`min-h-0 ${isPanelOpen ? "block" : "hidden"}`}>
          {isNotificationPanelOpen ? (
            <>
              <div className="flex h-12 items-center justify-between border-b border-app-border-strong/80 px-4">
                <p className="text-sm font-semibold text-app-primary">알림</p>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-app-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="h-full overflow-y-auto p-3">
                {notifications.length === 0 ? (
                  <p className="text-center text-xs text-app-dim py-6">새 알림이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={`/battle/results/${n.roomId}`}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className={`block rounded-md border p-3 text-xs transition hover:brightness-110 ${
                          n.read
                            ? "border-app-border bg-app-base text-app-secondary"
                            : "border-app-accent/40 bg-app-accent/10 text-app-primary"
                        }`}
                      >
                        <p className="font-medium">{n.message}</p>
                        <p className="mt-1 text-app-dim">
                          {new Date(n.timestamp).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
          <div className="flex h-12 items-center justify-between border-b border-app-border-strong/80 px-4">
            <p className="text-sm font-semibold text-app-primary">프로필</p>
          </div>
          <div className="h-full overflow-y-auto p-3 text-xs text-app-secondary">
            <div className="rounded-md border border-app-border-strong/80 bg-app-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-dim">
                  계정
                </p>
                <StatusPill tone={session.authenticated ? "success" : "warn"}>
                  {session.authenticated ? "로그인됨" : "게스트"}
                </StatusPill>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-base font-semibold text-app-primary">
                  {session.member?.nickname ?? "게스트"}
                </p>
                <p className="text-app-muted">
                  {session.authenticated
                    ? formatRoleLabel(session.member?.role)
                    : "로그인이 필요합니다."}
                </p>
              </div>
            </div>

            {battleSidebarState ? (
              <div className="mt-3 rounded-md border border-app-border-strong/80 bg-app-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-dim">
                    배틀 상태
                  </p>
                  <StatusPill tone={battleStatusTone}>
                    {battleSidebarState.status}
                  </StatusPill>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                    <p className="text-[10px] text-app-dim">남은 시간</p>
                    <p className="text-sm font-semibold text-app-primary">{battleSidebarState.remainingTime}</p>
                  </div>
                  <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                    <p className="text-[10px] text-app-dim">내 상태</p>
                    <p className="text-sm font-semibold text-app-primary">
                      {battleSidebarState.isJoining ? "참가 중" : (battleSidebarState.myStatus ?? "-")}
                    </p>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {battleSidebarState.participants.map((participant) => {
                    const isMe = participant.userId === battleSidebarState.myUserId;
                    return (
                      <div
                        key={`profile-battle-participant-${participant.userId}`}
                        className={`flex items-center justify-between rounded border px-2 py-1.5 ${
                          isMe
                            ? "border-app-accent/40 bg-app-accent/10"
                            : "border-app-border bg-app-base"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-app-primary">{participant.nickname}</p>
                          {isMe ? (
                            <span className="rounded bg-app-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-app-accent-soft">
                              나
                            </span>
                          ) : null}
                        </div>
                        <StatusPill tone={participantTone(battleSidebarState.isJoining && participant.status === "ABANDONED" ? "PLAYING" : participant.status)}>
                          {battleSidebarState.isJoining && participant.status === "ABANDONED" ? "PLAYING" : participant.status}
                        </StatusPill>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-md border border-app-border-strong/80 bg-app-surface p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-dim">
                전적 요약
              </p>
              {session.authenticated ? (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                      <p className="text-[10px] text-app-dim">최근 경기</p>
                      <p className="text-sm font-semibold text-app-primary">{previewPlayedCount}</p>
                    </div>
                    <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                      <p className="text-[10px] text-app-dim">클리어</p>
                      <p className="text-sm font-semibold text-app-primary">{previewSolvedCount}</p>
                    </div>
                    <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                      <p className="text-[10px] text-app-dim">승률</p>
                      <p className="text-sm font-semibold text-app-primary">{previewWinRate}%</p>
                    </div>
                    <div className="rounded border border-app-border bg-app-base px-2 py-1.5">
                      <p className="text-[10px] text-app-dim">점수 변화</p>
                      <p className="text-sm font-semibold text-app-primary">{previewScoreDeltaLabel}</p>
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-[11px] ${
                      resultsPreviewError ? "text-app-danger" : "text-app-dim"
                    }`}
                  >
                    {resultsPreviewError ?? resultsPreviewMessage}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-app-dim">
                  로그인 후 전적 요약을 확인할 수 있습니다.
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2 font-sans">
              {session.authenticated ? (
                <>
                  <Link
                    href="/mypage"
                    className="block w-full rounded-md border border-app-border bg-app-base px-3 py-2 text-center text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                  >
                    내 프로필
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={isBusy}
                    className="w-full rounded-md bg-app-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:bg-app-elevated disabled:text-app-secondary"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="block w-full rounded-md border border-app-border bg-app-base px-3 py-2 text-center text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                  >
                    회원가입
                  </Link>
                  <Link
                    href="/login?next=/"
                    className="block w-full rounded-md bg-app-accent px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-app-accent-hover"
                  >
                    로그인
                  </Link>
                </>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-col items-center justify-between border-l border-app-border-strong/80 bg-app-rail py-2">
          <div className="flex flex-col items-center gap-2">
            {ideDbRailTopItems.map((item) => {
              const isFunctional = item.icon === "database" || item.icon === "notifications";
              const isActive =
                (item.icon === "database" && isProfilePanelOpen) ||
                (item.icon === "notifications" && isNotificationPanelOpen);
              return (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (item.icon === "database") {
                    onToggleProfilePanel();
                  } else if (item.icon === "notifications") {
                    onToggleNotificationPanel();
                  }
                }}
                title={item.title}
                aria-label={item.title}
                className={`relative h-8 w-8 rounded-md border transition ${
                  isActive
                    ? "border-app-accent/70 bg-app-accent/15 text-app-accent-soft"
                    : isFunctional
                      ? "border-app-border-strong bg-app-elevated/95 text-app-primary"
                      : "border-transparent text-app-muted hover:bg-app-elevated/90 hover:text-app-secondary"
                }`}
              >
                <span className="flex items-center justify-center">{renderDbRailIcon(item.icon)}</span>
                {item.icon === "notifications" && unreadCount > 0 && !isNotificationPanelOpen && (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-app-danger" />
                )}
              </button>
              );
            })}
          </div>
          <div className="flex flex-col items-center gap-2">
            {ideDbRailBottomItems.map((item) => (
              <button
                key={item.title}
                type="button"
                title={item.title}
                aria-label={item.title}
                className="h-8 w-8 rounded-md border border-transparent text-app-dim transition hover:bg-app-elevated/90 hover:text-app-primary"
              >
                <span className="flex items-center justify-center">{renderDbRailIcon(item.icon)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
