"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ActiveRoomResponse, ApiErrorResponse, RoomListResponse } from "@/shared/api/contracts";
import {
  ApiCallout,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";
import { useAppSession } from "@/features/layout/session-context";

import { roomList as fallbackRoomList } from "./data";

type ActiveRoomState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "found"; roomId: number };

export default function SpectateScreen() {
  const router = useRouter();
  const { session, sessionLoaded } = useAppSession();

  const [activeRoom, setActiveRoom] = useState<ActiveRoomState>({ status: "loading" });
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<RoomListResponse[]>([]);
  const [roomsMessage, setRoomsMessage] = useState("진행 중인 방 목록을 불러오는 중입니다.");
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomsSource, setRoomsSource] = useState<"api" | "fallback">("api");

  // 로그인 확인 후 active room 조회
  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session.authenticated) return;

    void (async () => {
      setActiveRoom({ status: "loading" });

      const response = await fetch("/api/battle/rooms/me/active", {
        cache: "no-store",
      });

      if (!response.ok) {
        // 오류가 나도 방 목록은 보여줌 (active room 없는 것으로 처리)
        setActiveRoom({ status: "none" });
        return;
      }

      const body = (await response.json()) as ActiveRoomResponse | null;
      if (body?.roomId != null) {
        setActiveRoom({ status: "found", roomId: body.roomId });
      } else {
        setActiveRoom({ status: "none" });
      }
    })();
  }, [sessionLoaded, session.authenticated]);

  // active room 없을 때 방 목록 조회
  useEffect(() => {
    if (activeRoom.status !== "none") return;

    void (async () => {
      const response = await fetch("/api/battle/rooms", { cache: "no-store" });

      if (!response.ok) {
        setRooms(fallbackRoomList);
        setRoomsSource("fallback");
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setRoomsError(payload?.message ?? "방 목록 조회에 실패해 샘플 목록을 표시합니다.");
        return;
      }

      setRooms((await response.json()) as RoomListResponse[]);
      setRoomsSource("api");
      setRoomsMessage("실제 API 기반 진행 중 방 목록을 표시합니다.");
    })();
  }, [activeRoom.status]);

  // 포기 처리
  async function handleExit(roomId: number) {
    setExitLoading(true);
    setExitError(null);

    const response = await fetch(`/api/battle/rooms/${roomId}/exit`, {
      method: "POST",
    });

    setExitLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setExitError(payload?.message ?? "포기 처리에 실패했습니다. 다시 시도해 주세요.");
      return;
    }

    setConfirmingExit(false);
    setActiveRoom({ status: "none" });
  }

  // 세션 로딩 중
  if (!sessionLoaded) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate"
          title="로딩 중..."
          description="세션 정보를 확인하고 있습니다."
        />
      </div>
    );
  }

  // 미로그인
  if (!session.authenticated) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate"
          title="로그인 후 관전 목록을 볼 수 있습니다."
          description="관전 기능은 로그인한 사용자만 이용할 수 있습니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
        <Panel title="이동" description="보호 화면 진입 전 처리">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/spectate"
              className="rounded-2xl bg-app-base px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
            >
              메인으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  // active room 조회 중
  if (activeRoom.status === "loading") {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate"
          title="로딩 중..."
          description="참여 중인 방 정보를 확인하고 있습니다."
        />
      </div>
    );
  }

  // 플레이중인 방 있음
  if (activeRoom.status === "found") {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate"
          title="플레이중인 방이 있습니다."
          description="현재 진행 중인 배틀에 참여하고 있습니다. 재참여하거나 포기한 후 관전할 수 있습니다."
          actions={<StatusPill tone="warn">배틀 진행 중</StatusPill>}
        />

        <Panel
          title={`Room #${activeRoom.roomId}`}
          description="현재 참여 중인 배틀방입니다."
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push(`/battle/rooms/${activeRoom.roomId}`)}
              className="rounded-2xl bg-app-base px-4 py-3 text-sm font-medium text-white"
            >
              재참여하기
            </button>
            <button
              type="button"
              onClick={() => { setConfirmingExit(true); setExitError(null); }}
              className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
            >
              포기하고 관전하기
            </button>
          </div>

          {confirmingExit && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="text-sm font-semibold text-red-400">
                정말 포기하시겠습니까?
              </p>
              <p className="mt-1 text-sm text-app-secondary">
                포기하면 최하위 처리되며 다시 참여할 수 없습니다.
              </p>
              {exitError && (
                <p className="mt-2 text-sm text-red-400">{exitError}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={exitLoading}
                  onClick={() => void handleExit(activeRoom.roomId)}
                  className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {exitLoading ? "처리 중..." : "포기 확인"}
                </button>
                <button
                  type="button"
                  disabled={exitLoading}
                  onClick={() => { setConfirmingExit(false); setExitError(null); }}
                  className="rounded-2xl border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-primary disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  // 플레이중인 방 없음 — 방 목록 표시
  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Spectate"
        title="진행 중인 방 목록"
        description="관전 허브는 진행 중인 방을 목록으로 보여주고, 각 방의 관전 상세 화면으로 연결합니다. 실제 방 목록 API를 우선하고, 실패 시 샘플 목록을 보조로 씁니다."
        actions={
          <>
            <StatusPill tone="success">PLAYING rooms</StatusPill>
            <StatusPill>{roomsSource === "api" ? "API" : "Fallback"}</StatusPill>
          </>
        }
      />

      <div className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-secondary">
        {roomsError ?? roomsMessage}
      </div>

      <MetricGrid>
        <MetricCard label="Live Rooms" value={rooms.length} />
        <MetricCard
          label="Socket Endpoint"
          value="/ws"
          hint="SockJS 핸드셰이크 엔드포인트"
        />
        <MetricCard label="Broker Prefix" value="/topic" />
        <MetricCard label="Publish Prefix" value="/app" />
      </MetricGrid>

      <section className="grid gap-6 lg:grid-cols-2">
        {rooms.map((room) => (
          <Link
            key={room.roomId}
            href={`/spectate/rooms/${room.roomId}`}
            className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm transition hover:border-app-border-strong"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-app-dim">roomId {room.roomId}</p>
                <h2 className="mt-1 text-xl font-semibold text-app-primary">
                  {room.problemTitle}
                </h2>
              </div>
              <StatusPill tone="success">{room.status}</StatusPill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-app-secondary">
              <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                  Current Players
                </p>
                <p className="mt-2 text-lg font-semibold text-app-primary">
                  {room.currentPlayers} / {room.maxPlayers}
                </p>
              </div>
              <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                  Detail Route
                </p>
                <p className="mt-2 font-medium text-app-primary">
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
