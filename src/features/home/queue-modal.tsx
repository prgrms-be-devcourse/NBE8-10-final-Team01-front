"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReadyCheckState } from "@/shared/api/contracts";
import { StatusPill } from "@/shared/ui";

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
}

const CONSOLE_MAX_LINES = 90;

const SPRING_BOOT_BANNER = String.raw`  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _\` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  ' |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/`;

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
    return "text-emerald-400";
  }

  if (level === "DEBUG") {
    return "text-cyan-400";
  }

  if (level === "WARN") {
    return "text-amber-300";
  }

  return "text-rose-300";
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

function getModeStatusLine({
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
}) {
  if (mode === "SEARCHING") {
    return `상태: 상대를 찾는 중 (${waitingCount}/${requiredCount}명) · 경과 ${formatClock(queueElapsedSeconds)}`;
  }

  if (mode === "READY_CHECK") {
    return `상태: 수락 확인 중 (${readyCheck?.acceptedCount ?? 0}/${readyCheck?.requiredCount ?? requiredCount}명 수락) · 남은 시간 ${formatClock(countdownSeconds)} · 경과 ${formatClock(queueElapsedSeconds)}`;
  }

  if (mode === "ROOM_READY") {
    return `상태: 입장 준비 완료 · 방 번호 ${roomId ?? "확인 중"} · 수락 ${readyCheck?.acceptedCount ?? 0}/${readyCheck?.requiredCount ?? requiredCount}명`;
  }

  return "상태: 매칭 종료";
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
      };
    },
    [],
  );

  const appendLog = useCallback(
    (level: ConsoleLogLine["level"], message: string) => {
      setConsoleLogs((prev) => {
        const next = [...prev, makeLogLine(level, message)];
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

  const modalTone = useMemo(() => {
    if (mode === "TERMINAL") {
      return "danger";
    }

    if (mode === "ROOM_READY") {
      return "success";
    }

    return "warn";
  }, [mode]);

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

  const modeStatusLine = useMemo(
    () => {
      if (!mode) {
        return "";
      }

      return getModeStatusLine({
        mode,
        waitingCount,
        requiredCount,
        queueElapsedSeconds,
        countdownSeconds,
        readyCheck,
        roomId,
      });
    },
    [
      countdownSeconds,
      mode,
      queueElapsedSeconds,
      readyCheck,
      requiredCount,
      roomId,
      waitingCount,
    ],
  );

  const actionButtonClass = "rounded-md border border-zinc-600 bg-[#171f2c] px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-violet-400/55 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-[#141a24] disabled:text-zinc-500";

  if (!mode) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-zinc-950/30">
      <div className="queue-sheet w-full overflow-hidden border-t border-zinc-700 bg-[#12161f] text-zinc-200 shadow-[0_-20px_48px_rgba(0,0,0,0.55)]">
        <div className="px-4 pb-4 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-zinc-600/80" />
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-700 pb-2">
            <StatusPill tone={modalTone}>{modeStatus}</StatusPill>
            <StatusPill>{categoryLabel}</StatusPill>
            <StatusPill>{difficultyLabel}</StatusPill>
            <p className="ml-auto text-xs font-medium text-zinc-400">
              {getModeHeadline(mode)} · pid {pidRef.current}
            </p>
          </div>
          <section className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-[#0b1018]">
            <div className="border-b border-zinc-700 bg-[#1a202c] px-3 py-1.5 font-mono text-[11px] text-zinc-400">
              /Users/chan/Library/Java/JavaVirtualMachines/graalvm-ce-21.0.2/Contents/Home/bin/java ...
            </div>

            <div className="grid max-h-[65vh] grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="min-w-0 px-3 py-3">
                <pre className="overflow-x-auto font-mono text-[10px] leading-4 text-zinc-500">
                  {SPRING_BOOT_BANNER}
                </pre>
              </div>

              <div className="min-w-0 px-3 py-3">
                <div className="space-y-1 font-mono text-xs leading-6">
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">$</span>{" "}
                    <span className="text-cyan-300">{modeStatusLine}</span>
                  </p>
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">$</span>{" "}
                    <span>{getModeDescription(mode)}</span>
                  </p>
                  <p className="text-zinc-400">
                    <span className="text-zinc-500">$</span>{" "}
                    선택 설정: 카테고리 {categoryLabel}, 난이도 {difficultyLabel}, 세션 ID {pidRef.current}
                  </p>
                  {readyCheck?.participants?.length ? (
                    <p className="text-zinc-400">
                      <span className="text-zinc-500">$</span>{" "}
                      {readyCheck.participants
                        .map((participant) => `${participant.nickname}${participant.userId === currentUserId ? "(ME)" : ""}:${getReadyDecisionLabel(participant.decision)}`)
                        .join(" | ")}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {mode === "SEARCHING" ? (
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={isPending}
                      className={actionButtonClass}
                    >
                      매칭 취소
                    </button>
                  ) : null}

                  {mode === "READY_CHECK" ? (
                    <>
                      <button
                        type="button"
                        onClick={onDecline}
                        disabled={isPending || !readyCheck}
                        className={actionButtonClass}
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        onClick={onAccept}
                        disabled={isPending || !readyCheck || readyCheck.acceptedByMe}
                        className={actionButtonClass}
                      >
                        {readyCheck?.acceptedByMe ? "수락 완료" : "수락"}
                      </button>
                    </>
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
                </div>
              </div>
            </div>

            <div
              ref={logViewportRef}
              className="h-[30vh] min-h-[150px] overflow-y-auto px-3 py-2"
            >
              <div className="font-mono text-xs">
                {consoleLogs.map((line) => (
                  <p
                    key={line.id}
                    className="mb-0.5 whitespace-pre-wrap break-words leading-6 text-zinc-300"
                  >
                    <span className="text-zinc-500">{line.time}</span>{" "}
                    <span className={`font-semibold ${getLevelColor(line.level)}`}>
                      {line.level}
                    </span>{" "}
                    <span>{line.message}</span>
                  </p>
                ))}
              </div>
            </div>

            <div
              className={`px-3 py-1.5 text-xs ${
                error || mode === "TERMINAL"
                  ? "bg-rose-500/10 text-rose-200"
                  : "bg-[#151d2a] text-zinc-400"
              }`}
            >
              {error ?? terminalMessage ?? feedback}
            </div>
          </section>
        </div>
      </div>

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
