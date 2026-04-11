"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  BattleRoomStateResponse,
  BattleStartedWsMessage,
  JoinRoomResponse,
  ParticipantStatusChangedWsMessage,
  ProblemDetailResponse,
  RoomResponse,
  RunTestCaseResult,
  RunWsMessage,
  SubmissionResponse,
  SubmissionWsMessage,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
import { ConfirmDialog, DefinitionGrid, MathText, Panel, StatusPill } from "@/shared/ui";
import {
  readPreferredEditorLanguage,
  writePreferredEditorLanguage,
} from "@/shared/utils/editor-language";

import BattleRoomLoading from "@/app/battle/rooms/[roomId]/loading";
import {
  getBattleRoom,
  getProblemDetail,
  submitTemplate,
} from "./data";

const BattleCodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[26rem] items-center justify-center rounded-2xl border border-app-border bg-app-surface text-sm text-app-secondary">
      에디터를 준비하는 중입니다.
    </div>
  ),
});

const MIN_LEFT_RATIO = 0;
const MAX_LEFT_RATIO = 78;
const MIN_TOP_RATIO = 24;
const MAX_TOP_RATIO = 100;
const LEFT_RATIO_SNAP_POINTS = [0, 22, 32, 50, 68, 78];
const TOP_RATIO_SNAP_POINTS = [24, 34, 50, 66, 76, 92, 100];
const SPLIT_SNAP_GAP = 4;
const DEFAULT_LEFT_PANE_RATIO = 50;
const DEFAULT_RIGHT_TOP_PANE_RATIO = 100;
const BATTLE_LAYOUT_STORAGE_KEY = "bracket:battle-editor-layout:v1";
const TESTCASE_SHORTCUT_HINT = "⌘/Ctrl+Enter: Run · Shift+Enter: Submit";
const fallbackLanguages = ["python3", "java", "javascript"];
const defaultCodeByLanguage: Record<string, string> = {
  javascript: `function solve(input) {\n  // TODO: implement\n}\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    // TODO: implement\n  }\n}\n`,
  python3: `def solve():\n    # TODO: implement\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
  python: `def solve():\n    # TODO: implement\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
};

type LeftPanelTab = "description" | "submission";

interface CaseBadgeState {
  label: string;
  tone: "pending" | "pass" | "fail";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapRatio(value: number, points: number[], gap: number) {
  const nearest = points.find((point) => Math.abs(value - point) <= gap);
  return nearest ?? value;
}

function readStoredLayout() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BATTLE_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      leftPaneRatio?: number;
      rightTopPaneRatio?: number;
    };

    const leftPaneRatio =
      typeof parsed.leftPaneRatio === "number"
        ? clamp(parsed.leftPaneRatio, MIN_LEFT_RATIO, MAX_LEFT_RATIO)
        : DEFAULT_LEFT_PANE_RATIO;
    const rightTopPaneRatio =
      typeof parsed.rightTopPaneRatio === "number"
        ? clamp(parsed.rightTopPaneRatio, MIN_TOP_RATIO, MAX_TOP_RATIO)
        : DEFAULT_RIGHT_TOP_PANE_RATIO;

    return {
      leftPaneRatio,
      rightTopPaneRatio,
    };
  } catch {
    return null;
  }
}

function normalizeVerdict(verdict: string | undefined) {
  return (verdict ?? "").trim().toUpperCase();
}

function isPassVerdict(verdict: string | undefined) {
  const normalized = normalizeVerdict(verdict);
  return normalized === "AC" || normalized === "PASS";
}

function isWrongAnswerVerdict(verdict: string | undefined) {
  const normalized = normalizeVerdict(verdict);
  return normalized === "WA" || normalized === "WRONG_ANSWER" || normalized === "WRONG ANSWER";
}

function getCaseBadgeState(
  result: RunTestCaseResult | undefined,
): CaseBadgeState | null {
  if (!result) {
    return null;
  }

  if (normalizeVerdict(result.status) === "RUNNING") {
    return { label: "RUNNING", tone: "pending" };
  }

  if (isPassVerdict(result.status)) {
    return { label: "PASS", tone: "pass" };
  }

  if (isWrongAnswerVerdict(result.status)) {
    return { label: "WA", tone: "fail" };
  }

  return { label: normalizeVerdict(result.status) || "FAIL", tone: "fail" };
}

function createFallbackCaseResult(
  status: string,
  input: string,
  expectedOutput: string,
  stderr: string | null = null,
): RunTestCaseResult {
  return {
    input,
    expectedOutput,
    actualOutput: null,
    status,
    stderr,
  };
}

function mapRunResultsByCaseIndex(
  incomingResults: RunTestCaseResult[],
  sampleCases: ProblemDetailResponse["sampleCases"],
): RunTestCaseResult[] {
  const sampleCaseList = sampleCases ?? [];
  const totalCaseCount = Math.max(sampleCaseList.length, incomingResults.length);

  return Array.from({ length: totalCaseCount }, (_, index) => {
    const result = incomingResults[index];

    if (result) {
      return result;
    }

    const sampleCase = sampleCaseList[index];
    return createFallbackCaseResult(
      "NO_RESULT",
      sampleCase?.input ?? "(empty)",
      sampleCase?.output ?? "(empty)",
      "해당 케이스 실행 결과를 받지 못했습니다.",
    );
  });
}

function resolveLanguages(problem: ProblemDetailResponse | null, currentLanguage: string) {
  const base =
    problem?.supportedLanguages && problem.supportedLanguages.length > 0
      ? problem.supportedLanguages
      : fallbackLanguages;

  if (base.includes(currentLanguage)) {
    return base;
  }

  return [currentLanguage, ...base];
}

function resolveStarterCode(problem: ProblemDetailResponse | null, language: string) {
  const fromApi = problem?.starterCodes?.find((item) => item.language === language)?.code;

  if (fromApi) {
    return fromApi;
  }

  return defaultCodeByLanguage[language] ?? defaultCodeByLanguage.javascript;
}

function resolveDefaultLanguage(problem: ProblemDetailResponse | null, currentLanguage: string) {
  const languages = resolveLanguages(problem, currentLanguage);

  if (problem?.defaultLanguage && languages.includes(problem.defaultLanguage)) {
    return problem.defaultLanguage;
  }

  return languages[0];
}

function getSubmitHeadline(isSubmitting: boolean, result: string | null | undefined) {
  const code = normalizeVerdict(result ?? undefined);

  if (isSubmitting) {
    return "Submitting";
  }

  if (code === "JUDGING") {
    return "Judging";
  }

  if (code === "AC" || code === "ACCEPTED") {
    return "Accepted";
  }

  if (code === "WA" || code === "WRONG_ANSWER" || code === "WRONG ANSWER") {
    return "Wrong Answer";
  }

  if (code === "CE" || code === "COMPILE_ERROR" || code === "COMPILE ERROR") {
    return "Compile Error";
  }

  if (code === "RE" || code === "RUNTIME_ERROR" || code === "RUNTIME ERROR") {
    return "Runtime Error";
  }

  if (code === "TLE" || code === "TIME_LIMIT_EXCEEDED" || code === "TIME LIMIT EXCEEDED") {
    return "Time Limit Exceeded";
  }

  return code || "Submission";
}

