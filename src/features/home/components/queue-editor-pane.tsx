import type { CSSProperties, RefObject } from "react";

import type { Difficulty } from "@/shared/api/contracts";

import type { QueueCategoryOption, QueueCategoryValue } from "../data";
import RatingPreviewPanel from "./rating-preview-panel";

interface QueueEditorPaneProps {
  editorPaneRef: RefObject<HTMLDivElement | null>;
  editorContentStyle: CSSProperties;
  editorLineNumbers: number[];
  editorLineStyle: CSSProperties;
  editorRowStyle: CSSProperties;
  canStartMatch: boolean;
  onStartMatch: () => void;
  category: QueueCategoryValue;
  onCategoryChange: (nextCategory: QueueCategoryValue) => void;
  categoryOptions: QueueCategoryOption[];
  difficulty: Difficulty;
  onDifficultyChange: (nextDifficulty: Difficulty) => void;
  difficultyOptions: Array<{ value: Difficulty; label: string }>;
  queueMemo: string;
  onQueueMemoChange: (nextMemo: string) => void;
  showStopQueueButton: boolean;
  onCancelQueue: () => void;
  isBusy: boolean;
  error: string | null;
  terminalMessage: string | null;
}

function estimateTextWidth(text: string) {
  return Array.from(text).reduce((total, char) => {
    return total + (/^[\x20-\x7E]$/.test(char) ? 1 : 1.45);
  }, 0);
}

const difficultyToneStyles: Record<
  Difficulty,
  {
    active: string;
    inactive: string;
  }
> = {
  EASY: {
    active:
      "border-emerald-300 bg-emerald-400/30 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.45),0_0_12px_rgba(16,185,129,0.35)]",
    inactive:
      "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/55 opacity-75 hover:bg-emerald-500/12 hover:opacity-100",
  },
  MEDIUM: {
    active:
      "border-amber-300 bg-amber-400/28 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_0_12px_rgba(245,158,11,0.35)]",
    inactive:
      "border-amber-500/20 bg-amber-500/5 text-amber-200/55 opacity-75 hover:bg-amber-500/12 hover:opacity-100",
  },
  HARD: {
    active:
      "border-rose-300 bg-rose-400/28 text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.45),0_0_12px_rgba(244,63,94,0.35)]",
    inactive:
      "border-rose-500/20 bg-rose-500/5 text-rose-200/55 opacity-75 hover:bg-rose-500/12 hover:opacity-100",
  },
};

