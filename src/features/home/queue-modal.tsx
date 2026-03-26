"use client";

import { StatusPill } from "@/shared/ui";

import { formatClock } from "./data";

interface QueueModalProps {
  isOpen: boolean;
  categoryLabel: string;
  difficultyLabel: string;
  error: string | null;
  feedback: string;
  isPending: boolean;
  queueElapsedSeconds: number;
  waitingCount: number;
  onCancel: () => void;
}

export default function QueueModal({
  isOpen,
  categoryLabel,
  difficultyLabel,
  error,
  feedback,
  isPending,
  queueElapsedSeconds,
  waitingCount,
  onCancel,
}: QueueModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="warn">큐 대기 중</StatusPill>
          <StatusPill>{categoryLabel}</StatusPill>
          <StatusPill>{difficultyLabel}</StatusPill>
          <StatusPill>{waitingCount} / 4</StatusPill>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-16 shrink-0 animate-spin items-center justify-center rounded-full border-4 border-zinc-300 border-t-zinc-950 bg-zinc-50 text-transparent">
            .
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              큐를 찾는 중입니다
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              메인 화면 위에서 롤 큐처럼 현재 대기 상태를 유지합니다.
              `/matches/me`가 `MATCHED`를 반환하면 즉시 배틀룸으로 이동합니다.
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
            <p className="mt-2 font-medium text-zinc-950">{waitingCount} / 4</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              큐 상태
            </p>
            <p className="mt-2 font-medium text-zinc-950">검색 중</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            큐 취소
          </button>
          <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
            취소 버튼은 백엔드 매칭 상태가 `SEARCHING`일 때만 노출됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