export default function BattleRoomScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [showSpectateDialog, setShowSpectateDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const bypassGuardRef = useRef(false);
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [latestSubmission, setLatestSubmission] =
    useState<SubmissionResponse | null>(null);
  const [language, setLanguage] = useState(
    () => readPreferredEditorLanguage() ?? submitTemplate.language,
  );
  const [code, setCode] = useState(() => {
    const preferredLanguage = readPreferredEditorLanguage() ?? submitTemplate.language;
    return defaultCodeByLanguage[preferredLanguage] ?? submitTemplate.code;
  });
  const [runResults, setRunResults] = useState<RunTestCaseResult[] | null>(null);
  const [selectedRunCaseIndex, setSelectedRunCaseIndex] = useState<number | null>(null);
  const [runningCaseIndex, setRunningCaseIndex] = useState<number | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("description");
  const [leftPaneRatio, setLeftPaneRatio] = useState(() => {
    const stored = readStoredLayout();
    return stored?.leftPaneRatio ?? DEFAULT_LEFT_PANE_RATIO;
  });
  const [rightTopPaneRatio, setRightTopPaneRatio] = useState(() => {
    const stored = readStoredLayout();
    return stored?.rightTopPaneRatio ?? DEFAULT_RIGHT_TOP_PANE_RATIO;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("배틀룸 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedJoinRef = useRef(false);
  const joinRequestInFlightRef = useRef(false);
  const lastRejoinAttemptAtRef = useRef(0);
  const roomRef = useRef<RoomResponse | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const leftPaneRatioRef = useRef(leftPaneRatio);
  const rightTopPaneRatioRef = useRef(rightTopPaneRatio);
  const sampleCasesRef = useRef(problem?.sampleCases ?? []);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myParticipantStatus = room?.participants.find(
    (p) => p.userId === session.member?.memberId,
  )?.status;
  const shouldGuard =
    room?.status === "PLAYING" &&
    (myParticipantStatus === "PLAYING" || myParticipantStatus === "ABANDONED");

  // 탭 닫기 / 새로고침 가드
  useEffect(() => {
    if (!shouldGuard) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldGuard]);

  // 뒤로가기 가드 — 히스토리 스택에 더미 엔트리를 쌓아 popstate를 가로챔
  useEffect(() => {
    if (!shouldGuard) return;

    window.history.pushState(null, "", window.location.href);

    const handler = () => {
      if (bypassGuardRef.current) return;
      window.history.pushState(null, "", window.location.href);
      pendingNavRef.current = () => {
        bypassGuardRef.current = true;
        window.history.go(-2);
      };
      setShowExitDialog(true);
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [router, shouldGuard]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;

    const syncOverflowLock = () => {
      if (mediaQuery.matches) {
        body.style.overflow = "hidden";
        html.style.overflow = "hidden";
        return;
      }

      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };

    syncOverflowLock();
    mediaQuery.addEventListener("change", syncOverflowLock);

    return () => {
      mediaQuery.removeEventListener("change", syncOverflowLock);
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const sampleCaseCount = problem?.sampleCases?.length ?? 0;
    const runCaseCount = runResults?.length ?? 0;
    const totalCaseCount = Math.max(sampleCaseCount, runCaseCount);

    if (totalCaseCount === 0) {
      setSelectedRunCaseIndex(null);
      return;
    }

    setSelectedRunCaseIndex((current) => {
      if (current !== null && current >= 0 && current < totalCaseCount) {
        return current;
      }

      return 0;
    });
  }, [problem, runResults]);

  useEffect(() => {
    leftPaneRatioRef.current = leftPaneRatio;
  }, [leftPaneRatio]);

  useEffect(() => {
    rightTopPaneRatioRef.current = rightTopPaneRatio;
  }, [rightTopPaneRatio]);

  useEffect(() => {
    sampleCasesRef.current = problem?.sampleCases ?? [];
  }, [problem]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      BATTLE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftPaneRatio,
        rightTopPaneRatio,
      }),
    );
  }, [leftPaneRatio, rightTopPaneRatio]);

  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    let active = true;

    void (async () => {
      if (!session.authenticated) {
        if (!active) {
          return;
        }

        setRoom(null);
        setProblem(null);
        setError(null);
        setMessage("배틀룸은 로그인 후 접근할 수 있습니다.");
        return;
      }

      setError(null);

      const roomResponse = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (!roomResponse.ok) {
        if (roomResponse.status === 401) {
          void refreshSession();
        }

        const fallbackRoom = getBattleRoom(roomId);

        if (fallbackRoom) {
          if (!active) {
            return;
          }
          const fallbackProblem = getProblemDetail(fallbackRoom.problemId);
          const preferredLanguage = readPreferredEditorLanguage();
          const supportedLanguages = fallbackProblem?.supportedLanguages ?? [];
          const nextLanguage =
            preferredLanguage &&
            (supportedLanguages.length === 0 || supportedLanguages.includes(preferredLanguage))
              ? preferredLanguage
              : resolveDefaultLanguage(fallbackProblem, submitTemplate.language);
          const nextStarterCode = resolveStarterCode(fallbackProblem, nextLanguage);
          roomRef.current = fallbackRoom;
          setRoom(fallbackRoom);
          setProblem(fallbackProblem);
          setLanguage(nextLanguage);
          setCode(nextStarterCode);
          setMessage("백엔드 연결 실패로 샘플 배틀룸을 표시합니다.");
          return;
        }

        const payload = (await roomResponse.json().catch(() => null)) as ApiErrorResponse | null;

        if (!active) {
          return;
        }

        setRoom(null);
        setProblem(null);
        setError(payload?.message ?? "배틀룸을 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await roomResponse.json()) as RoomResponse;

      if (!active) {
        return;
      }

      roomRef.current = nextRoom;
      setRoom(nextRoom);

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        if (!active) {
          return;
        }

        const nextProblem = (await problemResponse.json()) as ProblemDetailResponse;
        const fallbackProblem = getProblemDetail(nextRoom.problemId);
        const mergedProblem =
          fallbackProblem
            ? {
                ...fallbackProblem,
                ...nextProblem,
                sampleCases:
                  nextProblem.sampleCases && nextProblem.sampleCases.length > 0
                    ? nextProblem.sampleCases
                    : fallbackProblem.sampleCases,
                starterCodes:
                  nextProblem.starterCodes && nextProblem.starterCodes.length > 0
                    ? nextProblem.starterCodes
                    : fallbackProblem.starterCodes,
                supportedLanguages:
                  nextProblem.supportedLanguages && nextProblem.supportedLanguages.length > 0
                    ? nextProblem.supportedLanguages
                    : fallbackProblem.supportedLanguages,
                defaultLanguage: nextProblem.defaultLanguage ?? fallbackProblem.defaultLanguage,
              }
            : nextProblem;
        const preferredLanguage = readPreferredEditorLanguage();
        const supportedLanguages = mergedProblem?.supportedLanguages ?? [];
        const nextLanguage =
          preferredLanguage &&
          (supportedLanguages.length === 0 || supportedLanguages.includes(preferredLanguage))
            ? preferredLanguage
            : resolveDefaultLanguage(mergedProblem, submitTemplate.language);
        const nextStarterCode = resolveStarterCode(mergedProblem, nextLanguage);

        let redisCode: string | null = null;
        const stateRes = await fetch(`/api/battle/rooms/${roomId}/state`, { cache: "no-store" });
        if (active && stateRes.ok) {
          const stateData = (await stateRes.json()) as BattleRoomStateResponse;
          if (typeof stateData.myCode === "string" && stateData.myCode.length > 0) {
            redisCode = stateData.myCode;
          }
        }

        if (!active) return;

        setProblem(mergedProblem);
        setLanguage(nextLanguage);
        setCode(redisCode ?? nextStarterCode);
        setMessage("");
      } else {
        if (!active) {
          return;
        }
        const fallbackProblem = getProblemDetail(nextRoom.problemId);
        const preferredLanguage = readPreferredEditorLanguage();
        const supportedLanguages = fallbackProblem?.supportedLanguages ?? [];
        const nextLanguage =
          preferredLanguage &&
          (supportedLanguages.length === 0 || supportedLanguages.includes(preferredLanguage))
            ? preferredLanguage
            : resolveDefaultLanguage(fallbackProblem, submitTemplate.language);
        const nextStarterCode = resolveStarterCode(fallbackProblem, nextLanguage);

        let redisCode: string | null = null;
        const stateRes = await fetch(`/api/battle/rooms/${roomId}/state`, { cache: "no-store" });
        if (active && stateRes.ok) {
          const stateData = (await stateRes.json()) as BattleRoomStateResponse;
          if (typeof stateData.myCode === "string" && stateData.myCode.length > 0) {
            redisCode = stateData.myCode;
          }
        }

        if (!active) return;

        setProblem(fallbackProblem);
        setLanguage(nextLanguage);
        setCode(redisCode ?? nextStarterCode);
        setMessage("문제 상세 조회에 실패해 샘플 설명을 함께 표시합니다.");
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshSession, roomId, session.authenticated, sessionLoaded]);

  useEffect(() => {
    hasAttemptedJoinRef.current = false;
    joinRequestInFlightRef.current = false;
    lastRejoinAttemptAtRef.current = 0;
    setLatestSubmission(null);
    setIsSubmitting(false);
    setLeftPanelTab("description");
  }, [roomId]);

  useEffect(() => {
    if (!room || !session.authenticated || !session.member || joinRequestInFlightRef.current) {
      return;
    }

    const participant = room.participants.find(
      (item) => item.userId === session.member?.memberId,
    );

    const shouldJoinFromWaiting =
      room.status === "WAITING" &&
      participant?.status === "READY" &&
      !hasAttemptedJoinRef.current;
    const shouldRejoinFromPlaying =
      room.status === "PLAYING" &&
      participant?.status === "ABANDONED";

    if (!shouldJoinFromWaiting && !shouldRejoinFromPlaying) {
      return;
    }

    if (shouldRejoinFromPlaying) {
      const now = Date.now();
      // 재연결 상태에서는 짧은 텀으로 재시도하되 과도한 join 요청 폭주를 막는다.
      if (now - lastRejoinAttemptAtRef.current < 2000) {
        return;
      }
      lastRejoinAttemptAtRef.current = now;
    }

    if (shouldJoinFromWaiting) {
      hasAttemptedJoinRef.current = true;
    }

    joinRequestInFlightRef.current = true;

    const finalizeJoinAttempt = () => {
      joinRequestInFlightRef.current = false;
    };

    if (!participant) {
      finalizeJoinAttempt();
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/battle/rooms/${roomId}/join`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          if (shouldJoinFromWaiting) {
            setError(payload?.message ?? "배틀룸 입장에 실패했습니다.");
            hasAttemptedJoinRef.current = false;
          }
          return;
        }

        const payload = (await response.json()) as JoinRoomResponse;
        setMessage(`배틀룸 입장 처리 완료: ${payload.status}`);

        const refreshed = await fetch(`/api/battle/rooms/${roomId}`, {
          cache: "no-store",
        });

        if (refreshed.ok) {
          const refreshedRoom = (await refreshed.json()) as RoomResponse;
          roomRef.current = refreshedRoom;
          setRoom(refreshedRoom);
        }

        const stateResponse = await fetch(`/api/battle/rooms/${roomId}/state`, {
          cache: "no-store",
        });

        if (stateResponse.ok) {
          const stateData = (await stateResponse.json()) as BattleRoomStateResponse;

          if (typeof stateData.myCode === "string" && stateData.myCode.length > 0) {
            setCode(stateData.myCode);
          }
        }
      } finally {
        finalizeJoinAttempt();
      }
    })();
  }, [room, roomId, session.authenticated, session.member?.memberId]);

  useEffect(() => {
    if (!session.authenticated) {
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/ws`),
      reconnectDelay: 3000,
      beforeConnect: async () => {
        client.connectHeaders = {};

        try {
          const res = await fetch("/api/v1/ws/token", { method: "POST" });

          if (res.ok) {
            const data = (await res.json()) as { token: string };
            client.connectHeaders = { "X-WS-Token": data.token };
          }
        } catch {
          console.warn("[WS] 토큰 발급 실패, 쿠키 기반 인증으로 폴백");
        }
      },
      onConnect: () => {
        // 재연결 시 서버 상태를 재조회해 ABANDONED 여부를 확인한다.
        // WS가 끊긴 동안 백엔드가 participant를 ABANDONED로 전환했을 수 있지만,
        // 끊겨 있는 동안은 이벤트를 받지 못하므로 roomRef는 여전히 PLAYING을 가리킨다.
        // roomRef가 null이면 초기 연결이므로 스킵 (별도 useEffect가 초기 room 조회를 담당).
        if (roomRef.current !== null) {
          void fetch(`/api/battle/rooms/${roomId}`, { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: RoomResponse | null) => {
              if (data) {
                roomRef.current = data;
                setRoom(data);
                // setRoom 후 shouldRejoinFromPlaying useEffect가 ABANDONED 여부를 감지해 join 처리
              }
            });
        }

        client.subscribe(`/topic/room/${roomId}`, (message) => {
          let payload: unknown;

          try {
            payload = JSON.parse(message.body) as unknown;
          } catch {
            return;
          }

          if (typeof payload !== "object" || payload === null || !("type" in payload)) {
            return;
          }

          const type = (payload as { type: unknown }).type;

          if (type === "BATTLE_STARTED") {
            const msg = payload as BattleStartedWsMessage;
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                status: "PLAYING" as const,
                timerEnd:
                  typeof msg.timerEnd === "string" || msg.timerEnd === null
                    ? msg.timerEnd
                    : current.timerEnd,
              };
              roomRef.current = nextRoom;
              return nextRoom;
            });
            return;
          }

          if (type === "PARTICIPANT_STATUS_CHANGED") {
            const msg = payload as ParticipantStatusChangedWsMessage;
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                participants: current.participants.map((participant) =>
                  participant.userId === msg.userId
                    ? { ...participant, status: msg.status }
                    : participant,
                ),
              };
              roomRef.current = nextRoom;
              return nextRoom;
            });
            return;
          }

          if (type === "PARTICIPANT_DONE") {
            void fetch(`/api/battle/rooms/${roomId}`, { cache: "no-store" })
              .then((res) => (res.ok ? res.json() : null))
              .then((data: RoomResponse | null) => {
                if (data) {
                  roomRef.current = data;
                  setRoom(data);
                }
              });
            return;
          }

          if (type === "BATTLE_FINISHED") {
            setRoom((current) => {
              if (!current) {
                return current;
              }

              const nextRoom = {
                ...current,
                status: "FINISHED" as const,
              };
              roomRef.current = nextRoom;
              return nextRoom;
            });
            return;
          }

          if (type === "SUBMISSION") {
            const msg = payload as SubmissionWsMessage;

            if (msg.userId === session.member?.memberId) {
              setLeftPanelTab("submission");
              setLatestSubmission((prev) =>
                prev
                  ? {
                      ...prev,
                      result: msg.result,
                      passedCount: msg.passedCount,
                      totalCount: msg.totalCount,
                    }
                  : {
                      submissionId: 0,
                      result: msg.result,
                      passedCount: msg.passedCount,
                      totalCount: msg.totalCount,
                    },
              );
              setIsSubmitting(false);
              setMessage(`채점 완료: ${msg.result} (${msg.passedCount}/${msg.totalCount})`);

              const normalizedResult = normalizeVerdict(msg.result);
              if (normalizedResult === "AC" || normalizedResult === "ACCEPTED") {
                setShowSpectateDialog(true);
              }
            }
          }
        });

        client.subscribe(`/topic/room/${roomId}/run`, (message) => {
          let payload: unknown;

          try {
            payload = JSON.parse(message.body) as unknown;
          } catch {
            return;
          }

          if (typeof payload !== "object" || payload === null || !("type" in payload)) {
            return;
          }

          const msg = payload as RunWsMessage;

          if (msg.type === "RUN_RESULT" && msg.userId === session.member?.memberId) {
            setRunResults(mapRunResultsByCaseIndex(msg.results, sampleCasesRef.current));
            setRunningCaseIndex(null);
          }
        });
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      stompClientRef.current = null;
      void client.deactivate();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [roomId, session.authenticated, session.member?.memberId]);

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    setCode(resolveStarterCode(problem, nextLanguage));
    writePreferredEditorLanguage(nextLanguage);
  }

  function handleCodeChange(nextCode: string) {
    setCode(nextCode);

    if (!stompClientRef.current?.connected || room?.status !== "PLAYING") return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (!stompClientRef.current?.connected || room?.status !== "PLAYING") return;
      stompClientRef.current.publish({
        destination: `/app/room/${roomId}/code`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: nextCode }),
      });
    }, 1000);
  }

  async function handleRunCase(caseIndex: number) {
    if (!room) {
      return;
    }

    const sampleCaseList = problem?.sampleCases ?? [];
    const totalCaseCount = Math.max(sampleCaseList.length, runResults?.length ?? 0);
    const runningResults = Array.from({ length: totalCaseCount }, (_, index) =>
      createFallbackCaseResult(
        "RUNNING",
        sampleCaseList[index]?.input ?? "(empty)",
        sampleCaseList[index]?.output ?? "(empty)",
      ),
    );

    setError(null);
    setSelectedRunCaseIndex(caseIndex);
    setRunningCaseIndex(caseIndex);
    setRunResults(runningResults);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.roomId, code, language }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        const failMessage = payload?.message ?? "실행 요청에 실패했습니다.";
        setError(failMessage);
        setRunResults(
          Array.from({ length: totalCaseCount }, (_, index) =>
            createFallbackCaseResult(
              "REQUEST_FAILED",
              sampleCaseList[index]?.input ?? "(empty)",
              sampleCaseList[index]?.output ?? "(empty)",
              failMessage,
            ),
          ),
        );
        setRunningCaseIndex((current) => (current === caseIndex ? null : current));
      }
    } catch {
      const failMessage = "실행 요청 중 네트워크 오류가 발생했습니다.";
      setError(failMessage);
      setRunResults(
        Array.from({ length: totalCaseCount }, (_, index) =>
          createFallbackCaseResult(
            "REQUEST_FAILED",
            sampleCaseList[index]?.input ?? "(empty)",
            sampleCaseList[index]?.output ?? "(empty)",
            failMessage,
          ),
        ),
      );
      setRunningCaseIndex((current) => (current === caseIndex ? null : current));
    }
  }

  async function handleSubmit() {
    if (!room) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setLeftPanelTab("submission");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.roomId,
          code,
          language,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "제출에 실패했습니다.");
        setIsSubmitting(false);
        return;
      }

      const payload = (await response.json()) as SubmissionResponse;
      setLatestSubmission(payload);
      setMessage(`제출 완료: ${payload.result ?? "채점 대기"}`);
      setIsSubmitting(false);
    } catch {
      setError("제출 요청 중 네트워크 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  }

  function startVerticalResize(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const container = splitContainerRef.current;

    if (!container) {
      return;
    }

    const onMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nextRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = clamp(nextRatio, MIN_LEFT_RATIO, MAX_LEFT_RATIO);
      leftPaneRatioRef.current = clamped;
      setLeftPaneRatio(clamped);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const snapped = snapRatio(leftPaneRatioRef.current, LEFT_RATIO_SNAP_POINTS, SPLIT_SNAP_GAP);
      leftPaneRatioRef.current = snapped;
      setLeftPaneRatio(snapped);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startHorizontalResize(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const onMove = (moveEvent: MouseEvent) => {
      const rect = rightColumnRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const nextRatio = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const clamped = clamp(nextRatio, MIN_TOP_RATIO, MAX_TOP_RATIO);
      rightTopPaneRatioRef.current = clamped;
      setRightTopPaneRatio(clamped);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const snapped = snapRatio(rightTopPaneRatioRef.current, TOP_RATIO_SNAP_POINTS, SPLIT_SNAP_GAP);
      rightTopPaneRatioRef.current = snapped;
      setRightTopPaneRatio(snapped);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const isRunShortcut =
        event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.shiftKey;
      const isSubmitShortcut = event.key === "Enter" && event.shiftKey;

      if (!isRunShortcut && !isSubmitShortcut) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
        return;
      }

      if (isSubmitShortcut) {
        if (isSubmitting) {
          return;
        }

        event.preventDefault();
        void handleSubmit();
        return;
      }

      if (!room || room.status !== "PLAYING" || runningCaseIndex !== null) {
        return;
      }

      const sampleCaseCount = problem?.sampleCases?.length ?? 0;
      const runCaseCount = runResults?.length ?? 0;
      const totalCaseCount = Math.max(sampleCaseCount, runCaseCount);
      const runCaseIndex = selectedRunCaseIndex ?? (totalCaseCount > 0 ? 0 : null);

      if (runCaseIndex === null) {
        return;
      }

      event.preventDefault();
      void handleRunCase(runCaseIndex);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    handleRunCase,
    handleSubmit,
    isSubmitting,
    problem,
    room,
    runResults,
    runningCaseIndex,
    selectedRunCaseIndex,
  ]);

  if (!sessionLoaded && !room) {
    return (
      <Panel variant="dark" title="세션 확인" description="인증 상태를 확인하는 중입니다.">
        <p className="text-sm text-app-muted">잠시만 기다려주세요.</p>
      </Panel>
    );
  }

  if (!session.authenticated && !room) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-app-border bg-app-surface px-4 py-3">
          <p className="text-sm font-medium text-app-secondary">
            배틀룸은 로그인 후 이용할 수 있습니다.
          </p>
          <StatusPill tone="warn" variant="dark">로그인 필요</StatusPill>
        </div>
        <Panel variant="dark" title="이동" description="로그인 후 다시 배틀룸으로 돌아올 수 있습니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/battle/rooms/${roomId}`)}`}
              className="rounded-2xl border border-app-accent/40 bg-gradient-to-r from-app-accent to-app-accent-hover px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm font-medium text-app-primary"
            >
              메인으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (!room && !error) {
    return <BattleRoomLoading />;
  }

  if (!room) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-app-danger/35 bg-app-danger/10 px-4 py-3">
          <p className="text-sm font-medium text-app-danger">
            배틀룸 정보를 가져오지 못했습니다.
          </p>
          <StatusPill tone="danger" variant="dark">Load failed</StatusPill>
        </div>
        <Panel variant="dark" title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-app-secondary">
            {error}
          </p>
        </Panel>
      </div>
    );
  }

  const languages = resolveLanguages(problem, language);
  const sampleCases = problem?.sampleCases ?? [];
  const caseCount = Math.max(sampleCases.length, runResults?.length ?? 0);
  const activeSampleCase =
    selectedRunCaseIndex !== null ? sampleCases[selectedRunCaseIndex] ?? null : null;
  const activeRunCase =
    selectedRunCaseIndex !== null && runResults
      ? runResults[selectedRunCaseIndex] ?? null
      : null;
  const activeCaseInput = activeSampleCase?.input ?? activeRunCase?.input ?? "(empty)";
  const activeCaseExpected =
    activeSampleCase?.output ?? activeRunCase?.expectedOutput ?? "(empty)";
  const activeRunCasePass = isPassVerdict(activeRunCase?.status);
  const activeRunCaseWrongAnswer = isWrongAnswerVerdict(activeRunCase?.status);
  const isPlayable = room.status === "PLAYING";

  async function handleExitConfirm() {
    bypassGuardRef.current = true;
    await fetch(`/api/battle/rooms/${roomId}/exit`, { method: "POST" });
    setShowExitDialog(false);
    pendingNavRef.current?.();
  }

  const latestResultCode = normalizeVerdict(latestSubmission?.result ?? undefined);
  const submitHeadline = getSubmitHeadline(isSubmitting, latestSubmission?.result);
  const submitIsAccepted = latestResultCode === "AC" || latestResultCode === "ACCEPTED";
  const submitIsWaiting = isSubmitting || latestResultCode === "JUDGING";
  const submitHasResult = Boolean(isSubmitting || latestSubmission?.result);
  const submitCardClass = submitIsAccepted
    ? "border-app-success/30 bg-app-success/10"
    : submitIsWaiting
      ? "border-app-warn/30 bg-app-warn/10"
      : submitHasResult
        ? "border-app-danger/35 bg-app-danger/10"
        : "border-app-border bg-app-elevated";
  const submitHeadlineClass = submitIsAccepted
    ? "text-app-success"
    : submitIsWaiting
      ? "text-app-warn"
      : submitHasResult
        ? "text-app-danger"
        : "text-app-primary";
  const submitBadgeClass = submitIsAccepted
    ? "bg-app-success/15 text-app-success"
    : submitIsWaiting
      ? "bg-app-warn/15 text-app-warn"
      : "bg-app-danger/15 text-app-danger";
  const submitProgressText =
    latestSubmission &&
    latestSubmission.passedCount !== null &&
    latestSubmission.totalCount !== null
      ? `${latestSubmission.passedCount}/${latestSubmission.totalCount} testcases passed`
      : null;
  const runTargetCaseIndex = selectedRunCaseIndex ?? (caseCount > 0 ? 0 : null);
  const runActionDisabled =
    !isPlayable || runTargetCaseIndex === null || runningCaseIndex !== null;
  const runActionLabel = runningCaseIndex !== null ? "Running..." : "Run";
  const submitActionLabel = isSubmitting ? "Submitting..." : "Submit";
  const isLeftPaneCollapsed = leftPaneRatio <= 8;
  const isTestcaseCollapsed = rightTopPaneRatio >= 96;

  return (
    <div className="h-full space-y-6 lg:space-y-0">
      <ConfirmDialog
        open={showSpectateDialog}
        title="문제를 풀었습니다!"
        description="다른 참여자들의 풀이를 관전하시겠습니까?"
        confirmLabel="관전하기"
        cancelLabel="나가기"
        onConfirm={() => {
          sessionStorage.setItem("spectate-from-hub", "1");
          router.push(`/spectate/rooms/${roomId}`);
        }}
        onCancel={() => router.push("/")}
      />

      <ConfirmDialog
        open={showExitDialog}
        title="배틀을 포기하시겠습니까?"
        description="지금 나가면 최하위 처리되며 다시 참여할 수 없습니다."
        confirmLabel="포기하고 나가기"
        cancelLabel="계속 풀기"
        confirmTone="danger"
        onConfirm={() => void handleExitConfirm()}
        onCancel={() => setShowExitDialog(false)}
      />

      {error && (
        <div
          className="rounded-2xl border border-app-danger/35 bg-app-danger/10 px-4 py-3 text-sm text-app-danger"
        >
          {error}
        </div>
      )}

      <div className="hidden h-full min-h-0 lg:flex lg:flex-col lg:gap-4">
        <div ref={splitContainerRef} className="flex min-h-0 flex-1">
          <div
            className={`h-full ${isLeftPaneCollapsed ? "" : "min-w-0"}`}
            style={isLeftPaneCollapsed ? { width: "44px" } : { width: `${leftPaneRatio}%` }}
          >
            {isLeftPaneCollapsed ? (
              <div
                className="group relative flex h-full flex-col items-center gap-2 rounded-xl border border-app-border bg-app-surface px-1 py-3"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setLeftPaneRatio(32);
                  }
                }}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={startVerticalResize}
                  onDoubleClick={() => setLeftPaneRatio(50)}
                  className="absolute inset-y-0 -right-1 z-10 flex w-4 cursor-col-resize items-center justify-center"
                >
                  <div className="relative flex h-full w-full items-center justify-center">
                    <div className="h-full w-px rounded bg-app-elevated transition group-hover:bg-app-accent/80" />
                    <div className="absolute flex h-16 w-1.5 items-center justify-center rounded-full border border-app-border-strong bg-app-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition group-hover:border-app-accent/60 group-hover:bg-app-accent/15">
                      <div className="h-8 w-0.5 rounded-full bg-app-border-strong transition group-hover:bg-app-accent-soft" />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLeftPanelTab("description");
                    setLeftPaneRatio(32);
                  }}
                  className={`w-full rounded-md border px-1 py-2 text-xs font-semibold transition ${
                    leftPanelTab === "description"
                      ? "border-app-border-strong bg-app-elevated text-app-primary"
                      : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                  }`}
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  Description
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeftPanelTab("submission");
                    setLeftPaneRatio(32);
                  }}
                  className={`w-full rounded-md border px-1 py-2 text-xs font-semibold transition ${
                    leftPanelTab === "submission"
                      ? "border-app-border-strong bg-app-elevated text-app-primary"
                      : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                  }`}
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  Submission
                </button>
              </div>
            ) : (
              <Panel variant="dark" title="문제 상세" className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLeftPanelTab("description")}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        leftPanelTab === "description"
                          ? "border-app-border-strong bg-app-elevated text-app-primary"
                          : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                      }`}
                    >
                      Description
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeftPanelTab("submission")}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        leftPanelTab === "submission"
                          ? "border-app-border-strong bg-app-elevated text-app-primary"
                          : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                      }`}
                    >
                      Submission
                    </button>
                  </div>

                {leftPanelTab === "description" ? (
                  <>
                    <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Battle
                      </p>
                      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-app-primary">
                        {problem ? `${problem.problemId}. ${problem.title}` : `Problem ${room.problemId}`}
                      </h1>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill variant="dark">{problem?.difficulty ?? "UNKNOWN"}</StatusPill>
                        <StatusPill variant="dark">멀티 배틀</StatusPill>
                      </div>
                    </div>

                    <DefinitionGrid
                      compact
                      variant="dark"
                      items={[
                        { label: "timeLimitMs", value: problem?.timeLimitMs ?? "-" },
                        { label: "memoryLimitMb", value: problem?.memoryLimitMb ?? "-" },
                      ]}
                    />

                    {problem ? (
                      <div className="space-y-4 rounded-2xl border border-app-border bg-app-elevated p-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                            Content
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                            {problem.content}
                          </MathText>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                            Input
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                            {problem.inputFormat}
                          </MathText>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                            Output
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                            {problem.outputFormat}
                          </MathText>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                        문제 상세를 불러오는 중입니다.
                      </div>
                    )}
                  </>
                ) : (
                  submitHasResult ? (
                    <div className={`space-y-4 rounded-2xl border p-4 ${submitCardClass}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Submit Result
                      </p>
                      <div className="flex flex-wrap items-start gap-3">
                        <p className={`text-2xl font-semibold ${submitHeadlineClass}`}>
                          {submitHeadline}
                        </p>
                        {submitProgressText ? (
                          <p className="pt-1 text-sm text-app-muted">{submitProgressText}</p>
                        ) : null}
                        <div className="ml-auto flex flex-col items-end gap-1 text-right">
                          {latestResultCode ? (
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}
                            >
                              {latestResultCode}
                            </span>
                          ) : null}
                          <p className="text-xs text-app-muted">language: {language}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-app-border bg-app-base/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                          Current Submission
                        </p>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                          {code}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                      아직 제출 결과가 없습니다.
                    </div>
                  )
                )}
                </div>
              </Panel>
            )}
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startVerticalResize}
            onDoubleClick={() => setLeftPaneRatio(50)}
            className={`group mx-1 items-center justify-center ${
              isLeftPaneCollapsed ? "pointer-events-none hidden opacity-0" : "flex w-3 cursor-col-resize opacity-100"
            }`}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <div className="h-full w-px rounded bg-app-elevated transition group-hover:bg-app-accent/80" />
              <div className="absolute top-1/2 flex h-20 w-2 -translate-y-1/2 items-center justify-center rounded-full border border-app-border-strong bg-app-surface shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition group-hover:border-app-accent/60 group-hover:bg-app-accent/15">
                <div className="h-10 w-0.5 rounded-full bg-app-border-strong transition group-hover:bg-app-accent-soft" />
              </div>
            </div>
          </div>

          <div
            ref={rightColumnRef}
            className={`relative flex h-full min-w-0 flex-col overflow-hidden ${isLeftPaneCollapsed ? "flex-1" : ""}`}
            style={isLeftPaneCollapsed ? undefined : { width: `${100 - leftPaneRatio}%` }}
          >
            <div
              className={`min-h-0 ${isTestcaseCollapsed ? "pb-[3.25rem]" : ""}`}
              style={isTestcaseCollapsed ? { height: "100%" } : { height: `${rightTopPaneRatio}%` }}
            >
              <BattleCodeEditor
                languages={languages}
                language={language}
                onLanguageChange={handleLanguageChange}
                value={code}
                onChange={handleCodeChange}
                onRun={() => {
                  if (runTargetCaseIndex !== null) {
                    void handleRunCase(runTargetCaseIndex);
                  }
                }}
                onSubmit={() => void handleSubmit()}
                runDisabled={runActionDisabled}
                submitDisabled={!isPlayable || isSubmitting}
                runLabel={runActionLabel}
                submitLabel={submitActionLabel}
                height="100%"
                className="h-full"
              />
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              onMouseDown={startHorizontalResize}
              onDoubleClick={() => setRightTopPaneRatio(50)}
              className={`group flex cursor-row-resize items-center justify-center transition-all ${
                isTestcaseCollapsed
                  ? "pointer-events-none my-0 h-0 opacity-0"
                  : "my-1 h-3 opacity-100"
              }`}
            >
              <div className="relative flex h-full w-full items-center justify-center">
                <div className="h-px w-full rounded bg-app-elevated transition group-hover:bg-app-accent/80" />
                <div className="absolute left-1/2 flex h-2.5 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-app-border bg-app-surface/90 transition group-hover:border-app-accent/50 group-hover:bg-app-accent/10">
                  <div className="h-0.5 w-6 rounded-full bg-app-elevated transition group-hover:bg-app-accent-soft" />
                </div>
              </div>
            </div>

            <div
              className={isTestcaseCollapsed ? "absolute inset-x-0 bottom-0 z-10 h-10" : "min-h-0"}
              style={isTestcaseCollapsed ? undefined : { height: `${100 - rightTopPaneRatio}%` }}
            >
              {isTestcaseCollapsed ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  onMouseDown={startHorizontalResize}
                  onDoubleClick={() => setRightTopPaneRatio(50)}
                  onClick={() => {
                    if (isTestcaseCollapsed) {
                      setRightTopPaneRatio(76);
                    }
                  }}
                  className="group relative flex h-full cursor-row-resize items-center rounded-xl border border-app-border bg-app-surface px-4"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-1.5 flex h-2.5 items-center justify-center">
                    <div className="flex h-2.5 w-12 items-center justify-center rounded-full border border-app-border bg-app-surface/90 transition group-hover:border-app-accent/50 group-hover:bg-app-accent/10">
                      <div className="h-0.5 w-6 rounded-full bg-app-elevated transition group-hover:bg-app-accent-soft" />
                    </div>
                  </div>
                  <p className="text-base font-semibold text-app-primary">TestCase</p>
                </div>
              ) : (
                <section className="flex h-full min-h-0 flex-col rounded-2xl border border-app-border bg-app-surface p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-app-primary">TestCase</h2>
                    <p className="shrink-0 text-xs font-medium text-app-dim">
                      {TESTCASE_SHORTCUT_HINT}
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                    {caseCount > 0 ? (
                      <>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                          <div className="flex w-max gap-2 pr-1">
                          {Array.from({ length: caseCount }, (_, index) => {
                            const caseResult = runResults?.[index];
                            const badgeState = getCaseBadgeState(caseResult);
                            const isSelected = selectedRunCaseIndex === index;
                            const idleClass = "border-app-border bg-app-elevated text-app-secondary hover:bg-app-elevated";
                            const passClass = "border-app-success/30 bg-app-success/10 text-app-success hover:bg-app-success/15";
                            const failClass = "border-app-danger/35 bg-app-danger/10 text-app-danger hover:bg-app-danger/15";
                            const pendingClass = "border-app-warn/30 bg-app-warn/10 text-app-warn hover:bg-app-warn/15";

                            const colorClass = isSelected
                              ? "border-app-border-strong bg-app-elevated text-app-primary"
                              : badgeState?.tone === "pass"
                                ? passClass
                                : badgeState?.tone === "fail"
                                  ? failClass
                                  : badgeState?.tone === "pending"
                                    ? pendingClass
                                    : idleClass;

                            return (
                              <button
                                key={`battle-case-${index}`}
                                type="button"
                                onClick={() => setSelectedRunCaseIndex(index)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${colorClass}`}
                              >
                                <span>Case {index + 1}</span>
                                {badgeState ? (
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                                      badgeState.tone === "pass"
                                        ? "bg-app-success/15 text-app-success"
                                        : badgeState.tone === "fail"
                                          ? "bg-app-danger/15 text-app-danger"
                                          : "bg-app-warn/15 text-app-warn"
                                    }`}
                                  >
                                    {badgeState.label}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      </div>

                      {selectedRunCaseIndex !== null ? (
                        <div className="grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                          <div className="space-y-3 rounded-2xl border border-app-border bg-app-elevated p-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                                Input
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                                {activeCaseInput}
                              </MathText>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                                Output
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                                {activeCaseExpected}
                              </MathText>
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-app-border bg-app-elevated p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                              Run Result
                            </p>
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                !activeRunCase
                                  ? "border-app-border bg-app-base text-app-secondary"
                                  : activeRunCasePass
                                    ? "border-app-success/30 bg-app-success/10 text-app-success"
                                    : "border-app-danger/35 bg-app-danger/10 text-app-danger"
                              }`}
                            >
                              {runningCaseIndex === selectedRunCaseIndex ? (
                                <p className="text-app-warn">실행 요청 중입니다...</p>
                              ) : activeRunCase ? (
                                <div className="space-y-2">
                                  <p
                                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                      activeRunCasePass
                                        ? "bg-app-success/15 text-app-success"
                                        : "bg-app-danger/15 text-app-danger"
                                    }`}
                                  >
                                    {activeRunCasePass
                                      ? "PASS"
                                      : activeRunCaseWrongAnswer
                                        ? "WRONG ANSWER"
                                        : normalizeVerdict(activeRunCase.status)}
                                  </p>
                                  {activeRunCase.stderr ? (
                                    <div className="rounded-lg border border-app-danger/35 bg-app-base/80 p-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-danger">
                                        Error
                                      </p>
                                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-danger">
                                        {activeRunCase.stderr}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="grid gap-2">
                                      <div className="rounded-lg border border-app-border bg-app-base/80 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-dim">
                                          Output
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                                          {activeRunCase.actualOutput ?? "(empty)"}
                                        </pre>
                                      </div>
                                      <div className="rounded-lg border border-app-border bg-app-base/80 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-dim">
                                          Expected
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                                          {activeRunCase.expectedOutput ?? "(empty)"}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-app-muted">
                                  아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                        실행 가능한 샘플 케이스가 없습니다.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:hidden">
        <Panel variant="dark" title="문제 상세">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLeftPanelTab("description")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  leftPanelTab === "description"
                    ? "border-app-border-strong bg-app-elevated text-app-primary"
                    : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                }`}
              >
                Description
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelTab("submission")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  leftPanelTab === "submission"
                    ? "border-app-border-strong bg-app-elevated text-app-primary"
                    : "border-app-border bg-app-elevated text-app-muted hover:bg-app-elevated hover:text-app-primary"
                }`}
              >
                Submission
              </button>
            </div>

            {leftPanelTab === "description" ? (
              <>
                <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                    Battle
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-app-primary">
                    {problem ? `${problem.problemId}. ${problem.title}` : `Problem ${room.problemId}`}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill variant="dark">{problem?.difficulty ?? "UNKNOWN"}</StatusPill>
                    <StatusPill variant="dark">멀티 배틀</StatusPill>
                  </div>
                </div>
                <DefinitionGrid
                  compact
                  variant="dark"
                  items={[
                    { label: "timeLimitMs", value: problem?.timeLimitMs ?? "-" },
                    { label: "memoryLimitMb", value: problem?.memoryLimitMb ?? "-" },
                  ]}
                />
                {problem ? (
                  <div className="space-y-4 rounded-2xl border border-app-border bg-app-elevated p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Content
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                        {problem.content}
                      </MathText>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Input
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                        {problem.inputFormat}
                      </MathText>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Output
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                        {problem.outputFormat}
                      </MathText>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                    문제 상세를 불러오는 중입니다.
                  </div>
                )}
              </>
            ) : (
              submitHasResult ? (
                <div className={`space-y-4 rounded-2xl border p-4 ${submitCardClass}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                    Submit Result
                  </p>
                  <div className="flex flex-wrap items-start gap-3">
                    <p className={`text-2xl font-semibold ${submitHeadlineClass}`}>
                      {submitHeadline}
                    </p>
                    {submitProgressText ? (
                      <p className="pt-1 text-sm text-app-muted">{submitProgressText}</p>
                    ) : null}
                    <div className="ml-auto flex flex-col items-end gap-1 text-right">
                      {latestResultCode ? (
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}>
                          {latestResultCode}
                        </span>
                      ) : null}
                      <p className="text-xs text-app-muted">language: {language}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-app-border bg-app-base/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                      Current Submission
                    </p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                      {code}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                  아직 제출 결과가 없습니다.
                </div>
              )
            )}
          </div>
        </Panel>

        <BattleCodeEditor
          languages={languages}
          language={language}
          onLanguageChange={handleLanguageChange}
          value={code}
          onChange={handleCodeChange}
          onRun={() => {
            if (runTargetCaseIndex !== null) {
              void handleRunCase(runTargetCaseIndex);
            }
          }}
          onSubmit={() => void handleSubmit()}
          runDisabled={runActionDisabled}
          submitDisabled={!isPlayable || isSubmitting}
          runLabel={runActionLabel}
          submitLabel={submitActionLabel}
        />

        <section className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-app-primary">TestCase</h2>
            <p className="shrink-0 text-xs font-medium text-app-dim">
              {TESTCASE_SHORTCUT_HINT}
            </p>
          </div>
          <div className="space-y-4">
            {caseCount > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                    <div className="flex w-max gap-2 pr-1">
                    {Array.from({ length: caseCount }, (_, index) => {
                      const caseResult = runResults?.[index];
                      const badgeState = getCaseBadgeState(caseResult);
                      const isSelected = selectedRunCaseIndex === index;
                      const idleClass = "border-app-border bg-app-elevated text-app-secondary hover:bg-app-elevated";
                      const passClass = "border-app-success/30 bg-app-success/10 text-app-success hover:bg-app-success/15";
                      const failClass = "border-app-danger/35 bg-app-danger/10 text-app-danger hover:bg-app-danger/15";
                      const pendingClass = "border-app-warn/30 bg-app-warn/10 text-app-warn hover:bg-app-warn/15";

                      const colorClass = isSelected
                        ? "border-app-border-strong bg-app-elevated text-app-primary"
                        : badgeState?.tone === "pass"
                          ? passClass
                          : badgeState?.tone === "fail"
                            ? failClass
                            : badgeState?.tone === "pending"
                              ? pendingClass
                              : idleClass;

                      return (
                        <button
                          key={`battle-case-mobile-${index}`}
                          type="button"
                          onClick={() => setSelectedRunCaseIndex(index)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${colorClass}`}
                        >
                          <span>Case {index + 1}</span>
                          {badgeState ? (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                                badgeState.tone === "pass"
                                  ? "bg-app-success/15 text-app-success"
                                  : badgeState.tone === "fail"
                                    ? "bg-app-danger/15 text-app-danger"
                                    : "bg-app-warn/15 text-app-warn"
                              }`}
                            >
                              {badgeState.label}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>

                {selectedRunCaseIndex !== null ? (
                  <div className="grid gap-3">
                    <div className="space-y-3 rounded-2xl border border-app-border bg-app-elevated p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                          Input
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                          {activeCaseInput}
                        </MathText>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                          Output
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-app-secondary">
                          {activeCaseExpected}
                        </MathText>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-app-border bg-app-elevated p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-dim">
                        Run Result
                      </p>
                      <div
                        className={`rounded-xl border p-3 text-sm ${
                          !activeRunCase
                            ? "border-app-border bg-app-base text-app-secondary"
                            : activeRunCasePass
                              ? "border-app-success/30 bg-app-success/10 text-app-success"
                              : "border-app-danger/35 bg-app-danger/10 text-app-danger"
                        }`}
                      >
                        {runningCaseIndex === selectedRunCaseIndex ? (
                          <p className="text-app-warn">실행 요청 중입니다...</p>
                        ) : activeRunCase ? (
                          <div className="space-y-2">
                            <p
                              className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                activeRunCasePass
                                  ? "bg-app-success/15 text-app-success"
                                  : "bg-app-danger/15 text-app-danger"
                              }`}
                            >
                              {activeRunCasePass
                                ? "PASS"
                                : activeRunCaseWrongAnswer
                                  ? "WRONG ANSWER"
                                  : normalizeVerdict(activeRunCase.status)}
                            </p>
                            {activeRunCase.stderr ? (
                              <div className="rounded-lg border border-app-danger/35 bg-app-base/80 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-danger">
                                  Error
                                </p>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-danger">
                                  {activeRunCase.stderr}
                                </pre>
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                <div className="rounded-lg border border-app-border bg-app-base/80 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-dim">
                                    Output
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                                    {activeRunCase.actualOutput ?? "(empty)"}
                                  </pre>
                                </div>
                                <div className="rounded-lg border border-app-border bg-app-base/80 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-dim">
                                    Expected
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-app-primary">
                                    {activeRunCase.expectedOutput ?? "(empty)"}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-app-muted">
                            아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-app-border bg-app-elevated px-4 py-3 text-sm text-app-muted">
                실행 가능한 샘플 케이스가 없습니다.
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          {shouldGuard ? (
            <button
              type="button"
              onClick={() => {
                pendingNavRef.current = () => router.push(`/battle/results/${room.roomId}`);
                setShowExitDialog(true);
              }}
              className="rounded-2xl bg-app-base px-4 py-3 text-sm font-medium text-white"
            >
              결과 화면 보기
            </button>
          ) : (
            <Link
              href={`/battle/results/${room.roomId}`}
              className="rounded-2xl bg-app-base px-4 py-3 text-sm font-medium text-white"
            >
              결과 화면 보기
            </Link>
          )}
          {shouldGuard ? (
            <button
              type="button"
              onClick={() => {
                pendingNavRef.current = () => router.push("/");
                setShowExitDialog(true);
              }}
              className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
            >
              메인으로 돌아가기
            </button>
          ) : (
            <Link
              href="/"
              className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-primary"
            >
              메인으로 돌아가기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
