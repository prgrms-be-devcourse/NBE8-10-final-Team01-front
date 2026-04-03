"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  BattleRoomStateResponse,
  JoinRoomResponse,
  ProblemDetailResponse,
  RoomResponse,
  RunTestCaseResult,
  RunWsMessage,
  SubmissionResponse,
  SubmissionWsMessage,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
import { DefinitionGrid, MathText, Panel, StatusPill } from "@/shared/ui";

import {
  getBattleRoom,
  getProblemDetail,
  latestSubmission as fallbackSubmission,
  submitTemplate,
} from "./data";

const BattleCodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[26rem] items-center justify-center rounded-2xl border border-zinc-300 bg-zinc-950 text-sm text-zinc-300">
      에디터를 준비하는 중입니다.
    </div>
  ),
});

const MIN_LEFT_RATIO = 22;
const MAX_LEFT_RATIO = 78;
const MIN_TOP_RATIO = 24;
const MAX_TOP_RATIO = 76;
const LEFT_RATIO_SNAP_POINTS = [22, 32, 50, 68, 78];
const TOP_RATIO_SNAP_POINTS = [24, 34, 50, 66, 76];
const SPLIT_SNAP_GAP = 2;
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
  isPending: boolean,
): CaseBadgeState | null {
  if (isPending) {
    return { label: "RUN", tone: "pending" };
  }

  if (!result) {
    return null;
  }

  if (isPassVerdict(result.status)) {
    return { label: "PASS", tone: "pass" };
  }

  if (isWrongAnswerVerdict(result.status)) {
    return { label: "WA", tone: "fail" };
  }

  return { label: normalizeVerdict(result.status) || "FAIL", tone: "fail" };
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
  const { session, sessionLoaded, refreshSession } = useAppSession();
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [latestSubmission, setLatestSubmission] =
    useState<SubmissionResponse | null>(fallbackSubmission);
  const [code, setCode] = useState(submitTemplate.code);
  const [language, setLanguage] = useState(submitTemplate.language);
  const [runResults, setRunResults] = useState<RunTestCaseResult[] | null>(null);
  const [selectedRunCaseIndex, setSelectedRunCaseIndex] = useState<number | null>(null);
  const [runningCaseIndex, setRunningCaseIndex] = useState<number | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("description");
  const [leftPaneRatio, setLeftPaneRatio] = useState(54);
  const [rightTopPaneRatio, setRightTopPaneRatio] = useState(52);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("배틀룸 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedJoinRef = useRef(false);
  const stompClientRef = useRef<Client | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const leftPaneRatioRef = useRef(leftPaneRatio);
  const rightTopPaneRatioRef = useRef(rightTopPaneRatio);

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
          const nextLanguage = resolveDefaultLanguage(fallbackProblem, submitTemplate.language);
          const nextStarterCode = resolveStarterCode(fallbackProblem, nextLanguage);
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
        const nextLanguage = resolveDefaultLanguage(mergedProblem, submitTemplate.language);
        const nextStarterCode = resolveStarterCode(mergedProblem, nextLanguage);
        setProblem(mergedProblem);
        setLanguage(nextLanguage);
        setCode(nextStarterCode);
        setMessage("");
      } else {
        if (!active) {
          return;
        }
        const fallbackProblem = getProblemDetail(nextRoom.problemId);
        const nextLanguage = resolveDefaultLanguage(fallbackProblem, submitTemplate.language);
        const nextStarterCode = resolveStarterCode(fallbackProblem, nextLanguage);
        setProblem(fallbackProblem);
        setLanguage(nextLanguage);
        setCode(nextStarterCode);
        setMessage("문제 상세 조회에 실패해 샘플 설명을 함께 표시합니다.");
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshSession, roomId, session.authenticated, sessionLoaded]);

  useEffect(() => {
    hasAttemptedJoinRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (hasAttemptedJoinRef.current || !room || !session.authenticated || !session.member) {
      return;
    }

    const participant = room.participants.find(
      (item) => item.userId === session.member?.memberId,
    );

    const shouldJoin =
      (room.status === "WAITING" && participant?.status === "READY") ||
      (room.status === "PLAYING" && participant?.status === "ABANDONED");

    if (!shouldJoin) {
      return;
    }

    hasAttemptedJoinRef.current = true;

    void (async () => {
      const response = await fetch(`/api/battle/rooms/${roomId}/join`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "배틀룸 입장에 실패했습니다.");
        hasAttemptedJoinRef.current = false;
        return;
      }

      const payload = (await response.json()) as JoinRoomResponse;
      setMessage(`배틀룸 입장 처리 완료: ${payload.status}`);

      const refreshed = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (refreshed.ok) {
        setRoom((await refreshed.json()) as RoomResponse);
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
    })();
  }, [room, roomId, session.authenticated, session.member?.memberId]);

  useEffect(() => {
    if (!session.authenticated) {
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
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

          if (type === "BATTLE_STARTED" || type === "PARTICIPANT_DONE") {
            void fetch(`/api/battle/rooms/${roomId}`, { cache: "no-store" })
              .then((res) => (res.ok ? res.json() : null))
              .then((data: RoomResponse | null) => {
                if (data) {
                  setRoom(data);
                }
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
            setRunResults(msg.results);
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
    };
  }, [roomId, session.authenticated, session.member?.memberId]);

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    setCode(resolveStarterCode(problem, nextLanguage));
  }

  function handleCodeChange(nextCode: string) {
    setCode(nextCode);

    if (stompClientRef.current?.connected && room?.status === "PLAYING") {
      stompClientRef.current.publish({
        destination: `/app/room/${roomId}/code`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: nextCode }),
      });
    }
  }

  async function handleRunCase(caseIndex: number) {
    if (!room) {
      return;
    }

    setError(null);
    setSelectedRunCaseIndex(caseIndex);
    setRunningCaseIndex(caseIndex);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.roomId, code, language }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "실행 요청에 실패했습니다.");
        setRunningCaseIndex((current) => (current === caseIndex ? null : current));
      }
    } catch {
      setError("실행 요청 중 네트워크 오류가 발생했습니다.");
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
      <Panel title="세션 확인" description="인증 상태를 확인하는 중입니다.">
        <p className="text-sm text-zinc-600">잠시만 기다려주세요.</p>
      </Panel>
    );
  }

  if (!session.authenticated && !room) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-zinc-300 bg-white px-4 py-3">
          <p className="text-sm font-medium text-zinc-700">
            배틀룸은 로그인 후 이용할 수 있습니다.
          </p>
          <StatusPill tone="warn">로그인 필요</StatusPill>
        </div>
        <Panel title="이동" description="로그인 후 다시 배틀룸으로 돌아올 수 있습니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/battle/rooms/${roomId}`)}`}
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
            >
              메인으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3">
          <p className="text-sm font-medium text-rose-900">
            배틀룸 정보를 가져오지 못했습니다.
          </p>
          <StatusPill tone="danger">Load failed</StatusPill>
        </div>
        <Panel title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-zinc-700">
            {error ?? message}
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
  const latestResultCode = normalizeVerdict(latestSubmission?.result ?? undefined);
  const submitHeadline = getSubmitHeadline(isSubmitting, latestSubmission?.result);
  const submitIsAccepted = latestResultCode === "AC" || latestResultCode === "ACCEPTED";
  const submitIsWaiting = isSubmitting || latestResultCode === "JUDGING";
  const submitHasResult = Boolean(isSubmitting || latestSubmission?.result);
  const submitCardClass = submitIsAccepted
    ? "border-emerald-300 bg-emerald-50"
    : submitIsWaiting
      ? "border-amber-300 bg-amber-50"
      : submitHasResult
        ? "border-rose-300 bg-rose-50"
        : "border-zinc-300 bg-zinc-50";
  const submitHeadlineClass = submitIsAccepted
    ? "text-emerald-700"
    : submitIsWaiting
      ? "text-amber-700"
      : submitHasResult
        ? "text-rose-700"
        : "text-zinc-700";
  const submitBadgeClass = submitIsAccepted
    ? "bg-emerald-700/15 text-emerald-700"
    : submitIsWaiting
      ? "bg-amber-700/15 text-amber-700"
      : "bg-rose-700/15 text-rose-700";
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

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {error}
        </div>
      )}

      <div className="hidden h-[calc(100dvh-10.5rem)] min-h-0 lg:flex lg:flex-col lg:gap-4">
        <div ref={splitContainerRef} className="flex min-h-0 flex-1">
          <div className="h-full min-w-0" style={{ width: `${leftPaneRatio}%` }}>
            <Panel title="문제 상세" className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftPanelTab("description")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      leftPanelTab === "description"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftPanelTab("submission")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      leftPanelTab === "submission"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    Submission
                  </button>
                </div>

                {leftPanelTab === "description" ? (
                  <>
                    <div className="rounded-2xl border border-zinc-300 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Battle
                      </p>
                      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                        {problem ? `${problem.problemId}. ${problem.title}` : `Problem ${room.problemId}`}
                      </h1>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill>{problem?.difficulty ?? "UNKNOWN"}</StatusPill>
                        <StatusPill>멀티 배틀</StatusPill>
                      </div>
                    </div>

                    <DefinitionGrid
                      items={[
                        { label: "timeLimitMs", value: problem?.timeLimitMs ?? "-" },
                        { label: "memoryLimitMb", value: problem?.memoryLimitMb ?? "-" },
                      ]}
                    />

                    {problem ? (
                      <div className="space-y-4 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            Content
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                            {problem.content}
                          </MathText>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            Input
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                            {problem.inputFormat}
                          </MathText>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            Output
                          </p>
                          <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                            {problem.outputFormat}
                          </MathText>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        문제 상세를 불러오는 중입니다.
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`space-y-4 rounded-2xl border p-4 ${submitCardClass}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Submit Result
                    </p>
                    <div className="flex flex-wrap items-start gap-3">
                      <p className={`text-2xl font-semibold ${submitHeadlineClass}`}>
                        {submitHeadline}
                      </p>
                      {submitProgressText ? (
                        <p className="pt-1 text-sm text-zinc-600">{submitProgressText}</p>
                      ) : null}
                      <div className="ml-auto flex flex-col items-end gap-1 text-right">
                        {submitHasResult && latestResultCode ? (
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}
                          >
                            {latestResultCode}
                          </span>
                        ) : null}
                        <p className="text-xs text-zinc-600">language: {language}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Current Submission
                      </p>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                        {code}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startVerticalResize}
            onDoubleClick={() => setLeftPaneRatio(50)}
            className="group mx-1 flex w-3 cursor-col-resize items-center justify-center"
          >
            <div className="h-full w-px rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
          </div>

          <div
            ref={rightColumnRef}
            className="flex h-full min-w-0 flex-col"
            style={{ width: `${100 - leftPaneRatio}%` }}
          >
            <div className="min-h-0" style={{ height: `${rightTopPaneRatio}%` }}>
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
              className="group my-1 flex h-3 cursor-row-resize items-center justify-center"
            >
              <div className="h-px w-full rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
            </div>

            <div className="min-h-0" style={{ height: `${100 - rightTopPaneRatio}%` }}>
              <Panel title="TestCase" className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  {caseCount > 0 ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: caseCount }, (_, index) => {
                            const caseResult = runResults?.[index];
                            const badgeState = getCaseBadgeState(
                              caseResult,
                              runningCaseIndex === index,
                            );
                            const isSelected = selectedRunCaseIndex === index;
                            const idleClass = "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
                            const passClass = "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
                            const failClass = "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100";
                            const pendingClass = "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";

                            const colorClass = isSelected
                              ? "border-zinc-900 bg-zinc-900 text-white"
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
                                        ? "bg-emerald-700/15 text-emerald-700"
                                        : badgeState.tone === "fail"
                                          ? "bg-rose-700/15 text-rose-700"
                                          : "bg-amber-700/15 text-amber-700"
                                    }`}
                                  >
                                    {badgeState.label}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs font-medium text-zinc-500">
                          ⌘/Ctrl+Enter: Run · Shift+Enter: Submit
                        </p>
                      </div>

                      {selectedRunCaseIndex !== null ? (
                        <div className="grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                          <div className="space-y-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                Input
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                                {activeCaseInput}
                              </MathText>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                Output
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                                {activeCaseExpected}
                              </MathText>
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-zinc-300 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              Run Result
                            </p>
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                !activeRunCase
                                  ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                                  : activeRunCasePass
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                    : "border-rose-200 bg-rose-50 text-rose-900"
                              }`}
                            >
                              {runningCaseIndex === selectedRunCaseIndex ? (
                                <p className="text-amber-700">실행 요청 중입니다...</p>
                              ) : activeRunCase ? (
                                <div className="space-y-2">
                                  <p
                                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                      activeRunCasePass
                                        ? "bg-emerald-700/15 text-emerald-700"
                                        : "bg-rose-700/15 text-rose-700"
                                    }`}
                                  >
                                    {activeRunCasePass
                                      ? "PASS"
                                      : activeRunCaseWrongAnswer
                                        ? "WRONG ANSWER"
                                        : normalizeVerdict(activeRunCase.status)}
                                  </p>
                                  {activeRunCase.stderr ? (
                                    <div className="rounded-lg border border-rose-200 bg-white/60 p-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                                        Error
                                      </p>
                                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-rose-800">
                                        {activeRunCase.stderr}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="grid gap-2">
                                      <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                          Output
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                          {activeRunCase.actualOutput ?? "(empty)"}
                                        </pre>
                                      </div>
                                      <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                          Expected
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                          {activeRunCase.expectedOutput ?? "(empty)"}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-zinc-600">
                                  아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                      실행 가능한 샘플 케이스가 없습니다.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:hidden">
        <Panel title="문제 상세">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLeftPanelTab("description")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  leftPanelTab === "description"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Description
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelTab("submission")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  leftPanelTab === "submission"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Submission
              </button>
            </div>

            {leftPanelTab === "description" ? (
              <>
                <div className="rounded-2xl border border-zinc-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Battle
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                    {problem ? `${problem.problemId}. ${problem.title}` : `Problem ${room.problemId}`}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill>{problem?.difficulty ?? "UNKNOWN"}</StatusPill>
                    <StatusPill>멀티 배틀</StatusPill>
                  </div>
                </div>
                <DefinitionGrid
                  items={[
                    { label: "timeLimitMs", value: problem?.timeLimitMs ?? "-" },
                    { label: "memoryLimitMb", value: problem?.memoryLimitMb ?? "-" },
                  ]}
                />
                {problem ? (
                  <div className="space-y-4 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Content
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                        {problem.content}
                      </MathText>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Input
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                        {problem.inputFormat}
                      </MathText>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Output
                      </p>
                      <MathText className="mt-2 block text-sm leading-7 text-zinc-700">
                        {problem.outputFormat}
                      </MathText>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    문제 상세를 불러오는 중입니다.
                  </div>
                )}
              </>
            ) : (
              <div className={`space-y-4 rounded-2xl border p-4 ${submitCardClass}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Submit Result
                </p>
                <div className="flex flex-wrap items-start gap-3">
                  <p className={`text-2xl font-semibold ${submitHeadlineClass}`}>
                    {submitHeadline}
                  </p>
                  {submitProgressText ? (
                    <p className="pt-1 text-sm text-zinc-600">{submitProgressText}</p>
                  ) : null}
                  <div className="ml-auto flex flex-col items-end gap-1 text-right">
                    {submitHasResult && latestResultCode ? (
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}>
                        {latestResultCode}
                      </span>
                    ) : null}
                    <p className="text-xs text-zinc-600">language: {language}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Current Submission
                  </p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                    {code}
                  </pre>
                </div>
              </div>
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

        <Panel title="TestCase">
          <div className="space-y-4">
            {caseCount > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: caseCount }, (_, index) => {
                      const caseResult = runResults?.[index];
                      const badgeState = getCaseBadgeState(
                        caseResult,
                        runningCaseIndex === index,
                      );
                      const isSelected = selectedRunCaseIndex === index;
                      const idleClass = "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
                      const passClass = "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
                      const failClass = "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100";
                      const pendingClass = "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";

                      const colorClass = isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white"
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
                                  ? "bg-emerald-700/15 text-emerald-700"
                                  : badgeState.tone === "fail"
                                    ? "bg-rose-700/15 text-rose-700"
                                    : "bg-amber-700/15 text-amber-700"
                              }`}
                            >
                              {badgeState.label}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-medium text-zinc-500">
                    ⌘/Ctrl+Enter: Run · Shift+Enter: Submit
                  </p>
                </div>

                {selectedRunCaseIndex !== null ? (
                  <div className="grid gap-3">
                    <div className="space-y-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Input
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                          {activeCaseInput}
                        </MathText>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Output
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                          {activeCaseExpected}
                        </MathText>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-zinc-300 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Run Result
                      </p>
                      <div
                        className={`rounded-xl border p-3 text-sm ${
                          !activeRunCase
                            ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                            : activeRunCasePass
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-rose-200 bg-rose-50 text-rose-900"
                        }`}
                      >
                        {runningCaseIndex === selectedRunCaseIndex ? (
                          <p className="text-amber-700">실행 요청 중입니다...</p>
                        ) : activeRunCase ? (
                          <div className="space-y-2">
                            <p
                              className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                activeRunCasePass
                                  ? "bg-emerald-700/15 text-emerald-700"
                                  : "bg-rose-700/15 text-rose-700"
                              }`}
                            >
                              {activeRunCasePass
                                ? "PASS"
                                : activeRunCaseWrongAnswer
                                  ? "WRONG ANSWER"
                                  : normalizeVerdict(activeRunCase.status)}
                            </p>
                            {activeRunCase.stderr ? (
                              <div className="rounded-lg border border-rose-200 bg-white/60 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                                  Error
                                </p>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-rose-800">
                                  {activeRunCase.stderr}
                                </pre>
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Output
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                    {activeRunCase.actualOutput ?? "(empty)"}
                                  </pre>
                                </div>
                                <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Expected
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                    {activeRunCase.expectedOutput ?? "(empty)"}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-zinc-600">
                            아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                실행 가능한 샘플 케이스가 없습니다.
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/battle/results/${room.roomId}`}
            className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
          >
            결과 화면 보기
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
