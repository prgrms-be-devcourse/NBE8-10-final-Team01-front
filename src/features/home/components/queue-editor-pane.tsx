import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";

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

function getNextEnabledCategoryIndex(
  options: QueueCategoryOption[],
  startIndex: number,
  step: 1 | -1,
  includeStart = true,
) {
  const length = options.length;

  if (length === 0) {
    return -1;
  }

  let index = startIndex;

  for (let attempt = 0; attempt < length; attempt += 1) {
    const normalizedIndex = ((index % length) + length) % length;
    const option = options[normalizedIndex];

    if ((includeStart || attempt > 0) && option && !option.disabled) {
      return normalizedIndex;
    }

    index += step;
  }

  return -1;
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
  showStopQueueButton,
  onCancelQueue,
  isBusy,
  error,
  terminalMessage,
}: QueueEditorPaneProps) {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const categoryOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const categoryListboxId = useId();

  const selectedCategoryIndex = useMemo(
    () => categoryOptions.findIndex((item) => item.value === category),
    [category, categoryOptions],
  );
  const selectedCategoryLabel =
    categoryOptions.find((item) => item.value === category)?.label ?? category;
  const categoryWidthCh = Math.min(
    36,
    Math.max(18, Math.ceil(estimateTextWidth(selectedCategoryLabel) + 8)),
  );
  const categoryControlWidth = `calc(${categoryWidthCh}ch + 0.9rem)`;
  const memoText = queueMemo.trim();
  const javaSyntaxTone = {
    "--app-syntax-default": "#a9b7c6",
    "--app-syntax-comment": "#808080",
    "--app-syntax-keyword": "#cc7832",
    "--app-syntax-name": "#3b9ef4",
    "--app-syntax-operator": "#a9b7c6",
    "--app-syntax-string": "#6aab73",
    "--app-syntax-value": "#a9b7c6",
    "--app-syntax-constant": "#c77dbb",
  } as CSSProperties;

  const closeCategoryMenu = useCallback((shouldFocusTrigger = false) => {
    setIsCategoryMenuOpen(false);
    setHighlightedCategoryIndex(-1);

    if (shouldFocusTrigger) {
      requestAnimationFrame(() => {
        categoryTriggerRef.current?.focus();
      });
    }
  }, []);

  const openCategoryMenu = useCallback(
    (direction: 1 | -1 = 1) => {
      const fallbackIndex =
        selectedCategoryIndex >= 0
          ? selectedCategoryIndex
          : direction === 1
            ? 0
            : categoryOptions.length - 1;
      const nextIndex = getNextEnabledCategoryIndex(
        categoryOptions,
        fallbackIndex,
        direction,
        true,
      );

      setHighlightedCategoryIndex(nextIndex);
      setIsCategoryMenuOpen(true);
    },
    [categoryOptions, selectedCategoryIndex],
  );

  const moveHighlightedCategory = useCallback(
    (direction: 1 | -1) => {
      setHighlightedCategoryIndex((currentIndex) => {
        const fallbackIndex =
          currentIndex >= 0
            ? currentIndex + direction
            : selectedCategoryIndex >= 0
              ? selectedCategoryIndex + direction
              : direction === 1
                ? 0
                : categoryOptions.length - 1;

        return getNextEnabledCategoryIndex(categoryOptions, fallbackIndex, direction, true);
      });
    },
    [categoryOptions, selectedCategoryIndex],
  );

  const handleCategorySelect = useCallback(
    (nextCategory: QueueCategoryValue) => {
      onCategoryChange(nextCategory);
      closeCategoryMenu(true);
    },
    [closeCategoryMenu, onCategoryChange],
  );

  const handleCategoryTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (isCategoryMenuOpen) {
          moveHighlightedCategory(1);
          return;
        }

        openCategoryMenu(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (isCategoryMenuOpen) {
          moveHighlightedCategory(-1);
          return;
        }

        openCategoryMenu(-1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (isCategoryMenuOpen) {
          closeCategoryMenu(false);
          return;
        }

        openCategoryMenu(1);
        return;
      }

      if (event.key === "Escape" && isCategoryMenuOpen) {
        event.preventDefault();
        closeCategoryMenu(false);
      }
    },
    [closeCategoryMenu, isCategoryMenuOpen, moveHighlightedCategory, openCategoryMenu],
  );

  const handleCategoryOptionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlightedCategory(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlightedCategory(-1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setHighlightedCategoryIndex(getNextEnabledCategoryIndex(categoryOptions, 0, 1, true));
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setHighlightedCategoryIndex(
          getNextEnabledCategoryIndex(categoryOptions, categoryOptions.length - 1, -1, true),
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeCategoryMenu(true);
        return;
      }

      if (event.key === "Tab") {
        closeCategoryMenu(false);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        const option = categoryOptions[index];
        if (option && !option.disabled) {
          handleCategorySelect(option.value);
        }
      }
    },
    [categoryOptions, closeCategoryMenu, handleCategorySelect, moveHighlightedCategory],
  );

  useEffect(() => {
    if (!isCategoryMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!categoryDropdownRef.current?.contains(event.target as Node)) {
        closeCategoryMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [closeCategoryMenu, isCategoryMenuOpen]);

  useEffect(() => {
    if (!isCategoryMenuOpen || highlightedCategoryIndex < 0) {
      return;
    }

    const optionNode = categoryOptionRefs.current[highlightedCategoryIndex];
    if (!optionNode) {
      return;
    }

    requestAnimationFrame(() => {
      optionNode.focus();
      optionNode.scrollIntoView({ block: "nearest" });
    });
  }, [highlightedCategoryIndex, isCategoryMenuOpen]);

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
              <span>Main.java</span>
              <span className="text-app-dim">×</span>
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
            </div>
          </div>
          <button
            type="button"
            onClick={onStartMatch}
            disabled={!canStartMatch}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-app-accent/45 bg-app-accent px-3 text-sm font-bold text-[#f8faff] transition hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-elevated disabled:text-app-secondary"
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
            <div className="px-4 py-4 text-app-syntax-default" style={javaSyntaxTone}>
              <div className="whitespace-nowrap text-app-syntax-comment" style={editorLineStyle}>
                {"// queue config"}
              </div>
              <div className="whitespace-nowrap" style={editorLineStyle}>
                <span className="text-app-syntax-comment">{"// "}</span>
                <span className="font-semibold" style={{ color: "#8cb34a" }}>
                  {"TODO:"}
                </span>
                <span style={{ color: "#8cb34a" }}>
                  {" "}
                  카테고리와 난이도를 선택하고 매칭 시작을 눌러 대기열에 참가합니다.
                </span>
              </div>
              <div className="whitespace-nowrap" style={editorLineStyle}>
                <span style={{ color: "#bbb529" }}>@BracketApplication</span>
                <span className="ml-3 inline-flex items-center gap-1 text-[11px] text-app-syntax-comment">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                    <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M3.5 12.5a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  <span>BracCo *</span>
                </span>
              </div>
              <div className="whitespace-nowrap" style={editorLineStyle}>
                <span className="text-app-syntax-keyword">public class </span>
                <span className="text-app-syntax-value">QueueMatchMain </span>
                <span className="text-app-syntax-operator">{"{"}</span>
              </div>
              <div className="whitespace-nowrap pl-6" style={editorLineStyle}>
                <span className="text-app-syntax-keyword">public static void </span>
                <span className="text-app-syntax-name">main</span>
                <span className="text-app-syntax-operator">(</span>
                <span className="text-app-syntax-value">String</span>
                <span className="text-app-syntax-operator">[] </span>
                <span className="text-app-syntax-value">args</span>
                <span className="text-app-syntax-operator">)</span>
                <span className="text-app-syntax-operator"> {"{"}</span>
              </div>
              <div className="whitespace-nowrap pl-12" style={editorLineStyle}>
                <span className="text-app-syntax-value">QueueConfig</span>
                <span className="text-app-syntax-default"> </span>
                <span className="text-app-syntax-value">queue</span>
                <span className="text-app-syntax-default"> </span>
                <span className="text-app-syntax-operator">=</span>
                <span className="text-app-syntax-default"> </span>
                <span className="text-app-syntax-value">QueueConfig</span>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default italic">builder</span>
                <span className="text-app-syntax-operator">()</span>
              </div>
              <div className="flex items-center whitespace-nowrap pl-16" style={editorRowStyle}>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default">category</span>
                <span className="text-app-syntax-operator">(</span>
                <span className="text-app-syntax-string">{'"'}</span>
                <div className="relative ml-0.5 w-fit max-w-full leading-none">
                  <div ref={categoryDropdownRef} className="relative">
                    <button
                      ref={categoryTriggerRef}
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isCategoryMenuOpen}
                      aria-controls={isCategoryMenuOpen ? categoryListboxId : undefined}
                      onClick={() => {
                        if (isCategoryMenuOpen) {
                          closeCategoryMenu(false);
                          return;
                        }

                        openCategoryMenu(1);
                      }}
                      onKeyDown={handleCategoryTriggerKeyDown}
                      className={`inline-flex h-7 max-w-full items-center rounded-sm border px-2 pr-7 text-left text-xs font-medium outline-none transition ${
                        isCategoryMenuOpen
                          ? "border-app-syntax-selected-border/90 bg-[#1c2230] text-[#e6f0ff] shadow-[0_0_0_1px_rgba(78,137,255,0.24),0_0_16px_rgba(78,137,255,0.16)]"
                          : "border-app-border/80 bg-[#1a1f27] text-[#d7e2f2] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-app-syntax-selected-border/65 hover:bg-[#1d2330]"
                      }`}
                      style={{ width: categoryControlWidth, maxWidth: "100%" }}
                    >
                      <span className="truncate">{selectedCategoryLabel}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#91c3ff]">
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                          <path
                            d="M4 6.25L8 10.25L12 6.25"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>

                    {isCategoryMenuOpen ? (
                      <div
                        id={categoryListboxId}
                        role="listbox"
                        aria-label="카테고리 선택"
                        className="absolute left-0 top-[calc(100%+0.35rem)] z-30 max-h-72 min-w-full overflow-y-auto rounded-md border border-app-border-strong bg-[#161b22] p-1 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.96),0_0_0_1px_rgba(78,137,255,0.12)]"
                        style={{
                          width: `max(${categoryControlWidth}, 16rem)`,
                          maxWidth: "min(22rem, calc(100vw - 5rem))",
                        }}
                      >
                        {categoryOptions.map((item, index) => {
                          const isDisabled = Boolean(item.disabled);
                          const isSelected = item.value === category;
                          const isHighlighted = index === highlightedCategoryIndex;

                          return (
                            <button
                              key={item.value}
                              ref={(node) => {
                                categoryOptionRefs.current[index] = node;
                              }}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              disabled={isDisabled}
                              tabIndex={isHighlighted ? 0 : -1}
                              onMouseEnter={() => {
                                if (!isDisabled) {
                                  setHighlightedCategoryIndex(index);
                                }
                              }}
                              onClick={() => {
                                if (!isDisabled) {
                                  handleCategorySelect(item.value);
                                }
                              }}
                              onKeyDown={(event) => handleCategoryOptionKeyDown(event, index)}
                              className={`flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left text-xs transition ${
                                isDisabled
                                  ? "cursor-not-allowed text-app-muted/65"
                                  : isSelected
                                    ? "bg-app-syntax-selected-bg text-app-syntax-selected-text shadow-[0_0_0_1px_rgba(78,137,255,0.2)]"
                                    : isHighlighted
                                      ? "bg-[#212938] text-[#edf4ff]"
                                      : "text-[#d7e2f2] hover:bg-[#212938] hover:text-[#edf4ff]"
                              }`}
                            >
                              <span className="truncate">{item.label}</span>
                              {isSelected ? (
                                <span className="ml-3 shrink-0 text-app-syntax-selected-border">
                                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                                    <path
                                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              ) : isDisabled ? (
                                <span className="ml-3 shrink-0 text-[10px] uppercase tracking-[0.16em] text-app-muted/55">
                                  SOON
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className="ml-0.5 text-app-syntax-string">{'"'}</span>
                <span className="text-app-syntax-operator">)</span>
              </div>
              <div className="flex items-center whitespace-nowrap pl-16" style={editorRowStyle}>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default">level</span>
                <span className="text-app-syntax-operator">(</span>
                <div className="ml-1 flex flex-wrap gap-1 leading-none">
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
                <span className="text-app-syntax-operator">)</span>
              </div>
              <div className="flex items-center whitespace-nowrap pl-16" style={editorRowStyle}>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default">partySize</span>
                <span className="text-app-syntax-operator">(</span>
                <span className="text-app-syntax-string">{'"'}</span>
                <span
                  title="배틀 규칙상 4인 고정"
                  className="inline-flex min-w-[8ch] items-center px-0.5 text-xs font-medium text-app-syntax-string"
                >
                  4인 고정
                </span>
                <span className="text-app-syntax-string">{'"'}</span>
                <span className="text-app-syntax-operator">)</span>
              </div>
              <div className="flex items-center whitespace-nowrap pl-16" style={editorRowStyle}>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default">memo</span>
                <span className="text-app-syntax-operator">(</span>
                <span className="text-app-syntax-string">{'"'}</span>
                <span className="text-xs font-medium text-app-syntax-string">
                  {memoText.length > 0 ? memoText : "메인에서 바로 매칭을 시작할 수 있습니다."}
                </span>
                <span className="text-app-syntax-string">{'"'}</span>
                <span className="text-app-syntax-operator">)</span>
              </div>
              <div className="whitespace-nowrap pl-16" style={editorLineStyle}>
                <span className="text-app-syntax-operator">.</span>
                <span className="text-app-syntax-default">build</span>
                <span className="text-app-syntax-operator">();</span>
              </div>
              <div className="whitespace-nowrap pl-6 text-app-syntax-operator" style={editorLineStyle}>
                {"}"}
              </div>
              <div className="whitespace-nowrap text-app-syntax-operator" style={editorLineStyle}>
                {"}"}
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
