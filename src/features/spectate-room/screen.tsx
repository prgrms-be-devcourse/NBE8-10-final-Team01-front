"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  CodeSyncWsMessage,
  CodeUpdateWsMessage,
  ProblemDetailResponse,
  RoomResponse,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
import {
  CodeWindow,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

import { getSpectateRoom } from "./data";

export default function SpectateRoomScreen({ roomId }: { roomId: string }) {
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [message, setMessage] = useState("관전 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [codeByUserId, setCodeByUserId] = useState<Record<number, string>>({});
  const [lastUpdatedByUserId, setLastUpdatedByUserId] = useState<Record<number, string>>({});
  const stompClientRef = useRef<Client | null>(null);
  const participantsRef = useRef<RoomResponse["participants"]>([]);
  const roomStatusRef = useRef<RoomResponse["status"] | null>(null);

  // 세션 및 방 정보 로드
  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        if (!active) {
          return;
        }
        setRequiresLogin(true);
        setMessage("관전 상세는 로그인 후 접근할 수 있습니다.");
        return;
      }

      if (!active) {
        return;
      }

      setRequiresLogin(false);

      const response = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        void refreshSession();
        if (!active) {
          return;
        }
        setRequiresLogin(true);
        setMessage("관전 상세는 로그인 후 접근할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        const fallback = getSpectateRoom(roomId);

        if (fallback) {
          if (!active) {
            return;
          }
          setMessage("백엔드 연결 실패로 샘플 관전 데이터를 표시합니다.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        if (!active) {
          return;
        }
        setError(payload?.message ?? "관전 상세를 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await response.json()) as RoomResponse;
      if (!active) {
        return;
      }
      setRoom(nextRoom);
      participantsRef.current = nextRoom.participants;
      roomStatusRef.current = nextRoom.status;

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        if (!active) {
          return;
        }
        setProblem((await problemResponse.json()) as ProblemDetailResponse);
      }

      if (!active) {
        return;
      }
      setMessage("실시간 관전 중입니다.");
    })();

    return () => {
      active = false;
    };
  }, [refreshSession, roomId, session.authenticated, sessionLoaded]);

  // WebSocket: /topic/room/{roomId}/spectate 구독
  useEffect(() => {
    if (!session.authenticated) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws`),
      reconnectDelay: 3000,
      // 연결(및 재연결) 시마다 1회용 토큰을 새로 발급해 STOMP CONNECT 헤더에 주입.
      // 토큰은 30초 TTL이고 1회 사용 후 폐기되므로 재연결 시에도 반드시 새 토큰이 필요.
      // 토큰 발급 실패 시 쿠키 기반 인증(로컬 환경)으로 자동 폴백됨.
      beforeConnect: async () => {
        // 재연결 시 이전 연결에서 소비된 토큰이 재사용되지 않도록 먼저 초기화
        client.connectHeaders = {};
        try {
          const res = await fetch("/api/v1/ws/token", { method: "POST" });
          if (res.ok) {
            const data = (await res.json()) as { token: string };
            client.connectHeaders = { "X-WS-Token": data.token };
          }
        } catch {
          console.warn("[WS] 토큰 발급 실패, 쿠키 기반 인증으로 폴백");
        }
      },
      onConnect: () => {
        client.subscribe(`/topic/room/${roomId}/spectate`, (frame) => {
          let payload: unknown;
          try {
            payload = JSON.parse(frame.body) as unknown;
          } catch {
            console.warn("[Spectate WS] 메시지 파싱 실패:", frame.body);
            return;
          }

          if (
            typeof payload !== "object" ||
            payload === null ||
            !("type" in payload)
          ) {
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

        // 구독 직후 모든 참여자의 최신 코드 동기화 요청 (방이 종료된 경우 코드가 삭제됐으므로 스킵)
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
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate Room"
          title="로그인 후 관전 상세를 볼 수 있습니다."
          description="배틀 관련 API는 현재 보호된 상태입니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
        <Panel title="이동" description="보호 화면 진입 전 처리">
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
    );
  }

  const fallback = getSpectateRoom(roomId);
  const participants = room?.participants ?? fallback?.participants ?? [];
  const problemTitle = problem?.title ?? fallback?.problemTitle ?? `Room ${roomId}`;

  if (!fallback && !room) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate Room"
          title="관전 상세를 열지 못했습니다."
          description="현재 roomId에 해당하는 관전 대상을 찾을 수 없습니다."
          actions={<StatusPill tone="danger">Load failed</StatusPill>}
        />
        <Panel title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-app-secondary">{error ?? message}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Spectate Room"
        title={`관전 Room ${roomId} — ${problemTitle}`}
        description="참여자들의 코드가 실시간으로 업데이트됩니다."
        actions={
          <>
            <StatusPill tone="success">LIVE</StatusPill>
            <StatusPill>{participants.length}명 참여 중</StatusPill>
          </>
        }
      />

      <div className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-secondary">
        {error ?? message}
      </div>

      <MetricGrid>
        <MetricCard label="Room ID" value={roomId} />
        <MetricCard label="Problem" value={problemTitle} />
        <MetricCard label="Participants" value={participants.length} />
        <MetricCard
          label="수신된 코드 수"
          value={Object.keys(codeByUserId).length}
        />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        {participants.map((participant) => {
          const code =
            codeByUserId[participant.userId] ??
            `// ${participant.nickname}의 코드 업데이트를 기다리는 중...`;
          const lastUpdated =
            lastUpdatedByUserId[participant.userId] ?? "대기 중";

          return (
            <CodeWindow
              key={participant.userId}
              title={`${participant.nickname}  ·  ${lastUpdated}`}
              code={code}
              footer={<span>userId {participant.userId}</span>}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/spectate"
          className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
        >
          관전 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