export default function QueueEditorPane({
  editorPaneRef,
  editorContentStyle,
  editorLineNumbers,
  editorLineStyle,
  editorRowStyle,
  canStartMatch,
  onStartMatch,
  category,
  onCategoryChange,
  categoryOptions,
  difficulty,
  onDifficultyChange,
  difficultyOptions,
  queueMemo,
  onQueueMemoChange,
  showStopQueueButton,
  onCancelQueue,
  isBusy,
  error,
  terminalMessage,
}: QueueEditorPaneProps) {
  const selectedCategoryLabel =
    categoryOptions.find((item) => item.value === category)?.label ?? category;
  const categoryWidthCh = Math.min(
    36,
    Math.max(18, Math.ceil(estimateTextWidth(selectedCategoryLabel) + 8)),
  );
  const trimmedMemo = queueMemo.trim();
  const memoSample = trimmedMemo.length > 0 ? trimmedMemo : "메모";
  const memoContentWidthCh = Math.ceil(estimateTextWidth(memoSample));
  const memoWidthCh =
    trimmedMemo.length > 0
      ? Math.min(72, Math.max(24, memoContentWidthCh + 5))
      : 24;

  return (
    <main className="h-full overflow-hidden border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 items-center justify-between border-b border-app-border/80 bg-app-base px-3">
          <div className="flex h-full items-end gap-0.5 pt-1">
            <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
              <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                  <path
                    d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="6.4" cy="10.8" r="0.7" fill="currentColor" />
                </svg>
              </span>
              <span>.env.queue.match</span>
              <span className="text-app-dim">×</span>
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
            </div>
          </div>
          <button
            type="button"
            onClick={onStartMatch}
            disabled={!canStartMatch}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-app-accent/45 bg-app-accent px-3 text-sm font-semibold text-white transition hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-elevated disabled:text-app-secondary"
            aria-label="매칭 시작"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-app-syntax-icon">
              <path
                d="M8 2.3v3M5 3.4A4.9 4.9 0 1 0 11 3.4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span>매칭 시작</span>
            <span className="mx-0.5 h-4 w-px bg-app-surface/35" />
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-app-success">
              <path d="m6 4 5 4-5 4V4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div ref={editorPaneRef} className="flex-1 overflow-y-auto bg-app-base">
          <div
            className="grid min-h-full grid-cols-[56px_minmax(0,1fr)] bg-app-base font-mono"
            style={editorContentStyle}
          >
            <div className="border-r border-app-border/70 bg-app-base px-3 py-4 text-right text-app-syntax-line-number">
              {editorLineNumbers.map((line) => (
                <div key={line} style={editorLineStyle}>
                  {line}
                </div>
              ))}
            </div>
            <div className="px-4 py-4 text-app-syntax-default">
              <div className="whitespace-nowrap text-app-syntax-comment" style={editorLineStyle}>
                # queue config
              </div>
              <div className="whitespace-nowrap text-app-syntax-comment" style={editorLineStyle}>
                <span className="font-semibold text-app-syntax-keyword"># TODO:</span>
                <span className="text-app-syntax-keyword">
                  {" "}
                  카테고리와 난이도를 선택하고 매칭 시작을 눌러 대기열에 참가합니다.
                </span>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 shrink-0 text-app-syntax-name">QUEUE_CATEGORY</span>
                <span className="w-4 shrink-0 text-center text-app-syntax-operator">=</span>
                <div className="relative w-fit max-w-full leading-none">
                  <select
                    value={category}
                    onChange={(event) => onCategoryChange(event.target.value as QueueCategoryValue)}
                    className="h-7 w-full appearance-none rounded-sm border border-app-border bg-app-elevated px-2 pr-6 text-xs text-app-syntax-string outline-none transition focus:border-app-accent/60"
                    style={{ width: `calc(${categoryWidthCh}ch + 0.75rem)`, maxWidth: "100%" }}
                  >
                    {categoryOptions.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                        disabled={"disabled" in item ? item.disabled : false}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-app-dim">
                    ▾
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 shrink-0 text-app-syntax-name">QUEUE_LEVEL</span>
                <span className="w-4 shrink-0 text-center text-app-syntax-operator">=</span>
                <div className="flex flex-wrap gap-1 leading-none">
                  {difficultyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer select-none rounded-sm border px-2 py-1 text-xs font-medium transition ${
                        difficulty === option.value
                          ? `${difficultyToneStyles[option.value].active} translate-y-[-1px] font-semibold`
                          : difficultyToneStyles[option.value].inactive
                      }`}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        value={option.value}
                        checked={difficulty === option.value}
                        onChange={() => onDifficultyChange(option.value)}
                        className="sr-only"
                      />
                      {option.label.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 shrink-0 text-app-syntax-name">QUEUE_PARTY_SIZE</span>
                <span className="w-4 shrink-0 text-center text-app-syntax-operator">=</span>
                <span
                  title="배틀 규칙상 4인 고정"
                  className="inline-flex min-w-8 items-center justify-center rounded-sm border border-app-border bg-app-elevated px-2 text-xs font-semibold text-app-syntax-constant"
                >
                  4인 고정
                </span>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 shrink-0 text-app-syntax-name">QUEUE_MEMO</span>
                <span className="w-4 shrink-0 text-center text-app-syntax-operator">=</span>
                <div className="w-fit max-w-full">
                  <input
                    type="text"
                    value={queueMemo}
                    onChange={(event) => onQueueMemoChange(event.target.value)}
                    className="h-7 w-full rounded-sm border border-app-border bg-app-elevated px-2 text-xs text-app-syntax-string outline-none transition focus:border-app-accent/60"
                    style={{ width: `calc(${memoWidthCh}ch + 1.25rem)`, maxWidth: "100%" }}
                  />
                </div>
              </div>

              <div className="mt-2 text-app-syntax-comment" style={editorLineStyle}>
                {showStopQueueButton ? (
                  <button
                    type="button"
                    onClick={onCancelQueue}
                    disabled={isBusy}
                    className="rounded-sm border border-app-border bg-app-elevated px-2 py-0.5 text-xs text-app-primary transition hover:bg-app-elevated/90 disabled:cursor-not-allowed disabled:text-app-dim"
                  >
                    stopQueue();
                  </button>
                ) : null}
              </div>
              {error || terminalMessage ? (
                <div
                  className={`mt-1 rounded-sm border px-3 py-2 text-xs ${
                    error
                      ? "border-app-danger/60 bg-app-danger/20 text-app-danger"
                      : "border-app-border bg-app-elevated text-app-secondary"
                  }`}
                >
                  {error ?? terminalMessage}
                </div>
              ) : null}
              <RatingPreviewPanel />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
