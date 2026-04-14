"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  BattleResultWsMessage,
  BattleStartedWsMessage,
  MyBattleResultItem,
  MyBattleResultsResponse,
  ParticipantStatusChangedWsMessage,
  RoomResponse,
  SessionResponse,
} from "@/shared/api/contracts";

import ProfilePane from "@/features/home/components/profile-pane";
import QuickMenuPane, {
  type QuickMenuTreeItem,
} from "@/features/home/components/quick-menu-pane";
import SessionContext from "@/features/layout/session-context";

const PREVIEW_RESULTS_SIZE = 5;

export interface NotificationItem {
  id: string;
  type: "BATTLE_RESULT";
  roomId: number;
  message: string;
  timestamp: number;
  read: boolean;
}

interface BattleSidebarState {
  status: RoomResponse["status"];
  timerEnd: string | null;
  remainingTime: string;
  participants: RoomResponse["participants"];
  myStatus: string | null;
  myUserId: number | null;
  isJoining: boolean;
}

function formatRemainingTime(timerEnd: string | null) {
  if (!timerEnd) {
    return "--:--";
  }

  const end = new Date(timerEnd).getTime();

  if (!Number.isFinite(end)) {
    return "--:--";
  }

  const remainingMs = Math.max(0, end - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function readSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      authenticated: false,
      member: null,
    } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
}

