"use client";

import type { ReadyCheckState } from "@/shared/api/contracts";
import { StatusPill } from "@/shared/ui";

import {
  formatClock,
  getReadyDecisionLabel,
  getReadyDecisionTone,
} from "./data";

type QueueModalMode = "SEARCHING" | "READY_CHECK" | "ROOM_READY" | "TERMINAL" | null;

interface QueueModalProps {
  mode: QueueModalMode;
  categoryLabel: string;
  difficultyLabel: string;
  currentUserId: number | null;
  roomId: number | null;
  error: string | null;
  feedback: string;
  isPending: boolean;
  queueElapsedSeconds: number;
  waitingCount: number;
  requiredCount: number;
  readyCheck: ReadyCheckState | null;
  countdownSeconds: number;
  terminalMessage: string | null;
  onCancel: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRetryRoomEntry: () => void;
  onCloseTerminal: () => void;
}

function SectionTitle({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </p>
      <p className="mt-2 font-medium text-zinc-100">{value}</p>
    </div>
  );
}

export default function QueueModal({
  mode,
  categoryLabel,
  difficultyLabel,
  currentUserId,
  roomId,
  error,
  feedback,
  isPending,
  queueElapsedSeconds,
  waitingCount,
  requiredCount,
  readyCheck,
  countdownSeconds,
  terminalMessage,
  onCancel,
  onAccept,
  onDecline,
  onRetryRoomEntry,
  onCloseTerminal,
}: QueueModalProps) {
  if (!mode) {
    return null;
  }

  const modalTone =
    mode === "TERMINAL"
      ? "danger"
      : mode === "ROOM_READY"
        ? "success"
        : "warn";
  const modalStatus =
    mode === "SEARCHING"
      ? "매칭 대기 중"
      : mode === "READY_CHECK"
        ? "수락 확인 중"
        : mode === "ROOM_READY"
          ? "방 입장 준비 완료"
          : "매칭 종료";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-[#1f222a] p-6 text-zinc-200 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={modalTone}>{modalStatus}</StatusPill>
          <StatusPill>{categoryLabel}</StatusPill>
          <StatusPill>{difficultyLabel}</StatusPill>
          {mode === "SEARCHING" ? (
            <StatusPill>{waitingCount} / {requiredCount}</StatusPill>
          ) : null}
          {readyCheck ? (
            <StatusPill>
              {readyCheck.acceptedCount} / {readyCheck.requiredCount}
            </StatusPill>
          ) : null}
        </div>

        {mode === "SEARCHING" ? (
          <>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex size-16 shrink-0 animate-spin items-center justify-center rounded-full border-4 border-zinc-700 border-t-sky-400 bg-[#1a1d24] text-transparent">
                .
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                  상대를 찾고 있습니다
                </h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  ready-check 전까지는 대기열 인원만 표시합니다.
                  네 명이 채워져서 큐에서 빠지면 자동으로 수락 화면으로 전환됩니다.
                </p>
              </div>
            </div>

            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                  : "border-zinc-700 bg-[#1a1d24] text-zinc-300"
              }`}
            >
              {error ?? feedback}
            </div>

            <div className="mt-6 grid gap-4 rounded-xl border border-zinc-700 bg-[#1a1d24] p-4 text-sm text-zinc-300 md:grid-cols-3">
              <SectionTitle label="경과 시간" value={formatClock(queueElapsedSeconds)} />
              <SectionTitle
                label="현재 인원"
                value={`${waitingCount} / ${requiredCount}`}
              />
              <SectionTitle label="현재 상태" value="큐 대기 중" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="rounded-lg border border-zinc-700 bg-[#22262e] px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-sky-400/45 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:text-zinc-500"
              >
                매칭 취소
              </button>
              <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] px-4 py-3 text-sm leading-6 text-zinc-400">
                cancel 버튼은 SEARCHING 단계에서만 노출됩니다.
              </div>
            </div>
          </>
        ) : null}

        {mode === "READY_CHECK" ? (
          <>
            <div className="mt-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                매칭이 성사되었습니다
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                수락 여부를 확인하는 단계입니다. 마지막 수락이 완료되면 방이 만들어지고
                자동으로 입장 절차를 시작합니다.
              </p>
            </div>

            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                  : "border-zinc-700 bg-[#1a1d24] text-zinc-300"
              }`}
            >
              {error ?? feedback}
            </div>

            <div className="mt-6 grid gap-4 rounded-xl border border-zinc-700 bg-[#1a1d24] p-4 text-sm text-zinc-300 md:grid-cols-3">
              <SectionTitle
                label="수락 현황"
                value={
                  readyCheck
                    ? `${readyCheck.acceptedCount} / ${readyCheck.requiredCount}`
                    : "확인 중"
                }
              />
              <SectionTitle label="남은 시간" value={formatClock(countdownSeconds)} />
              <SectionTitle
                label="내 상태"
                value={readyCheck?.acceptedByMe ? "수락 완료" : "응답 대기"}
              />
            </div>

            <div className="mt-6 rounded-xl border border-zinc-700 bg-[#1a1d24] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-100">참가자 상태</p>
                {readyCheck ? (
                  <p className="text-xs text-zinc-500">matchId {readyCheck.matchId}</p>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {readyCheck?.participants?.length ? (
                  readyCheck.participants.map((participant) => (
                    <div
                      key={`${participant.userId}-${participant.nickname}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-700 bg-[#22262e] px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {participant.nickname}
                          {participant.userId === currentUserId ? " (나)" : ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          userId {participant.userId}
                        </p>
                      </div>
                      <StatusPill tone={getReadyDecisionTone(participant.decision)}>
                        {getReadyDecisionLabel(participant.decision)}
                      </StatusPill>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">
                    참가자 상태를 불러오는 중입니다.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onDecline}
                disabled={isPending || !readyCheck}
                className="rounded-lg border border-zinc-700 bg-[#22262e] px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-sky-400/45 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:text-zinc-500"
              >
                매칭 거절
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={isPending || !readyCheck || readyCheck.acceptedByMe}
                className="rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
              >
                {readyCheck?.acceptedByMe ? "이미 수락했습니다" : "매칭 수락"}
              </button>
            </div>
          </>
        ) : null}

        {mode === "ROOM_READY" ? (
          <>
            <div className="mt-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                방이 준비되었습니다
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                전원이 수락해서 방 입장 준비가 끝났습니다. 기존 battle room join API로
                연결하는 중입니다.
              </p>
            </div>

            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                error
                  ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                  : "border-zinc-700 bg-[#1a1d24] text-zinc-300"
              }`}
            >
              {error ?? feedback}
            </div>

            <div className="mt-6 grid gap-4 rounded-xl border border-zinc-700 bg-[#1a1d24] p-4 text-sm text-zinc-300 md:grid-cols-3">
              <SectionTitle
                label="roomId"
                value={roomId !== null ? String(roomId) : "확인 중"}
              />
              <SectionTitle
                label="수락 현황"
                value={
                  readyCheck
                    ? `${readyCheck.acceptedCount} / ${readyCheck.requiredCount}`
                    : "확인 중"
                }
              />
              <SectionTitle label="현재 상태" value="방 입장 시도 중" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onRetryRoomEntry}
                disabled={isPending}
                className="rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
              >
                방 입장 다시 시도
              </button>
              <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] px-4 py-3 text-sm leading-6 text-zinc-400">
                join 성공 시 battle room 화면으로 이동합니다.
              </div>
            </div>
          </>
        ) : null}

        {mode === "TERMINAL" ? (
          <>
            <div className="mt-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
                매칭이 종료되었습니다
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                서버 상태는 종료 상태를 유지할 수 있으므로, 현재 화면에서는 한 번 안내한 뒤
                로컬 UI를 초기화합니다.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-rose-400/60 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">
              {terminalMessage ?? error ?? feedback}
            </div>

            {readyCheck?.participants?.length ? (
              <div className="mt-6 rounded-xl border border-zinc-700 bg-[#1a1d24] p-4">
                <p className="text-sm font-medium text-zinc-100">종료 시점 참가자 상태</p>
                <div className="mt-4 space-y-3">
                  {readyCheck.participants.map((participant) => (
                    <div
                      key={`${participant.userId}-${participant.nickname}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-700 bg-[#22262e] px-4 py-3"
                    >
                      <p className="font-medium text-zinc-100">
                        {participant.nickname}
                        {participant.userId === currentUserId ? " (나)" : ""}
                      </p>
                      <StatusPill tone={getReadyDecisionTone(participant.decision)}>
                        {getReadyDecisionLabel(participant.decision)}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCloseTerminal}
                disabled={isPending}
                className="rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
              >
                확인하고 닫기
              </button>
              <div className="rounded-lg border border-zinc-700 bg-[#1a1d24] px-4 py-3 text-sm leading-6 text-zinc-400">
                닫은 뒤에는 메인에서 다시 매칭을 시작할 수 있습니다.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
