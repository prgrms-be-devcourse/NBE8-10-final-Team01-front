"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  BattleResultResponse,
} from "@/shared/api/contracts";
import {
  MetricCard,
  MetricGrid,
  Panel,
  SimpleTable,
  StatusPill,
} from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date-time";
import { useAppSession } from "@/features/layout/session-context";

import { getBattleResult } from "./data";

export default function BattleResultScreen({ roomId }: { roomId: string }) {
  const { session } = useAppSession();
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
      <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
        <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
          <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
            <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path d="M3 2.5V13.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M3.7 3.5H12L10.4 5.3L12 7.1H3.7V3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </span>
            <span>result-room-{roomId}.json</span>
            <span className="text-app-dim">×</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-app-base">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <section className="space-y-4 rounded-2xl border border-app-border bg-app-surface p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-app-primary">로그인 후 결과를 확인할 수 있습니다.</h1>
                <StatusPill tone="warn">로그인 필요</StatusPill>
              </div>
              <p className="text-sm text-app-muted">결과 조회는 보호된 배틀 API를 사용합니다.</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/login?next=${encodeURIComponent(`/battle/results/${roomId}`)}`}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white transition hover:bg-app-accent-hover"
                >
                  로그인하러 가기
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-app-border bg-app-elevated px-4 text-sm font-medium text-app-primary transition hover:bg-app-surface"
                >
                  메인으로 돌아가기
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
        <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
          <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
            <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path d="M3 2.5V13.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M3.7 3.5H12L10.4 5.3L12 7.1H3.7V3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </span>
            <span>result-room-{roomId}.json</span>
            <span className="text-app-dim">×</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-app-base">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <section className="space-y-4 rounded-2xl border border-app-danger/35 bg-app-danger/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-app-danger">결과를 열지 못했습니다.</h1>
                <StatusPill tone="danger">Load failed</StatusPill>
              </div>
              <p className="text-sm text-app-secondary">{error ?? message}</p>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const winner = result.participants.find((participant) => participant.finalRank === 1);
  const myParticipant = session.member
    ? result.participants.find((participant) => participant.userId === session.member?.memberId)
    : null;
  const myScoreDelta = myParticipant ? `${myParticipant.scoreDelta > 0 ? "+" : ""}${myParticipant.scoreDelta}` : "-";

  return (
    <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
        <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
          <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M3 2.5V13.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M3.7 3.5H12L10.4 5.3L12 7.1H3.7V3.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </span>
          <span>result-room-{result.roomId}.json</span>
          <span className="text-app-dim">×</span>
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-app-base">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
          <section className="rounded-2xl border border-app-border bg-gradient-to-r from-app-surface to-app-elevated p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-app-dim">battle-result.log</p>
                <h1 className="text-xl font-semibold text-app-primary">Room {result.roomId} 결과 정산</h1>
                <p className="text-sm text-app-muted">마이페이지에서 선택한 경기의 최종 순위와 점수 변동을 확인합니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="success">FINISHED</StatusPill>
                <StatusPill>{source === "api" ? "API" : "Fallback"}</StatusPill>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-app-base px-3 py-2 text-sm text-app-secondary">
              <span>{error ?? message}</span>
              <Link
                href="/mypage"
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-sm font-medium text-app-primary transition hover:bg-app-surface"
              >
                내 전적으로 돌아가기
              </Link>
            </div>
          </section>

          <MetricGrid>
            <MetricCard label="Winner" value={winner?.nickname ?? "-"} />
            <MetricCard label="Participants" value={result.participants.length} />
            <MetricCard label="Top Score Delta" value={`+${winner?.scoreDelta ?? 0}`} />
            <MetricCard label="Problem" value={result.problemTitle} />
          </MetricGrid>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel
              variant="dark"
              title="내 결과 요약"
              description="현재 로그인한 내 계정 기준 정산 요약"
            >
              {myParticipant ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
                    <p className="text-xs text-app-dim">최종 순위</p>
                    <p className="mt-1 text-lg font-semibold text-app-primary">
                      {myParticipant.finalRank}등
                    </p>
                  </div>
                  <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
                    <p className="text-xs text-app-dim">제출 결과</p>
                    <p className="mt-1 text-lg font-semibold text-app-primary">
                      {myParticipant.result ?? "미제출"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
                    <p className="text-xs text-app-dim">통과 수</p>
                    <p className="mt-1 text-lg font-semibold text-app-primary">
                      {myParticipant.passedCount}/{myParticipant.totalCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-app-border bg-app-base px-3 py-2">
                    <p className="text-xs text-app-dim">점수 변화</p>
                    <p
                      className={`mt-1 text-lg font-semibold ${
                        myParticipant.scoreDelta > 0
                          ? "text-app-success"
                          : myParticipant.scoreDelta < 0
                            ? "text-app-danger"
                            : "text-app-secondary"
                      }`}
                    >
                      {myScoreDelta}
                    </p>
                  </div>
                  <div className="rounded-xl border border-app-border bg-app-base px-3 py-2 sm:col-span-2">
                    <p className="text-xs text-app-dim">완료 시각</p>
                    <p className="mt-1 text-sm font-medium text-app-primary">
                      {formatDateTime(myParticipant.finishTime)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-app-border bg-app-base px-3 py-3 text-sm text-app-secondary">
                  현재 로그인 계정의 제출 기록을 찾지 못했습니다.
                </div>
              )}
            </Panel>

            <Panel
              variant="dark"
              title="최종 리더보드"
              description="전체 참가자 결과"
            >
              <SimpleTable
                headers={[
                  "구분",
                  "순위",
                  "닉네임",
                  "결과",
                  "통과",
                  "점수 변동",
                  "완료 시각",
                ]}
                rows={result.participants.map((participant) => [
                  session.member?.memberId === participant.userId ? "ME" : "-",
                  participant.finalRank,
                  participant.nickname,
                  participant.result ?? "미제출",
                  `${participant.passedCount}/${participant.totalCount}`,
                  `${participant.scoreDelta > 0 ? "+" : ""}${participant.scoreDelta}`,
                  formatDateTime(participant.finishTime),
                ])}
              />
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
