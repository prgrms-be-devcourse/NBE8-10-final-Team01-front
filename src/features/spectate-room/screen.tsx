"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  CodeUpdateWsMessage,
  ProblemDetailResponse,
  RoomResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import {
  CodeWindow,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

import { getSpectateRoom } from "./data";

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return { authenticated: false, member: null } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
}

export default function SpectateRoomScreen({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [message, setMessage] = useState("관전 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [codeByUserId, setCodeByUserId] = useState<Record<number, string>>({});
  const [lastUpdatedByUserId, setLastUpdatedByUserId] = useState<Record<number, string>>({});
  const stompClientRef = useRef<Client | null>(null);

  // 세션 및 방 정보 로드
  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);

      if (!nextSession.authenticated) {
        setRequiresLogin(true);
        setMessage("관전 상세는 로그인 후 접근할 수 있습니다.");
        return;
      }

      const response = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        setRequiresLogin(true);
        setMessage("관전 상세는 로그인 후 접근할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        const fallback = getSpectateRoom(roomId);

        if (fallback) {
          setMessage("백엔드 연결 실패로 샘플 관전 데이터를 표시합니다.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "관전 상세를 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await response.json()) as RoomResponse;
      setRoom(nextRoom);

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        setProblem((await problemResponse.json()) as ProblemDetailResponse);
      }

      setMessage("실시간 관전 중입니다.");
    })();
  }, [roomId]);

  // WebSocket: /topic/room/{roomId}/spectate 구독
  useEffect(() => {
    if (!session.authenticated) return;

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      reconnectDelay: 3000,
      // 연결(및 재연결) 시마다 1회용 토큰을 새로 발급해 STOMP CONNECT 헤더에 주입.
      // 토큰은 30초 TTL이고 1회 사용 후 폐기되므로 재연결 시에도 반드시 새 토큰이 필요.
      // 토큰 발급 실패 시 쿠키 기반 인증(로컬 환경)으로 자동 폴백됨.
      beforeConnect: async () => {
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

          if ((payload as { type: unknown }).type === "CODE_UPDATE") {
            const msg = payload as CodeUpdateWsMessage;
            const now = new Date().toLocaleTimeString("ko-KR");
            setCodeByUserId((prev) => ({ ...prev, [msg.userId]: msg.code }));
            setLastUpdatedByUserId((prev) => ({ ...prev, [msg.userId]: now }));
          }
        });
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
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/spectate"
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
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
          <p className="text-sm leading-7 text-zinc-700">{error ?? message}</p>
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

      <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
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
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
        >
          관전 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
