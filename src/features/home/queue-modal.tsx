"use client";

import type { QueueStateResponse } from "@/shared/api/contracts";
import { StatusPill } from "@/shared/ui";

import type { MatchTicketState } from "./data";
import { formatClock } from "./data";

interface QueueModalProps {
  categoryLabel: string;
  difficultyLabel: string;
  error: string | null;
  feedback: string;
  hasAccepted: boolean;
  isPending: boolean;
  queueElapsedSeconds: number;
  queueState: QueueStateResponse;
  readyCountdownSeconds: number;
  ticket: MatchTicketState | null;
  onAccept: () => void;
  onCancel: () => void;
  onDecline: () => void;
}

export default function QueueModal({
  categoryLabel,
  difficultyLabel,
  error,
  feedback,
  hasAccepted,
  isPending,
  queueElapsedSeconds,
  queueState,
  readyCountdownSeconds,
  ticket,
  onAccept,
  onCancel,
  onDecline,
}: QueueModalProps) {
  const isOpen = queueState.inQueue || ticket !== null;

  if (!isOpen) {
    return null;
  }

  const isReadyCheck = ticket !== null;
  const acceptedCount = ticket?.acceptedMemberIds.length ?? 0;
  const maxPlayers = ticket?.maxPlayers ?? 4;
  const isReadyToEnter = ticket?.status === "READY_TO_ENTER";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={isReadyCheck ? "success" : "warn"}>
            {isReadyCheck ? "매칭 수락" : "큐 대기 중"}
          </StatusPill>
          <StatusPill>{categoryLabel}</StatusPill>
          <StatusPill>{difficultyLabel}</StatusPill>
          <StatusPill>
            {isReadyCheck ? `${acceptedCount} / ${maxPlayers}` : `${queueState.waitingCount} / 4`}
          </StatusPill>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div
            className={`flex size-16 shrink-0 items-center justify-center rounded-full border-4 text-sm font-semibold ${
              isReadyCheck
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "animate-spin border-zinc-300 border-t-zinc-950 bg-zinc-50 text-transparent"
            }`}
          >
            {isReadyCheck ? formatClock(readyCountdownSeconds) : ""}
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              {isReadyCheck ? "매칭이 성사됐습니다" : "큐를 찾는 중입니다"}
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              {isReadyCheck
                ? "지정된 시간 안에 모두 수락하면 배틀룸으로 이동합니다. 한 명이라도 수락하지 않으면 남은 인원은 다시 대기열로 돌아갑니다."
                : "메인 화면 위에서 롤 큐처럼 현재 대기 상태를 유지합니다. 매칭이 잡히면 준비 완료 모달로 전환됩니다."}
            </p>
          </div>
        </div>

        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-zinc-300 bg-zinc-50 text-zinc-700"
          }`}
        >
          {error ?? feedback}
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              경과 시간
            </p>
            <p className="mt-2 font-medium text-zinc-950">{formatClock(queueElapsedSeconds)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              현재 인원
            </p>
            <p className="mt-2 font-medium text-zinc-950">
              {isReadyCheck ? `${acceptedCount} / ${maxPlayers}` : `${queueState.waitingCount} / 4`}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {isReadyCheck ? "수락 제한 시간" : "큐 상태"}
            </p>
            <p className="mt-2 font-medium text-zinc-950">
              {isReadyCheck ? formatClock(readyCountdownSeconds) : "검색 중"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {isReadyCheck ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={hasAccepted || isReadyToEnter}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {isReadyToEnter ? "전원 수락 완료" : hasAccepted ? "준비 완료" : "준비 완료"}
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={hasAccepted || isReadyToEnter || isPending}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                수락 안 함
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                큐 취소
              </button>
              <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                수락 모달이 뜨면 15초 안에 확인해야 합니다.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
