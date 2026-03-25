"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ApiErrorResponse, RoomListResponse } from "@/shared/api/contracts";
import {
  ApiCallout,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

import { roomList as fallbackRoomList } from "./data";

export default function SpectateScreen() {
  const [rooms, setRooms] = useState<RoomListResponse[]>([]);
  const [message, setMessage] = useState("진행 중인 방 목록을 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "fallback">("api");
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/battle/rooms", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setRequiresLogin(true);
        setMessage("관전 허브는 로그인 후 접근할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        setRooms(fallbackRoomList);
        setSource("fallback");
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "방 목록 조회에 실패해 샘플 목록을 표시합니다.");
        return;
      }

      setRooms((await response.json()) as RoomListResponse[]);
      setSource("api");
      setMessage("실제 API 기반 진행 중 방 목록을 표시합니다.");
    })();
  }, []);

  if (requiresLogin) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate"
          title="로그인 후 관전 목록을 볼 수 있습니다."
          description="현재 배틀 관련 API는 모두 보호된 상태입니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
        <Panel title="이동" description="보호 화면 진입 전 처리">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/spectate"
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
            >
              메인으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Spectate"
        title="진행 중인 방 목록"
        description="관전 허브는 진행 중인 방을 목록으로 보여주고, 각 방의 관전 상세 화면으로 연결합니다. 실제 방 목록 API를 우선하고, 실패 시 샘플 목록을 보조로 씁니다."
        actions={
          <>
            <StatusPill tone="success">PLAYING rooms</StatusPill>
            <StatusPill>{source === "api" ? "API" : "Fallback"}</StatusPill>
          </>
        }
      />

      <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
        {error ?? message}
      </div>

      <MetricGrid>
        <MetricCard label="Live Rooms" value={rooms.length} />
        <MetricCard
          label="Socket Endpoint"
          value="/ws"
          hint="SockJS handshake endpoint"
        />
        <MetricCard label="Broker Prefix" value="/topic" />
        <MetricCard label="Publish Prefix" value="/app" />
      </MetricGrid>

      <section className="grid gap-6 lg:grid-cols-2">
        {rooms.map((room) => (
          <Link
            key={room.roomId}
            href={`/spectate/rooms/${room.roomId}`}
            className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-zinc-500"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-500">roomId {room.roomId}</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                  {room.problemTitle}
                </h2>
              </div>
              <StatusPill tone="success">{room.status}</StatusPill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-zinc-600">
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Current Players
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">
                  {room.currentPlayers} / {room.maxPlayers}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Detail Route
                </p>
                <p className="mt-2 font-medium text-zinc-950">
                  /spectate/rooms/{room.roomId}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <Panel title="관전용 실시간 계약" description="상세 화면에서 참조할 WebSocket 경로">
        <div className="grid gap-4 lg:grid-cols-3">
          <ApiCallout method="WS" path="/ws" note="SockJS 핸드셰이크 엔드포인트" />
          <ApiCallout
            method="SUBSCRIBE"
            path="/topic/room/{roomId}"
            note="배틀 상태 변화와 제출 결과 이벤트"
          />
          <ApiCallout
            method="SUBSCRIBE"
            path="/topic/room/{roomId}/spectate"
            note="관전자 전용 코드 업데이트 스트림"
          />
        </div>
      </Panel>
    </div>
  );
}
