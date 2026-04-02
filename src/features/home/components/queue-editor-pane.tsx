import type { CSSProperties, RefObject } from "react";

import type { Difficulty } from "@/shared/api/contracts";

import type { QueueCategoryOption, QueueCategoryValue } from "../data";

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
  return (
    <main className="h-full overflow-hidden border-b border-zinc-700/80 bg-[#1e1f22] lg:border-b-0 lg:border-r">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 items-center justify-between border-b border-zinc-700/80 bg-[#1e1f22] px-3">
          <div className="flex h-full items-end gap-0.5 pt-1">
            <div className="relative flex h-10 items-center gap-2 border-r border-zinc-700/70 bg-[#1e1f22] px-3 font-mono text-xs text-zinc-200">
              <span className="inline-flex h-4 w-4 items-center justify-center text-[#7da2f7]">
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
              <span className="text-zinc-500">×</span>
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-zinc-300" />
            </div>
          </div>
          <button
            type="button"
            onClick={onStartMatch}
            disabled={!canStartMatch}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#b08cff]/45 bg-[#9146ff] px-3 text-sm font-semibold text-white transition hover:bg-[#7f39fa] disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-600 disabled:text-zinc-300"
            aria-label="매칭 시작"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[#7dd48c]">
              <path
                d="M8 2.3v3M5 3.4A4.9 4.9 0 1 0 11 3.4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span>매칭 시작</span>
            <span className="mx-0.5 h-4 w-px bg-white/35" />
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[#74cc84]">
              <path d="m6 4 5 4-5 4V4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div ref={editorPaneRef} className="flex-1 overflow-hidden bg-[#1e1f22]">
          <div
            className="grid h-full grid-cols-[56px_minmax(0,1fr)] bg-[#1e1f22] font-mono"
            style={editorContentStyle}
          >
            <div className="border-r border-zinc-700/70 bg-[#1e1f22] px-3 py-4 text-right text-[#606366]">
              {editorLineNumbers.map((line) => (
                <div key={line} style={editorLineStyle}>
                  {line}
                </div>
              ))}
            </div>
            <div className="px-4 py-4 text-[#a9b7c6]">
              <div className="whitespace-nowrap text-[#6a717d]" style={editorLineStyle}>
                # queue config
              </div>
              <div className="whitespace-nowrap text-[#6a717d]" style={editorLineStyle}>
                <span className="font-semibold text-[#ffcc66]"># TODO:</span>
                <span className="text-[#ffcc66]">
                  {" "}
                  카테고리와 난이도를 선택하고 매칭 시작을 눌러 대기열에 참가합니다.
                </span>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 text-[#9cdcfe]">QUEUE_CATEGORY</span>
                <span className="text-[#80889a]">=</span>
                <div className="relative min-w-[11rem] max-w-[18rem] flex-1 leading-none">
                  <select
                    value={category}
                    onChange={(event) => onCategoryChange(event.target.value as QueueCategoryValue)}
                    className="h-7 w-full appearance-none rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 pr-6 text-xs text-[#ce9178] outline-none transition focus:border-[#4e89ff]/70"
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
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-500">
                    ▾
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2" style={editorRowStyle}>
                <span className="w-40 text-[#9cdcfe]">QUEUE_LEVEL</span>
                <span className="text-[#80889a]">=</span>
                <div className="flex flex-wrap gap-1 leading-none">
                  {difficultyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`rounded-sm border px-2 py-1 text-xs transition ${
                        difficulty === option.value
                          ? "border-[#4e89ff]/60 bg-[#2b3a52] text-[#dcdcaa]"
                          : "border-zinc-700 bg-[#2b2d30] text-[#9aa5b1] hover:bg-zinc-700/40"
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
                <span className="w-40 text-[#9cdcfe]">QUEUE_PARTY_SIZE</span>
                <span className="text-[#80889a]">=</span>
                <span className="inline-flex min-w-8 items-center justify-center rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 text-xs text-[#b5cea8]">
                  4
                </span>
              </div>
              <div className="flex items-start gap-2" style={editorRowStyle}>
                <span className="w-40 text-[#9cdcfe]">QUEUE_MEMO</span>
                <span className="pt-1 text-[#80889a]">=</span>
                <input
                  type="text"
                  value={queueMemo}
                  onChange={(event) => onQueueMemoChange(event.target.value)}
                  className="mt-0.5 h-7 w-full rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 text-xs text-[#ce9178] outline-none transition focus:border-[#4e89ff]/70"
                />
              </div>

              <div className="mt-2 text-[#6a717d]" style={editorLineStyle}>
                {showStopQueueButton ? (
                  <button
                    type="button"
                    onClick={onCancelQueue}
                    disabled={isBusy}
                    className="rounded-sm border border-zinc-700 bg-[#2b2d30] px-2 py-0.5 text-xs text-zinc-100 transition hover:bg-zinc-700/40 disabled:cursor-not-allowed disabled:text-zinc-500"
                  >
                    stopQueue();
                  </button>
                ) : null}
              </div>
              {error || terminalMessage ? (
                <div
                  className={`mt-1 rounded-sm border px-3 py-2 text-xs ${
                    error
                      ? "border-rose-400/60 bg-rose-900/20 text-rose-200"
                      : "border-zinc-700 bg-[#2b2d30] text-zinc-300"
                  }`}
                >
                  {error ?? terminalMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