async function readMyBattleResultsPreview(size: number) {
  const response = await fetch(`/api/me/battle-results?page=0&size=${size}`, {
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response
    .json()
    .catch(() => null)) as MyBattleResultsResponse | null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function createBattleSidebarState(payload: RoomResponse, memberId: number): BattleSidebarState {
  const me = payload.participants.find((item) => item.userId === memberId) ?? null;

  return {
    status: payload.status,
    timerEnd: payload.timerEnd,
    remainingTime: formatRemainingTime(payload.timerEnd),
    participants: payload.participants,
    myStatus: me?.status ?? null,
    myUserId: memberId,
    isJoining: me?.status === "ABANDONED",
  };
}

function updateBattleSidebarParticipantStatus(
  current: BattleSidebarState,
  message: ParticipantStatusChangedWsMessage,
): BattleSidebarState {
  const participants = current.participants.map((participant) =>
    participant.userId === message.userId
      ? { ...participant, status: message.status }
      : participant,
  );
  const me = participants.find((participant) => participant.userId === current.myUserId) ?? null;

  return {
    ...current,
    participants,
    myStatus: me?.status ?? null,
    isJoining: me?.status === "ABANDONED",
  };
}

export default function IdeShell({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: SessionResponse;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const refreshInFlightRef = useRef<Promise<SessionResponse> | null>(null);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(true);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null);
  const [session, setSession] = useState<SessionResponse>(initialSession);
  const [sessionLoaded, setSessionLoaded] = useState(true);
  const [recentResults, setRecentResults] = useState<MyBattleResultItem[]>([]);
  const [resultsPreviewMessage, setResultsPreviewMessage] = useState(
    "로그인 후 최근 전적을 확인할 수 있습니다.",
  );
  const [resultsPreviewError, setResultsPreviewError] = useState<string | null>(
    null,
  );
  const [battleSidebarState, setBattleSidebarState] =
    useState<BattleSidebarState | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const applySession = useCallback((nextSession: SessionResponse) => {
    setSession(nextSession);
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    // router.refresh() 이후 서버에서 내려준 초기 세션을 클라이언트 전역 상태에 반영한다.
    applySession(initialSession);
  }, [applySession, initialSession]);

  const refreshSession = useCallback(async () => {
    // 중복 요청으로 세션 상태가 흔들리지 않도록 in-flight 요청을 재사용한다.
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      const nextSession = await readSession();
      setSession(nextSession);
      setSessionLoaded(true);
      return nextSession;
    })();

    refreshInFlightRef.current = task;

    try {
      return await task;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, []);

  // 최초 마운트 시 1회만 세션을 로딩한다.
  // focus/visibilitychange 마다 재조회하면 배틀룸 WebSocket heartbeat에 영향을 줄 수 있으므로 제거.
  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const battleRoomMatch = pathname.match(/^\/battle\/rooms\/(\d+)$/);

    if (!battleRoomMatch) {
      setBattleSidebarState(null);
      return;
    }

    const targetRoomId = Number(battleRoomMatch[1]);
    const memberId = session.member?.memberId ?? null;

    if (!session.authenticated || memberId === null) {
      setBattleSidebarState(null);
      return;
    }

    let active = true;
    const client = new Client({
      webSocketFactory: () =>
        new SockJS(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws`,
        ),
      reconnectDelay: 3000,
      beforeConnect: async () => {
        client.connectHeaders = {};
        try {
          const res = await fetch("/api/v1/ws/token", { method: "POST" });
          if (res.ok) {
            const data = (await res.json()) as { token: string };
            client.connectHeaders = { "X-WS-Token": data.token };
          }
        } catch {
          // 쿠키 기반 인증으로 폴백
        }
      },
      onConnect: () => {
        client.subscribe(`/topic/room/${targetRoomId}`, (frame) => {
          let payload: unknown;
          try {
            payload = JSON.parse(frame.body) as unknown;
          } catch {
            return;
          }

          if (typeof payload !== "object" || payload === null || !("type" in payload)) {
            return;
          }

          const type = (payload as { type: unknown }).type;

          if (type === "PARTICIPANT_STATUS_CHANGED") {
            const message = payload as ParticipantStatusChangedWsMessage;
            setBattleSidebarState((current) =>
              current ? updateBattleSidebarParticipantStatus(current, message) : current,
            );
            return;
          }

          if (type === "BATTLE_STARTED") {
            const message = payload as BattleStartedWsMessage;
            setBattleSidebarState((current) => {
              if (!current) {
                return current;
              }

              const nextTimerEnd =
                typeof message.timerEnd === "string" || message.timerEnd === null
                  ? message.timerEnd
                  : current.timerEnd;

              return {
                ...current,
                status: "PLAYING",
                timerEnd: nextTimerEnd,
                remainingTime: formatRemainingTime(nextTimerEnd),
              };
            });
            return;
          }

          if (type === "BATTLE_FINISHED") {
            setBattleSidebarState((current) =>
              current
                ? {
                    ...current,
                    status: "FINISHED",
                    remainingTime: formatRemainingTime(current.timerEnd),
                  }
                : current,
            );
          }
        });
      },
    });

    const loadSidebarState = async () => {
      try {
        const response = await fetch(`/api/battle/rooms/${targetRoomId}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!active) {
          return;
        }

        if (!response.ok) {
          setBattleSidebarState(null);
          return;
        }

        const payload = (await response.json()) as RoomResponse;
        setBattleSidebarState(createBattleSidebarState(payload, memberId));
        client.activate();
      } catch {
        // 네비게이션 중 fetch 취소 등 무시
      }
    };

    void loadSidebarState();

    return () => {
      active = false;
      void client.deactivate();
    };
  }, [pathname, session.authenticated, session.member]);

  useEffect(() => {
    if (!battleSidebarState?.timerEnd) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setBattleSidebarState((current) =>
        current
          ? {
              ...current,
              remainingTime: formatRemainingTime(current.timerEnd),
            }
          : current,
      );
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [battleSidebarState?.timerEnd]);

  useEffect(() => {
    const isSoloProblemRoute = /^\/problems\/\d+$/.test(pathname);
    const isBattleRoomRoute = /^\/battle\/rooms\/\d+$/.test(pathname);

    if (isSoloProblemRoute || isBattleRoomRoute) {
      setIsQuickMenuOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;

    if (!session.authenticated) {
      setRecentResults([]);
      setResultsPreviewError(null);
      setResultsPreviewMessage("로그인 후 최근 전적을 확인할 수 있습니다.");
      return () => {
        active = false;
      };
    }

    setResultsPreviewError(null);
    setResultsPreviewMessage("최근 전적을 불러오는 중입니다.");

    void (async () => {
      const { ok, status, payload } =
        await readMyBattleResultsPreview(PREVIEW_RESULTS_SIZE);

      if (!active) {
        return;
      }

      if (status === 401 || payload?.resultCode === "MEMBER_401") {
        // 401은 서버가 인증 만료/무효를 확정한 신호이므로 전역 세션을 즉시 재동기화한다.
        void refreshSession();
        setRecentResults([]);
        setResultsPreviewError(null);
        setResultsPreviewMessage(payload?.msg ?? "로그인이 필요합니다.");
        return;
      }

      if (!ok || !payload || payload.resultCode !== "200" || !payload.data) {
        setRecentResults([]);
        setResultsPreviewError(
          payload?.msg ?? "최근 전적을 불러오지 못했습니다.",
        );
        setResultsPreviewMessage(payload?.msg ?? "전적 조회에 실패했습니다.");
        return;
      }

      const loaded = payload.data.battleResults;
      setRecentResults(loaded);
      setResultsPreviewError(null);
      setResultsPreviewMessage(
        loaded.length > 0 ? payload.msg : "아직 완료한 배틀 전적이 없습니다.",
      );
    })();

    return () => {
      active = false;
    };
  }, [refreshSession, session.authenticated]);

  // 전역 WebSocket: /topic/user/{myId}/battle 구독 (배틀 결과 실시간 수신)
  useEffect(() => {
    if (!session.authenticated || !session.member) return;

    const myId = session.member.memberId;
    const client = new Client({
      webSocketFactory: () =>
        new SockJS(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws`,
        ),
      reconnectDelay: 3000,
      beforeConnect: async () => {
        client.connectHeaders = {};
        try {
          const res = await fetch("/api/v1/ws/token", { method: "POST" });
          if (res.ok) {
            const data = (await res.json()) as { token: string };
            client.connectHeaders = { "X-WS-Token": data.token };
          }
        } catch {
          // 쿠키 기반 인증으로 폴백
        }
      },
      onConnect: () => {
        client.subscribe(`/topic/user/${myId}/battle`, (frame) => {
          let payload: unknown;
          try {
            payload = JSON.parse(frame.body) as unknown;
          } catch {
            return;
          }

          if (
            typeof payload === "object" &&
            payload !== null &&
            "type" in payload &&
            (payload as { type: unknown }).type === "BATTLE_RESULT"
          ) {
            const msg = payload as BattleResultWsMessage;
            const notifMessage = `Room ${msg.roomId} 배틀이 종료되었습니다.`;
            setNotifications((prev) => [
              {
                id: crypto.randomUUID(),
                type: "BATTLE_RESULT",
                roomId: msg.roomId,
                message: notifMessage,
                timestamp: Date.now(),
                read: false,
              },
              ...prev,
            ]);
            setToast({ key: Date.now(), message: "참여했던 배틀이 종료되었습니다." });
          }
        });
      },
    });

    client.activate();

    return () => {
      void client.deactivate();
    };
  }, [session.authenticated, session.member]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      applySession({
        authenticated: false,
        member: null,
      });
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const previewPlayedCount = recentResults.length;
  const previewSolvedCount = recentResults.filter((item) => item.solved).length;
  const previewWinRate =
    previewPlayedCount > 0
      ? Math.round((previewSolvedCount / previewPlayedCount) * 100)
      : 0;
  const previewScoreDelta = recentResults.reduce(
    (acc, item) => acc + item.scoreDelta,
    0,
  );
  const previewScoreDeltaLabel =
    previewScoreDelta > 0 ? `+${previewScoreDelta}` : String(previewScoreDelta);

  const isPanelOpen = isProfilePanelOpen || isNotificationPanelOpen;

  const layoutColumnsClass = isQuickMenuOpen
    ? isPanelOpen
      ? "grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[260px_minmax(0,1fr)_280px] 2xl:grid-cols-[290px_minmax(0,1fr)_320px]"
      : "grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_38px] xl:grid-cols-[260px_minmax(0,1fr)_38px] 2xl:grid-cols-[290px_minmax(0,1fr)_38px]"
    : isPanelOpen
      ? "grid-cols-1 md:grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_240px] xl:grid-cols-[48px_minmax(0,1fr)_280px] 2xl:grid-cols-[48px_minmax(0,1fr)_320px]"
      : "grid-cols-1 md:grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_38px] xl:grid-cols-[48px_minmax(0,1fr)_38px] 2xl:grid-cols-[48px_minmax(0,1fr)_38px]";

  const projectTreeItems = useMemo<QuickMenuTreeItem[]>(() => {
    const isCurrent = (href: string) =>
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

    const items: QuickMenuTreeItem[] = [
      {
        key: "root",
        label: "BRACKET {}",
        depth: 0,
        icon: "root",
        hasChildren: true,
        expanded: true,
      },
      {
        key: "quick-menu",
        label: "퀵메뉴",
        depth: 1,
        icon: "folderAccent",
        hasChildren: true,
        expanded: true,
        rowTone: "amber",
      },
      {
        key: "home-screen",
        label: "메인",
        depth: 2,
        icon: "class",
        rowTone: isCurrent("/") ? "selected" : undefined,
        href: "/",
      },
      {
        key: "problem-list",
        label: "문제 목록",
        depth: 2,
        icon: "class",
        rowTone: isCurrent("/problems") ? "selected" : undefined,
        href: "/problems",
      },
      {
        key: "spectate-list",
        label: "관전",
        depth: 2,
        icon: "class",
        rowTone: isCurrent("/spectate") ? "selected" : undefined,
        href: "/spectate",
      },
      {
        key: "mypage",
        label: "마이페이지",
        depth: 2,
        icon: "class",
        rowTone: isCurrent("/mypage") ? "selected" : undefined,
        href: "/mypage",
      },
    ];

    if (session.member?.role === "ROLE_ADMIN") {
      items.push({
        key: "admin-page",
        label: "관리자페이지",
        depth: 2,
        icon: "class",
        rowTone: isCurrent("/admin") ? "selected" : undefined,
        href: "/admin",
      });
    }

    return items;
  }, [pathname, session.member?.role]);

  const isFullBleedCenter =
    pathname === "/" ||
    pathname === "/signup" ||
    pathname === "/login" ||
    pathname === "/problems" ||
    pathname.startsWith("/problems/") ||
    pathname.startsWith("/admin") ||
    pathname === "/mypage" ||
    pathname.startsWith("/battle/rooms/") ||
    pathname.startsWith("/spectate/rooms/");

  return (
    <SessionContext.Provider
      value={{ session, sessionLoaded, refreshSession, applySession }}
    >
      {toast && (
        <div
          key={toast.key}
          className="animate-toast-pop pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center"
        >
          <div className="rounded-xl border border-app-accent/40 bg-app-surface px-5 py-3 text-sm font-medium text-app-primary shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            {toast.message}
          </div>
        </div>
      )}
      <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-app-base">
        <div className={`grid h-full w-full ${layoutColumnsClass}`}>
          <QuickMenuPane
            isQuickMenuOpen={isQuickMenuOpen}
            onToggleQuickMenu={() => setIsQuickMenuOpen((current) => !current)}
            sessionAuthenticated={session.authenticated}
            projectTreeItems={projectTreeItems}
          />

          <section className="h-full min-h-0 overflow-hidden bg-app-base">
            {isFullBleedCenter ? (
              <div className="h-full min-h-0">{children}</div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                  {children}
                </div>
              </div>
            )}
          </section>

          <ProfilePane
            isProfilePanelOpen={isProfilePanelOpen}
            onToggleProfilePanel={() => {
              setIsProfilePanelOpen((current) => !current);
              setIsNotificationPanelOpen(false);
            }}
            isNotificationPanelOpen={isNotificationPanelOpen}
            onToggleNotificationPanel={() => {
              setIsNotificationPanelOpen((current) => !current);
              setIsProfilePanelOpen(false);
            }}
            notifications={notifications}
            onMarkNotificationRead={handleMarkNotificationRead}
            session={session}
            battleSidebarState={battleSidebarState}
            previewPlayedCount={previewPlayedCount}
            previewSolvedCount={previewSolvedCount}
            previewWinRate={previewWinRate}
            previewScoreDeltaLabel={previewScoreDeltaLabel}
            resultsPreviewMessage={resultsPreviewMessage}
            resultsPreviewError={resultsPreviewError}
            isBusy={isLoggingOut}
            onLogout={() => {
              void handleLogout();
            }}
          />
        </div>
      </div>
    </SessionContext.Provider>
  );
}
