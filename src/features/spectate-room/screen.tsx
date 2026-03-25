"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemDetailResponse,
  RoomResponse,
} from "@/shared/api/contracts";
import {
  ApiCallout,
  CodeWindow,
  EventTimeline,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

import { getSpectateRoom } from "./data";

export default function SpectateRoomScreen({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [message, setMessage] = useState("관전 상세 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "fallback">("api");
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    void (async () => {
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
          setSource("fallback");
          setMessage("백엔드 연결 실패로 샘플 관전 데이터를 표시합니다.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "관전 상세를 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await response.json()) as RoomResponse;
      setRoom(nextRoom);
      setSource("api");

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        setProblem((await problemResponse.json()) as ProblemDetailResponse);
      }

      setMessage("실제 방 정보 기반 관전 상세 화면입니다.");
    })();
  }, [roomId]);

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
  const codePanels =
    fallback?.codePanels ??
    participants.map((participant) => ({
      userId: participant.userId,
      nickname: participant.nickname,
      lastUpdated: "실시간 코드 스트림 준비 전",
      code: `// ${participant.nickname}의 관전자용 코드 스트림은\n// /topic/room/${roomId}/spectate 연결 후 표시됩니다.`,
    }));
  const liveEvents =
    fallback?.liveEvents ??
    [
      {
        timestamp: "실시간",
        type: "CODE_UPDATE",
        headline: "관전자용 코드 스트림 준비 전",
        detail: "현재는 방 정보와 문제 정보만 실제 API로 읽고, 코드 스트림은 placeholder로 둡니다.",
      },
    ];
  const problemTitle =
    problem?.title ?? fallback?.problemTitle ?? `roomId ${roomId} 관전 상세`;
  const topicPath = `/topic/room/${roomId}`;
  const codeTopicPath = `/topic/room/${roomId}/spectate`;

  if (!fallback && !room) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Spectate Room"
          title="관전 상세를 열지 못했습니다."
          description="현재 roomId에 해당하는 관전 대상을 찾지 못했습니다."
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
        title={`관전 Room ${roomId}`}
        description="방 상태와 문제 정보는 실제 API를 우선하고, 관전자용 코드 패널은 전용 스트림이 붙기 전까지 샘플 또는 placeholder로 유지합니다."
        actions={
          <>
            <StatusPill tone="success">{problemTitle}</StatusPill>
            <StatusPill>{source === "api" ? "API" : "Fallback"}</StatusPill>
          </>
        }
      />

      <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
        {error ?? message}
      </div>

      <MetricGrid>
        <MetricCard label="Participants" value={participants.length} />
        <MetricCard label="Event Count" value={liveEvents.length} />
        <MetricCard label="Topic" value={topicPath} />
        <MetricCard label="Code Topic" value={codeTopicPath} />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="참가자 코드 패널"
          description="관전자용 코드 업데이트 채널이 붙기 전까지는 샘플 또는 placeholder를 사용합니다."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {codePanels.map((panel) => (
              <CodeWindow
                key={panel.userId}
                title={`${panel.nickname} / ${panel.lastUpdated}`}
                code={panel.code}
                footer={<span>userId {panel.userId}</span>}
              />
            ))}
          </div>
        </Panel>

        <Panel
          title="실시간 이벤트 로그"
          description="배틀 상태 이벤트와 코드 업데이트 이벤트를 한눈에 보여줍니다."
        >
          <EventTimeline events={liveEvents} />
        </Panel>
      </div>

      <Panel title="소켓 경로와 의미" description="프론트 구현 시 subscribe 또는 send 해야 하는 경로">
        <div className="grid gap-4 lg:grid-cols-3">
          <ApiCallout
            method="SUBSCRIBE"
            path={topicPath}
            note="배틀 시작, 제출, 참가자 완료, 배틀 종료 이벤트 수신"
          />
          <ApiCallout
            method="SUBSCRIBE"
            path={codeTopicPath}
            note="관전자 전용 코드 업데이트 스트림 수신"
          />
          <ApiCallout
            method="SEND"
            path={`/app/room/${roomId}/code`}
            note="참여자가 코드 변경을 보낼 때 사용하는 경로"
          />
        </div>
      </Panel>
    </div>
  );
}
