"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReadyCheckState } from "@/shared/api/contracts";
import { ConfirmDialog } from "@/shared/ui";

import {
  formatClock,
  getReadyDecisionLabel,
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

interface ConsoleLogLine {
  id: number;
  time: string;
  level: "INFO" | "DEBUG" | "WARN" | "ERROR";
  message: string;
  count: number;
}

const CONSOLE_MAX_LINES = 90;
const SPRING_BOOT_VERSION = "v3.5.11";

const SPRING_BOOT_BANNER = String.raw`  .   ____                 _        _   __ _ _
 /\\ | __ ) _ __ __ _  ___| | _____| |_ \ \ \ \
( ( )|  _ \| '__/ _\` |/ __| |/ / _ \ __| \ \ \ \
 \\/ | |_) | | | (_| | (__|   <  __/ |_   ) ) ) )
  '  |____/|_|  \__,_|\___|_|\_\___|\__| / / / /
 =======================================/_/_/_/_/`;

function getModeHeadline(mode: Exclude<QueueModalMode, null>) {
  if (mode === "SEARCHING") {
    return "큐 매칭 중";
  }

  if (mode === "READY_CHECK") {
    return "Ready-check 진행 중";
  }

  if (mode === "ROOM_READY") {
    return "입장 준비 완료";
  }

  return "매칭 종료";
}

function getModeDescription(mode: Exclude<QueueModalMode, null>) {
  if (mode === "SEARCHING") {
    return "플레이어를 찾는 중입니다. 인원이 채워지면 자동으로 ready-check로 전환됩니다.";
  }

  if (mode === "READY_CHECK") {
    return "제한 시간 안에 수락 여부를 선택하세요. 전원 수락 시 즉시 배틀룸으로 연결됩니다.";
  }

  if (mode === "ROOM_READY") {
    return "모든 준비가 끝났습니다. 방 입장 연결을 시도하고 있습니다.";
  }

  return "이번 매칭 세션이 종료되었습니다. 종료 메시지를 확인하고 다시 시작하세요.";
}

function getLevelColor(level: ConsoleLogLine["level"]) {
  if (level === "INFO") {
    return "text-app-success";
  }

  if (level === "DEBUG") {
    return "text-app-accent-soft";
  }

  if (level === "WARN") {
    return "text-app-warn";
  }

  return "text-app-danger";
}

function getLoopInfoMessage(mode: Exclude<QueueModalMode, null>) {
  if (mode === "SEARCHING") {
    return "대기열에서 상대를 찾고 있습니다.";
  }

  if (mode === "READY_CHECK") {
    return "ready-check 응답을 기다리고 있습니다.";
  }

  if (mode === "ROOM_READY") {
    return "방 입장 연결을 시도하고 있습니다.";
  }

  return "매칭 세션이 종료되었습니다.";
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function buildBaseLoopMessages(
  mode: Exclude<QueueModalMode, null>,
  categoryLabel: string,
  difficultyLabel: string,
): Array<{ level: ConsoleLogLine["level"]; message: string }> {
  return [
    { level: "INFO", message: ":: Spring Queue :: (v1.0.0)" },
    {
      level: "DEBUG",
      message: `profile=queue/${categoryLabel.toLowerCase()}/${difficultyLabel.toLowerCase()}`,
    },
    { level: "INFO", message: `mode=${mode} initialized` },
    { level: "INFO", message: getLoopInfoMessage(mode) },
  ];
}

function buildDynamicEventMessages({
  mode,
  waitingCount,
  requiredCount,
  queueElapsedSeconds,
  countdownSeconds,
  readyCheck,
  roomId,
}: {
  mode: Exclude<QueueModalMode, null>;
  waitingCount: number;
  requiredCount: number;
  queueElapsedSeconds: number;
  countdownSeconds: number;
  readyCheck: ReadyCheckState | null;
  roomId: number | null;
}): Array<{ level: ConsoleLogLine["level"]; message: string }> {
  if (mode === "SEARCHING") {
    return [
      {
        level: "DEBUG",
        message: `queue waiting=${waitingCount}/${requiredCount} elapsed=${formatClock(queueElapsedSeconds)}`,
      },
      { level: "DEBUG", message: "socket heartbeat ok" },
      { level: "INFO", message: "matching engine scanning candidates..." },
    ];
  }

  if (mode === "READY_CHECK") {
    return [
      {
        level: "INFO",
        message: `ready-check accepted=${readyCheck?.acceptedCount ?? 0}/${readyCheck?.requiredCount ?? requiredCount}`,
      },
      { level: "WARN", message: `ready-check deadline T-${Math.max(countdownSeconds, 0)}s` },
      { level: "DEBUG", message: "waiting for participant decisions..." },
    ];
  }

  if (mode === "ROOM_READY") {
    return [
      { level: "INFO", message: `room join pending roomId=${roomId ?? "unknown"}` },
      { level: "DEBUG", message: "join handshake in progress..." },
      { level: "INFO", message: "room admission check passed" },
    ];
  }

  return [{ level: "WARN", message: "terminal flow reached" }];
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
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogLine[]>([]);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const logIdRef = useRef(0);
  const pidRef = useRef(24000 + Math.floor(Math.random() * 6000));
  const snapshotRef = useRef<{
    mode: QueueModalMode;
    waitingCount: number;
    acceptedCount: number;
    countdownSeconds: number;
    roomId: number | null;
    error: string | null;
    feedback: string;
    terminalMessage: string | null;
  }>({
    mode: null,
    waitingCount: 0,
    acceptedCount: 0,
    countdownSeconds: 0,
    roomId: null,
    error: null,
    feedback: "",
    terminalMessage: null,
  });

  const makeLogLine = useCallback(
    (level: ConsoleLogLine["level"], message: string): ConsoleLogLine => {
      logIdRef.current += 1;
      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      return {
        id: logIdRef.current,
        time: timestamp,
        level,
        message,
        count: 1,
      };
    },
    [],
  );

  const appendLog = useCallback(
    (level: ConsoleLogLine["level"], message: string) => {
      setConsoleLogs((prev) => {
        const nextLine = makeLogLine(level, message);

        if (prev.length > 0) {
          const lastLine = prev[prev.length - 1];
          if (lastLine && lastLine.level === level && lastLine.message === message) {
            const mergedLine: ConsoleLogLine = {
              ...lastLine,
              time: nextLine.time,
              count: (lastLine.count ?? 1) + 1,
            };
            const merged = [...prev.slice(0, -1), mergedLine];
            return merged;
          }
        }

        const next = [...prev, nextLine];
        if (next.length > CONSOLE_MAX_LINES) {
          return next.slice(next.length - CONSOLE_MAX_LINES);
        }
        return next;
      });
    },
    [makeLogLine],
  );

  useEffect(() => {
    if (!mode) {
      setConsoleLogs([]);
      setIsCancelConfirmOpen(false);
      snapshotRef.current = {
        mode: null,
        waitingCount: 0,
        acceptedCount: 0,
        countdownSeconds: 0,
        roomId: null,
        error: null,
        feedback: "",
        terminalMessage: null,
      };
      return;
    }

    const initialLogs: ConsoleLogLine[] = [
      makeLogLine("INFO", ":: Spring Queue :: (v1.0.0)"),
      makeLogLine("DEBUG", `profile=queue/${categoryLabel.toLowerCase()}/${difficultyLabel.toLowerCase()}`),
      makeLogLine("INFO", `mode=${mode} initialized`),
      makeLogLine("INFO", getLoopInfoMessage(mode)),
    ];

    setConsoleLogs(initialLogs);
    snapshotRef.current = {
      mode,
      waitingCount,
      acceptedCount: readyCheck?.acceptedCount ?? 0,
      countdownSeconds,
      roomId,
      error,
      feedback,
      terminalMessage,
    };
  }, [
    mode,
    categoryLabel,
    countdownSeconds,
    difficultyLabel,
    error,
    feedback,
    makeLogLine,
    readyCheck?.acceptedCount,
    roomId,
    terminalMessage,
    waitingCount,
  ]);

  useEffect(() => {
    if (mode !== "SEARCHING") {
      setIsCancelConfirmOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!mode) {
      return;
    }

    const prev = snapshotRef.current;

    if (mode === "SEARCHING" && waitingCount !== prev.waitingCount) {
      appendLog("DEBUG", `queue waiting=${waitingCount}/${requiredCount}`);
    }

    const nextAcceptedCount = readyCheck?.acceptedCount ?? 0;
    if (mode === "READY_CHECK" && nextAcceptedCount !== prev.acceptedCount) {
      appendLog("INFO", `ready-check accepted=${nextAcceptedCount}/${readyCheck?.requiredCount ?? requiredCount}`);
    }

    if (
      mode === "READY_CHECK" &&
      countdownSeconds !== prev.countdownSeconds &&
      countdownSeconds <= 10 &&
      countdownSeconds >= 0
    ) {
      appendLog("WARN", `ready-check deadline T-${countdownSeconds}s`);
    }

    if (roomId !== null && roomId !== prev.roomId) {
      appendLog("INFO", `room allocated roomId=${roomId}`);
    }

    if (error && error !== prev.error) {
      appendLog("ERROR", error);
    }

    if (feedback && feedback !== prev.feedback) {
      appendLog("INFO", feedback);
    }

    if (terminalMessage && terminalMessage !== prev.terminalMessage) {
      appendLog("WARN", terminalMessage);
    }

    if (mode === "TERMINAL" && prev.mode !== "TERMINAL") {
      appendLog("ERROR", "queue flow terminated by system state");
    }

    snapshotRef.current = {
      mode,
      waitingCount,
      acceptedCount: nextAcceptedCount,
      countdownSeconds,
      roomId,
      error,
      feedback,
      terminalMessage,
    };
  }, [
    appendLog,
    countdownSeconds,
    error,
    feedback,
    mode,
    readyCheck?.acceptedCount,
    readyCheck?.requiredCount,
    requiredCount,
    roomId,
    terminalMessage,
    waitingCount,
  ]);

  useEffect(() => {
    if (!mode) {
      return;
    }

    let cancelled = false;
    let timerId: number | null = null;
    let loopCursor = 0;

    const runLoop = () => {
      if (cancelled) {
        return;
      }

      const baseMessages = buildBaseLoopMessages(mode, categoryLabel, difficultyLabel);
      const nextBaseLine = baseMessages[loopCursor % baseMessages.length];
      loopCursor += 1;
      appendLog(nextBaseLine.level, nextBaseLine.message);

      if (mode !== "TERMINAL" && loopCursor % baseMessages.length === 0) {
        const dynamicLine = pickRandom(
          buildDynamicEventMessages({
            mode,
            waitingCount,
            requiredCount,
            queueElapsedSeconds,
            countdownSeconds,
            readyCheck,
            roomId,
          }),
        );

        if (dynamicLine) {
          appendLog(dynamicLine.level, dynamicLine.message);
        }
      }

      if (mode !== "TERMINAL" && Math.random() < 0.28) {
        const burstLine = pickRandom(
          buildDynamicEventMessages({
            mode,
            waitingCount,
            requiredCount,
            queueElapsedSeconds,
            countdownSeconds,
            readyCheck,
            roomId,
          }),
        );

        if (burstLine) {
          appendLog(burstLine.level, burstLine.message);
        }
      }

      const nextDelay = mode === "TERMINAL"
        ? 1200
        : 400 + Math.floor(Math.random() * 800);
      timerId = window.setTimeout(runLoop, nextDelay);
    };

    const firstDelay = mode === "TERMINAL" ? 900 : 450;
    timerId = window.setTimeout(runLoop, firstDelay);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [
    appendLog,
    categoryLabel,
    countdownSeconds,
    difficultyLabel,
    mode,
    queueElapsedSeconds,
    readyCheck,
    requiredCount,
    roomId,
    waitingCount,
  ]);

  useEffect(() => {
    if (!logViewportRef.current) {
      return;
    }

    logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight;
  }, [consoleLogs.length]);

  const modeStatus = useMemo(() => {
    if (mode === "SEARCHING") {
      return "매칭 대기 중";
    }

    if (mode === "READY_CHECK") {
      return "수락 확인 중";
    }

    if (mode === "ROOM_READY") {
      return "방 입장 준비 완료";
    }

    return "매칭 종료";
  }, [mode]);
  const actionButtonClass = "rounded-md border border-app-border-strong bg-app-elevated px-3 py-1.5 text-xs font-semibold text-app-primary transition hover:border-app-accent/55 hover:bg-app-accent/10 disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-base disabled:text-app-dim";
  const actionPrimaryButtonClass = "rounded-md border border-app-accent/45 bg-gradient-to-r from-app-accent to-app-accent-hover px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_0_1px_var(--app-accent-glow)] transition hover:from-app-accent-hover hover:to-app-accent disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-elevated disabled:text-app-secondary";
  const readyDecisionButtonBaseClass =
    "inline-flex items-center justify-center rounded-sm border px-3.5 py-1.5 text-xs font-semibold leading-none transition";
  const readyDecisionToneStyles = {
    accept: {
      active:
        "border-emerald-300 bg-emerald-400/30 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.45),0_0_12px_rgba(16,185,129,0.35)]",
      inactive:
        "border-emerald-500/35 bg-emerald-500/8 text-emerald-100/85 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] hover:bg-emerald-500/14 hover:text-emerald-50",
    },
    decline: {
      active:
        "border-rose-300 bg-rose-400/28 text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.45),0_0_12px_rgba(244,63,94,0.35)]",
      inactive:
        "border-rose-500/35 bg-rose-500/8 text-rose-100/85 shadow-[0_0_0_1px_rgba(244,63,94,0.12)] hover:bg-rose-500/14 hover:text-rose-50",
    },
  } as const;
  const headerStatusChipClass = "inline-flex items-center rounded-full border border-app-warn/45 bg-app-warn/10 px-2.5 py-0.5 text-[11px] font-semibold text-app-warn";
  const headerMetaChipClass = "inline-flex items-center rounded-full border border-app-border bg-app-base/55 px-2.5 py-0.5 text-[11px] font-medium text-app-muted";
  const headerMetaText = useMemo(() => {
    if (!mode) {
      return "";
    }

    if (mode === "SEARCHING") {
      return `대기 인원 ${waitingCount}/${requiredCount}명 · 경과 ${formatClock(queueElapsedSeconds)}`;
    }

    if (mode === "READY_CHECK") {
      return `수락 ${readyCheck?.acceptedCount ?? 0}/${readyCheck?.requiredCount ?? requiredCount}명 · 남은 시간 ${formatClock(countdownSeconds)}`;
    }

    if (mode === "ROOM_READY") {
      return `방 입장 준비 완료 · 방 번호 ${roomId ?? "확인 중"}`;
    }

    return "매칭 종료";
  }, [
    countdownSeconds,
    mode,
    queueElapsedSeconds,
    readyCheck?.acceptedCount,
    readyCheck?.requiredCount,
    requiredCount,
    roomId,
    waitingCount,
  ]);

  const footerMessage = useMemo(() => {
    if (!mode) {
      return "";
    }

    if (error) {
      return error;
    }

    if (terminalMessage) {
      return terminalMessage;
    }

    if (feedback.trim().length > 0) {
      return feedback;
    }

    return getModeDescription(mode);
  }, [error, feedback, mode, terminalMessage]);

  const summaryCountText = useMemo(() => {
    if (!mode) {
      return "";
    }

    if (mode === "SEARCHING") {
      return `${waitingCount}/${requiredCount}`;
    }

    if (mode === "READY_CHECK" || mode === "ROOM_READY") {
      return `${readyCheck?.acceptedCount ?? 0}/${readyCheck?.requiredCount ?? requiredCount}`;
    }

    return "0/0";
  }, [
    mode,
    readyCheck?.acceptedCount,
    readyCheck?.requiredCount,
    requiredCount,
    waitingCount,
  ]);

  const summaryModeText = useMemo(() => {
    if (!mode) {
      return "";
    }

    if (mode === "SEARCHING") {
      return "매칭 대기중";
    }

    if (mode === "READY_CHECK") {
      return "수락 확인중";
    }

    if (mode === "ROOM_READY") {
      return "입장 준비중";
    }

    return "매칭 종료";
  }, [mode]);

  const handleCancelClick = useCallback(() => {
    if (isPending) {
      return;
    }

    setIsCancelConfirmOpen(true);
  }, [isPending]);

  const handleCancelConfirm = useCallback(() => {
    if (isPending) {
      return;
    }

    setIsCancelConfirmOpen(false);
    onCancel();
  }, [isPending, onCancel]);

  const handleCancelDialogClose = useCallback(() => {
    if (isPending) {
      return;
    }

    setIsCancelConfirmOpen(false);
  }, [isPending]);

  const actionButtons = (
    <>
      {mode === "SEARCHING" ? (
        <button
          type="button"
          onClick={handleCancelClick}
          disabled={isPending}
          className={actionPrimaryButtonClass}
        >
          매칭 취소
        </button>
      ) : null}

      {mode === "READY_CHECK" ? (
        <div className="flex flex-wrap gap-1 leading-none">
          {!readyCheck?.acceptedByMe ? (
            <button
              type="button"
              onClick={onDecline}
              disabled={isPending || !readyCheck}
              className={`${readyDecisionButtonBaseClass} ${readyDecisionToneStyles.decline.inactive} disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-base disabled:text-app-dim disabled:shadow-none`}
            >
              거절
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAccept}
            disabled={isPending || !readyCheck || readyCheck.acceptedByMe}
            className={`${readyDecisionButtonBaseClass} ${
              readyCheck?.acceptedByMe
                ? `${readyDecisionToneStyles.accept.active} min-w-[102px] justify-center`
                : `${readyDecisionToneStyles.accept.inactive} disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-base disabled:text-app-dim disabled:shadow-none`
            }`}
          >
            {readyCheck?.acceptedByMe ? "수락 완료" : "수락"}
          </button>
        </div>
      ) : null}

      {mode === "ROOM_READY" ? (
        <button
          type="button"
          onClick={onRetryRoomEntry}
          disabled={isPending}
          className={actionButtonClass}
        >
          방 입장 재시도
        </button>
      ) : null}

      {mode === "TERMINAL" ? (
        <button
          type="button"
          onClick={onCloseTerminal}
          disabled={isPending}
          className={actionButtonClass}
        >
          닫기
        </button>
      ) : null}
    </>
  );

  if (!mode) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-app-base/30">
      <div className="queue-sheet w-full overflow-hidden border-t border-app-border bg-app-surface text-app-primary shadow-[0_-20px_48px_rgba(0,0,0,0.55)]">
        <div className="px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <span className={headerStatusChipClass}>{modeStatus}</span>
            <span className={headerMetaChipClass}>{categoryLabel}</span>
            <span className={headerMetaChipClass}>{difficultyLabel}</span>
            <p className="ml-auto text-xs font-medium text-app-muted">
              {headerMetaText}
            </p>
            <div className="flex flex-wrap items-center gap-2">{actionButtons}</div>
          </div>
          <section className="mt-3 overflow-hidden rounded-lg border border-app-border/70 bg-app-base shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="bg-app-elevated px-3 py-1.5 font-mono text-[11px] text-app-muted">
              /Users/chan/Library/Java/JavaVirtualMachines/graalvm-ce-21.0.2/Contents/Home/bin/java ...
            </div>

            <div className="grid max-h-[65vh] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0 px-3 py-3">
                <pre className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-mono text-[16px] leading-[1.2] text-app-secondary">
                  {SPRING_BOOT_BANNER}
                </pre>
                <p className="mt-2 font-mono text-sm text-app-success">
                  :: Bracket Boot ::                      ({SPRING_BOOT_VERSION})
                </p>
              </div>

              <div className="flex min-w-0 items-center justify-center px-3 py-3">
                <div className="w-full rounded-lg border border-app-border bg-app-surface/80 px-3 py-5 text-center">
                  <p className="font-mono text-4xl font-bold leading-none text-app-accent-soft">
                    {summaryCountText}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-app-secondary">{summaryModeText}</p>
                </div>
              </div>
            </div>

            <div
              ref={logViewportRef}
              className="mt-2 h-[30vh] min-h-[150px] overflow-y-auto px-3 py-2"
            >
              <div className="font-mono text-xs">
                {consoleLogs.map((line) => (
                  <p
                    key={line.id}
                    className="mb-0.5 whitespace-pre-wrap break-words leading-6 text-app-secondary"
                  >
                    <span className="text-app-dim">{line.time}</span>{" "}
                    <span className={`font-semibold ${getLevelColor(line.level)}`}>
                      {line.level}
                    </span>{" "}
                    <span>{line.message}</span>
                    {line.count > 1 ? (
                      <span className="ml-1 text-app-dim">(x{line.count})</span>
                    ) : null}
                  </p>
                ))}
              </div>
            </div>

            <div
              className={`px-3 py-1.5 text-xs ${
                error || mode === "TERMINAL"
                  ? "bg-app-danger/10 text-app-danger"
                  : "bg-app-elevated text-app-muted"
              }`}
            >
              {footerMessage}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={isCancelConfirmOpen}
        title="매칭을 취소할까요?"
        description="현재 대기열에서 즉시 이탈합니다. 다시 시작하려면 매칭 시작을 다시 눌러야 합니다."
        confirmLabel="매칭 취소"
        cancelLabel="계속 대기"
        confirmTone="default"
        disabled={isPending}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelDialogClose}
      />

      <style jsx>{`
        .queue-sheet {
          animation: queue-sheet-slide-up 180ms ease-out;
        }

        @keyframes queue-sheet-slide-up {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
