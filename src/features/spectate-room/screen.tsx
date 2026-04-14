"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  BattleStartedWsMessage,
  CodeSyncWsMessage,
  CodeUpdateWsMessage,
  ParticipantStatusChangedWsMessage,
  ProblemDetailResponse,
  RoomResponse,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
import {
  ConfirmDialog,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

import { getSpectateRoom } from "./data";

const SPECTATE_ACCESS_KEY = "spectate-from-hub";

function getParticipantStatusTone(status: string) {
  if (status === "PLAYING") {
    return "success" as const;
  }

  if (status === "ABANDONED") {
    return "danger" as const;
  }

  return "default" as const;
}

export default function SpectateRoomScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [accessGranted, setAccessGranted] = useState(false);
  const accessCheckedRef = useRef(false);
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [message, setMessage] = useState("관전 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [battleFinished, setBattleFinished] = useState(false);
  const [codeByUserId, setCodeByUserId] = useState<Record<number, string>>({});
  const [lastUpdatedByUserId, setLastUpdatedByUserId] = useState<Record<number, string>>({});
  const stompClientRef = useRef<Client | null>(null);
  const participantsRef = useRef<RoomResponse["participants"]>([]);
  const roomStatusRef = useRef<RoomResponse["status"] | null>(null);

  useEffect(() => {
    if (accessCheckedRef.current) return;
    accessCheckedRef.current = true;

    const token = sessionStorage.getItem(SPECTATE_ACCESS_KEY);
    if (!token) {
      router.replace("/spectate");
      return;
    }

    sessionStorage.removeItem(SPECTATE_ACCESS_KEY);
    setAccessGranted(true);
  }, [router]);

  useEffect(() => {
    if (!accessGranted || !sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        if (!active) return;
        setRequiresLogin(true);
        setMessage("관전 상세 화면은 로그인 후 이용할 수 있습니다.");
        return;
      }

      if (!active) return;

      setRequiresLogin(false);

      const response = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        void refreshSession();
        if (!active) return;
        setRequiresLogin(true);
        setMessage("관전 상세 화면은 로그인 후 이용할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        const fallback = getSpectateRoom(roomId);

        if (fallback) {
          if (!active) return;
          setMessage("백엔드 연결에 실패해 샘플 관전 데이터를 표시합니다.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        if (!active) return;
        setError(payload?.message ?? "관전 상세 정보를 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await response.json()) as RoomResponse;
      if (!active) return;

      setRoom(nextRoom);
      participantsRef.current = nextRoom.participants;
      roomStatusRef.current = nextRoom.status;

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        if (!active) return;
        setProblem((await problemResponse.json()) as ProblemDetailResponse);
      }

      if (!active) return;
      setMessage("실시간 관전 중입니다.");
    })();

    return () => {
      active = false;
    };
  }, [accessGranted, refreshSession, roomId, session.authenticated, sessionLoaded]);

  useEffect(() => {
    if (!room || !stompClientRef.current?.connected) return;
    if (roomStatusRef.current === "FINISHED") return;

    for (const participant of room.participants) {
      stompClientRef.current.publish({
        destination: `/app/room/${roomId}/code/sync`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: participant.userId }),
      });
    }
  }, [room, roomId]);

  useEffect(() => {
    if (!session.authenticated) return;

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws`),
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
          console.warn("[WS] 토큰 발급 실패, 쿠키 기반 인증으로 재시도합니다.");
        }
      },
      onConnect: () => {
        client.subscribe(`/topic/room/${roomId}`, (frame) => {
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
            const msg = payload as ParticipantStatusChangedWsMessage;
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                participants: current.participants.map((participant) =>
                  participant.userId === msg.userId
                    ? { ...participant, status: msg.status }
                    : participant,
                ),
              };

              participantsRef.current = nextRoom.participants;
              roomStatusRef.current = nextRoom.status;
              return nextRoom;
            });
            return;
          }

          if (type === "BATTLE_STARTED") {
            const msg = payload as BattleStartedWsMessage;
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                status: "PLAYING" as const,
                timerEnd:
                  typeof msg.timerEnd === "string" || msg.timerEnd === null
                    ? msg.timerEnd
                    : current.timerEnd,
              };

              participantsRef.current = nextRoom.participants;
              roomStatusRef.current = nextRoom.status;
              return nextRoom;
            });
            return;
          }

          if (type === "BATTLE_FINISHED") {
            setBattleFinished(true);
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                status: "FINISHED" as const,
              };

              participantsRef.current = nextRoom.participants;
              roomStatusRef.current = nextRoom.status;
              return nextRoom;
            });
          }
        });

        client.subscribe(`/topic/room/${roomId}/spectate`, (frame) => {
          let payload: unknown;
          try {
            payload = JSON.parse(frame.body) as unknown;
          } catch {
            console.warn("[Spectate WS] 메시지 파싱 실패:", frame.body);
            return;
          }

          if (typeof payload !== "object" || payload === null || !("type" in payload)) {
            return;
          }

          const type = (payload as { type: unknown }).type;
          if (type === "CODE_UPDATE" || type === "CODE_SYNC") {
            const msg = payload as CodeUpdateWsMessage | CodeSyncWsMessage;
            if (!msg.code) return;

            const now = new Date().toLocaleTimeString("ko-KR");
            setCodeByUserId((prev) => ({ ...prev, [msg.userId]: msg.code }));
            setLastUpdatedByUserId((prev) => ({ ...prev, [msg.userId]: now }));
          }
        });

        if (roomStatusRef.current !== "FINISHED") {
          for (const participant of participantsRef.current) {
            client.publish({
              destination: `/app/room/${roomId}/code/sync`,
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ targetUserId: participant.userId }),
            });
          }
        }
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      void client.deactivate();
    };
  }, [roomId, session.authenticated]);

  if (requiresLogin) {
    return (
      <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="space-y-8">
          <PageHero
            eyebrow="Spectate Room"
            title="로그인 후 관전 상세를 볼 수 있습니다."
            description="보호된 관전 방은 인증된 사용자만 입장할 수 있습니다."
            actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
          />
          <Panel title="이동" description="로그인 또는 관전 목록으로 이동">
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/login?next=${encodeURIComponent(`/spectate/rooms/${roomId}`)}`}
                className="rounded-2xl bg-app-base px-4 py-3 text-sm font-medium text-white"
              >
                로그인하러 가기
              </Link>
              <Link
                href="/spectate"
                className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
              >
                관전 목록으로 돌아가기
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const fallback = getSpectateRoom(roomId);
  const participants = room?.participants ?? fallback?.participants ?? [];
  const problemTitle = problem?.title ?? fallback?.problemTitle ?? `Room ${roomId}`;
  const receivedCodeCount = Object.keys(codeByUserId).length;
  const boardParticipants = participants.slice(0, 4);
  const boardSlots = Array.from({ length: 4 }, (_, index) => boardParticipants[index] ?? null);

  if (!fallback && !room) {
    return (
      <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="space-y-8">
          <PageHero
            eyebrow="Spectate Room"
            title="관전 상세 정보를 찾지 못했습니다."
            description="현재 roomId에 해당하는 관전 방이 없거나 응답을 불러오지 못했습니다."
            actions={<StatusPill tone="danger">Load failed</StatusPill>}
          />
          <Panel title="오류" description="응답 메시지">
            <p className="text-sm leading-7 text-app-secondary">{error ?? message}</p>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="space-y-6">
        <ConfirmDialog
          open={battleFinished}
          title="배틀이 종료되었습니다."
          description="참가자들의 최종 코드를 계속 확인하거나 관전 목록으로 돌아갈 수 있습니다."
          confirmLabel="관전 목록으로"
          cancelLabel="계속 보기"
          onConfirm={() => router.push("/spectate")}
          onCancel={() => setBattleFinished(false)}
        />

        <section className="rounded-3xl border border-app-border bg-app-elevated px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-dim">
                Spectate Board
              </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-app-secondary">
                <span className="text-lg font-semibold text-app-primary">{`Room ${roomId}`}</span>
                <span>{problemTitle}</span>
                <span>{`상태 ${room?.status ?? "PLAYING"}`}</span>
                <span>{`참가자 ${participants.length}명`}</span>
                <span>{`코드 수신 ${receivedCodeCount}`}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/spectate"
                className="rounded-2xl border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-primary transition hover:bg-app-base"
              >
                관전 목록으로 돌아가기
              </Link>
              <StatusPill tone="success">LIVE</StatusPill>
              <StatusPill>{participants.length}명 참여 중</StatusPill>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-secondary">
            {error ?? message}
          </div>
        </section>

        <section className="rounded-[2rem] border border-app-border bg-app-surface p-3 sm:p-4">
          <div className="overflow-hidden rounded-[1.75rem] border border-app-border bg-app-base">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {boardSlots.map((participant, index) => {
                const isLeftColumn = index % 2 === 0;
                const isTopRow = index < 2;
                const code = participant
                  ? codeByUserId[participant.userId] ??
                    `// ${participant.nickname}의 코드 업데이트를 기다리는 중입니다.`
                  : "// 참가자가 입장하면 이 영역에 실시간 코드가 표시됩니다.";
                const lastUpdated = participant
                  ? lastUpdatedByUserId[participant.userId] ?? "대기 중"
                  : "빈 슬롯";
                const status = participant?.status ?? "WAITING";

                return (
                  <section
                    key={participant?.userId ?? `empty-slot-${index}`}
                    className={[
                      "flex min-h-[420px] flex-col bg-app-base",
                      isLeftColumn ? "lg:border-r lg:border-app-border" : "",
                      isTopRow ? "border-b border-app-border" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <header className="flex items-center gap-3 border-b border-app-border px-4 py-3 text-sm text-app-secondary">
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-[#c85a55]" aria-hidden="true" />
                        <span className="h-3 w-3 rounded-full bg-[#c9a13d]" aria-hidden="true" />
                        <span className="h-3 w-3 rounded-full bg-[#469a57]" aria-hidden="true" />
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-3">
                        <span className="min-w-0 truncate font-semibold text-app-primary">
                          {participant?.nickname ?? `slot ${index + 1}`}
                        </span>
                        <span>{lastUpdated}</span>
                        <StatusPill tone={getParticipantStatusTone(status)} variant="dark">
                          {status}
                        </StatusPill>
                      </div>
                    </header>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex-1 rounded-2xl border border-app-border bg-app-surface p-4">
                        <pre className="h-full overflow-auto text-sm leading-6 text-app-primary">
                          <code>{code}</code>
                        </pre>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
