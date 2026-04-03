"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  MyBattleResultItem,
  MyBattleResultsResponse,
  RoomResponse,
  SessionResponse,
} from "@/shared/api/contracts";

import ProfilePane from "@/features/home/components/profile-pane";
import QuickMenuPane, {
  type QuickMenuTreeItem,
} from "@/features/home/components/quick-menu-pane";
import SessionContext from "@/features/layout/session-context";

const PREVIEW_RESULTS_SIZE = 5;

interface BattleSidebarState {
  status: RoomResponse["status"];
  remainingTime: string;
  participants: RoomResponse["participants"];
  myStatus: string | null;
  myUserId: number | null;
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

  const payload = (await response.json().catch(() => null)) as MyBattleResultsResponse | null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
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
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(true);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(true);
  const [session, setSession] = useState<SessionResponse>(initialSession);
  const [sessionLoaded, setSessionLoaded] = useState(true);
  const [recentResults, setRecentResults] = useState<MyBattleResultItem[]>([]);
  const [resultsPreviewMessage, setResultsPreviewMessage] = useState(
    "로그인 후 최근 전적을 확인할 수 있습니다.",
  );
  const [resultsPreviewError, setResultsPreviewError] = useState<string | null>(null);
  const [battleSidebarState, setBattleSidebarState] = useState<BattleSidebarState | null>(null);
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

  useEffect(() => {
    // 라우트 이동마다 재조회하지 않고, 탭 복귀 시점에만 세션을 최신화한다.
    const onWindowFocus = () => {
      void refreshSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession]);

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

    const poll = async () => {
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
      const me = payload.participants.find((item) => item.userId === memberId) ?? null;

      setBattleSidebarState({
        status: payload.status,
        remainingTime: formatRemainingTime(payload.timerEnd),
        participants: payload.participants,
        myStatus: me?.status ?? null,
        myUserId: memberId,
      });
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [pathname, session.authenticated, session.member]);

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
      const { ok, status, payload } = await readMyBattleResultsPreview(PREVIEW_RESULTS_SIZE);

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
        setResultsPreviewError(payload?.msg ?? "최근 전적을 불러오지 못했습니다.");
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
    previewPlayedCount > 0 ? Math.round((previewSolvedCount / previewPlayedCount) * 100) : 0;
  const previewScoreDelta = recentResults.reduce((acc, item) => acc + item.scoreDelta, 0);
  const previewScoreDeltaLabel =
    previewScoreDelta > 0 ? `+${previewScoreDelta}` : String(previewScoreDelta);
  const layoutColumnsClass = isQuickMenuOpen
    ? isProfilePanelOpen
      ? "grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_250px] xl:grid-cols-[260px_minmax(0,1fr)_290px] 2xl:grid-cols-[290px_minmax(1200px,1fr)_320px]"
      : "grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_38px] xl:grid-cols-[260px_minmax(0,1fr)_38px] 2xl:grid-cols-[290px_minmax(1200px,1fr)_38px]"
    : isProfilePanelOpen
      ? "grid-cols-1 md:grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_250px] xl:grid-cols-[48px_minmax(0,1fr)_290px] 2xl:grid-cols-[48px_minmax(1200px,1fr)_320px]"
      : "grid-cols-1 md:grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_38px] xl:grid-cols-[48px_minmax(0,1fr)_38px] 2xl:grid-cols-[48px_minmax(1200px,1fr)_38px]";

  const projectTreeItems = useMemo<QuickMenuTreeItem[]>(() => {
    const isCurrent = (href: string) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

    return [
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
  }, [pathname]);

  const isFullBleedCenter =
    pathname === "/" ||
    pathname === "/signup" ||
    pathname === "/login" ||
    pathname === "/problems" ||
    pathname === "/mypage" ||
    pathname.startsWith("/battle/rooms/");

  return (
    <SessionContext.Provider value={{ session, sessionLoaded, refreshSession, applySession }}>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#1e1f22]">
        <div className={`grid h-full w-full ${layoutColumnsClass}`}>
          <QuickMenuPane
            isQuickMenuOpen={isQuickMenuOpen}
            onToggleQuickMenu={() => setIsQuickMenuOpen((current) => !current)}
            sessionAuthenticated={session.authenticated}
            projectTreeItems={projectTreeItems}
          />

          <section className="min-h-0 overflow-hidden bg-[#1e1f22]">
            {isFullBleedCenter ? (
              <div className="h-full min-h-0">{children}</div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">{children}</div>
              </div>
            )}
          </section>

          <ProfilePane
            isProfilePanelOpen={isProfilePanelOpen}
            onToggleProfilePanel={() => setIsProfilePanelOpen((current) => !current)}
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
