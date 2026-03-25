"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  BattleResultResponse,
} from "@/shared/api/contracts";
import {
  ApiCallout,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  SimpleTable,
  StatusPill,
} from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date-time";

import { getBattleResult } from "./data";

export default function BattleResultScreen({ roomId }: { roomId: string }) {
  const [result, setResult] = useState<BattleResultResponse | null>(null);
  const [message, setMessage] = useState("배틀 결과를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "fallback">("api");
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/battle/rooms/${roomId}/result`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        setRequiresLogin(true);
        setMessage("결과 화면은 로그인 후 접근할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        const fallback = getBattleResult(roomId);

        if (fallback) {
          setSource("fallback");
          setResult(fallback);
          setMessage("백엔드 연결 실패로 샘플 결과를 표시합니다.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "배틀 결과를 불러오지 못했습니다.");
        return;
      }

      setResult((await response.json()) as BattleResultResponse);
      setSource("api");
      setMessage("실제 API 기반 결과를 표시합니다.");
    })();
  }, [roomId]);

  if (requiresLogin) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Battle Result"
          title="로그인 후 결과를 확인할 수 있습니다."
          description="결과 조회는 보호된 배틀 API를 사용합니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
        <Panel title="이동" description="보호 화면 진입 전 처리">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/battle/results/${roomId}`)}`}
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

  if (!result) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Battle Result"
          title="결과를 열지 못했습니다."
          description="현재 roomId에 해당하는 결과를 찾지 못했습니다."
          actions={<StatusPill tone="danger">Load failed</StatusPill>}
        />
        <Panel title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-zinc-700">{error ?? message}</p>
        </Panel>
      </div>
    );
  }

  const winner = result.participants.find((participant) => participant.finalRank === 1);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Battle Result"
        title={`Room ${result.roomId} 결과 정산`}
        description="배틀이 끝난 뒤에는 최종 순위, 점수 변동, 통과 수를 확인합니다. 실제 결과 조회를 우선하고, 연결 실패 시에만 샘플 결과를 표시합니다."
        actions={
          <>
            <StatusPill tone="success">FINISHED</StatusPill>
            <StatusPill>{source === "api" ? "API" : "Fallback"}</StatusPill>
          </>
        }
      />

      <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
        {error ?? message}
      </div>

      <MetricGrid>
        <MetricCard label="Winner" value={winner?.nickname ?? "-"} />
        <MetricCard label="Participants" value={result.participants.length} />
        <MetricCard label="Top Score Delta" value={`+${winner?.scoreDelta ?? 0}`} />
        <MetricCard label="Problem" value={result.problemTitle} />
      </MetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="최종 리더보드"
          description="`finalRank`, `scoreDelta`, `passedCount`, `finishTime`를 우선 노출합니다."
        >
          <SimpleTable
            headers={[
              "순위",
              "닉네임",
              "결과",
              "통과",
              "점수 변동",
              "완료 시각",
            ]}
            rows={result.participants.map((participant) => [
              participant.finalRank,
              participant.nickname,
              participant.result ?? "미제출",
              `${participant.passedCount}/${participant.totalCount}`,
              `+${participant.scoreDelta}`,
              formatDateTime(participant.finishTime),
            ])}
          />
        </Panel>

        <Panel
          title="정산 정책 메모"
          description="현재 백엔드 서비스에 정의된 점수 정책"
        >
          <ul className="space-y-3 text-sm leading-7 text-zinc-700">
            <li>1등 +100, 2등 +70, 3등 +40, 4등 +20</li>
            <li>WA 1회당 20초 패널티가 순위 계산에 반영됩니다.</li>
            <li>AC가 없는 참여자는 뒤 순위로 밀립니다.</li>
            <li>방 상태가 FINISHED가 아니면 결과 조회가 실패합니다.</li>
          </ul>
        </Panel>
      </div>

      <Panel title="연결 엔드포인트" description="결과와 관전 허브가 붙는 실제 지점">
        <div className="grid gap-4 lg:grid-cols-2">
          <ApiCallout
            method="GET"
            path={`/api/battle/rooms/${result.roomId}/result`}
            note="정산이 끝난 방의 최종 결과를 조회합니다."
          />
          <ApiCallout
            method="GET"
            path="/api/battle/rooms"
            note="진행 중인 방 목록 조회는 관전 허브에서 사용합니다."
          />
        </div>
      </Panel>
    </div>
  );
}
