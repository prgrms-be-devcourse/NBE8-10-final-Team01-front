"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  ProblemDetailResponse,
  SoloRunRequest,
  SoloRunResponse,
  SoloSubmitRequest,
  SoloRunTestCaseResult,
  SoloRunWsMessage,
  SubmissionResponse,
  SubmissionWsMessage,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";
import {
  readPreferredEditorLanguage,
  writePreferredEditorLanguage,
} from "@/shared/utils/editor-language";
import {
  DefinitionGrid,
  MathText,
  Panel,
  StatusPill,
} from "@/shared/ui";

const SoloCodeEditor = dynamic(() => import("@/features/problem-solo/code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[26rem] items-center justify-center rounded-2xl border border-zinc-300 bg-zinc-950 text-sm text-zinc-300">
      에디터를 준비하는 중입니다.
    </div>
  ),
});

const defaultCodeByLanguage: Record<string, string> = {
  javascript: `function solve(input) {\n  // TODO: implement\n}\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    // TODO: implement\n  }\n}\n`,
  python3: `def solve():\n    # TODO: implement\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
  python: `def solve():\n    # TODO: implement\n    pass\n\nif __name__ == "__main__":\n    solve()\n`,
};

const fallbackLanguages = ["python3", "java", "javascript"];
const MIN_LEFT_RATIO = 0;
const MAX_LEFT_RATIO = 78;
const MIN_TOP_RATIO = 24;
const MAX_TOP_RATIO = 100;
const LEFT_RATIO_SNAP_POINTS = [0, 22, 32, 50, 68, 78];
const TOP_RATIO_SNAP_POINTS = [24, 34, 50, 66, 76, 92, 100];
const SPLIT_SNAP_GAP = 4;
const DEFAULT_LEFT_PANE_RATIO = 50;
const DEFAULT_RIGHT_TOP_PANE_RATIO = 100;
const SOLO_LAYOUT_STORAGE_KEY = "bracket:solo-editor-layout:v1";
const TESTCASE_SHORTCUT_HINT = "⌘/Ctrl+Enter: Run · Shift+Enter: Submit";

interface SoloCaseRunResult {
  status: "pending" | "done" | "error";
  verdict: string;
  message: string;
  output?: string;
  expected?: string;
  stderr?: string;
}

interface CaseBadgeState {
  label: string;
  tone: "pending" | "pass" | "fail";
}

type LeftPanelTab = "description" | "submission";

interface SoloSubmitState {
  status: "idle" | "submitting" | "judging" | "done" | "error";
  result: string | null;
  passedCount: number | null;
  totalCount: number | null;
  message: string | null;
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
    const raw = window.localStorage.getItem(SOLO_LAYOUT_STORAGE_KEY);
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

function isRunResultEvent(payload: unknown): payload is SoloRunWsMessage {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return record.type === "RUN_RESULT" && Array.isArray(record.results);
}

function isSoloSubmissionEvent(payload: unknown): payload is SubmissionWsMessage {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return (
    record.type === "SUBMISSION" &&
    typeof record.userId === "number" &&
    typeof record.result === "string"
  );
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

function createInitialSubmitState(): SoloSubmitState {
  return {
    status: "idle",
    result: null,
    passedCount: null,
    totalCount: null,
    message: null,
  };
}

function getSubmitHeadline(state: SoloSubmitState) {
  const code = normalizeVerdict(state.result ?? undefined);

  if (state.status === "submitting") {
    return "Submitting";
  }

  if (state.status === "judging" || code === "JUDGING") {
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

  if (state.status === "error") {
    return "Submit Failed";
  }

  return code || "Submission";
}

function getCaseBadgeState(result: SoloCaseRunResult | undefined): CaseBadgeState | null {
  if (!result) {
    return null;
  }

  if (result.status === "pending") {
    return { label: "RUNNING", tone: "pending" };
  }

  if (isPassVerdict(result.verdict)) {
    return { label: "PASS", tone: "pass" };
  }

  if (isWrongAnswerVerdict(result.verdict)) {
    return { label: "WA", tone: "fail" };
  }

  return { label: normalizeVerdict(result.verdict) || "FAIL", tone: "fail" };
}

function createPendingCaseResults(
  caseCount: number,
  message: string,
): Record<number, SoloCaseRunResult> {
  const nextResults: Record<number, SoloCaseRunResult> = {};

  Array.from({ length: caseCount }, (_, index) => index).forEach((index) => {
    nextResults[index] = {
      status: "pending",
      verdict: "RUNNING",
      message,
    };
  });

  return nextResults;
}

function resolveLanguages(problem: ProblemDetailResponse | null) {
  if (!problem?.supportedLanguages || problem.supportedLanguages.length === 0) {
    return fallbackLanguages;
  }

  return problem.supportedLanguages;
}

function resolveStarterCode(problem: ProblemDetailResponse | null, language: string) {
  const fromApi = problem?.starterCodes?.find((item) => item.language === language)?.code;

  if (fromApi) {
    return fromApi;
  }

  return defaultCodeByLanguage[language] ?? defaultCodeByLanguage.javascript;
}

function resolveDefaultLanguage(problem: ProblemDetailResponse | null) {
  const languages = resolveLanguages(problem);
  const preferredLanguage = readPreferredEditorLanguage();

  if (preferredLanguage && languages.includes(preferredLanguage)) {
    return preferredLanguage;
  }

  if (problem?.defaultLanguage && languages.includes(problem.defaultLanguage)) {
    return problem.defaultLanguage;
  }

  return languages[0];
}

async function readProblem(problemId: string) {
  const response = await fetch(`/api/problems/${problemId}`, { cache: "no-store" });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return {
      data: null,
      error: payload?.message ?? "문제 상세를 불러오지 못했습니다.",
    };
  }

  return {
    data: (await response.json()) as ProblemDetailResponse,
    error: null,
  };
}

export default function ProblemSoloScreen({ problemId }: { problemId: string }) {
  const { session, sessionLoaded } = useAppSession();
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(true);
  const [language, setLanguage] = useState(
    () => readPreferredEditorLanguage() ?? "javascript",
  );
  const [code, setCode] = useState(() => {
    const preferredLanguage = readPreferredEditorLanguage() ?? "javascript";
    return defaultCodeByLanguage[preferredLanguage] ?? defaultCodeByLanguage.javascript;
  });
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number | null>(null);
  const [runningCaseIndex, setRunningCaseIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseRunResults, setCaseRunResults] = useState<Record<number, SoloCaseRunResult>>({});
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("description");
  const [submitState, setSubmitState] = useState<SoloSubmitState>(createInitialSubmitState);
  const [leftPaneRatio, setLeftPaneRatio] = useState(() => {
    const stored = readStoredLayout();
    return stored?.leftPaneRatio ?? DEFAULT_LEFT_PANE_RATIO;
  });
  const [rightTopPaneRatio, setRightTopPaneRatio] = useState(() => {
    const stored = readStoredLayout();
    return stored?.rightTopPaneRatio ?? DEFAULT_RIGHT_TOP_PANE_RATIO;
  });
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const runTimeoutRef = useRef<number | null>(null);
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
    if (!sessionLoaded || !session.authenticated) {
      return;
    }

    let active = true;

    void (async () => {
      await Promise.resolve();

      if (!active) {
        return;
      }

      setIsProblemLoading(true);
      const result = await readProblem(problemId);

      if (!active) {
        return;
      }

      if (result.error) {
        setProblem(null);
        setProblemError(result.error);
        setIsProblemLoading(false);
        return;
      }

      const nextProblem = result.data;
      if (!nextProblem) {
        setProblem(null);
        setProblemError("문제 상세 응답이 비어 있습니다.");
        setIsProblemLoading(false);
        return;
      }
      const nextLanguage = resolveDefaultLanguage(nextProblem);
      const nextStarterCode = resolveStarterCode(nextProblem, nextLanguage);
      const hasSampleCase = (nextProblem.sampleCases?.length ?? 0) > 0;

      if (runTimeoutRef.current !== null) {
        window.clearTimeout(runTimeoutRef.current);
        runTimeoutRef.current = null;
      }

      setProblem(nextProblem);
      setProblemError(null);
      setLanguage(nextLanguage);
      setCode(nextStarterCode);
      setSelectedCaseIndex(hasSampleCase ? 0 : null);
      setRunningCaseIndex(null);
      setIsSubmitting(false);
      setCaseRunResults({});
      setLeftPanelTab("description");
      setSubmitState(createInitialSubmitState());
      setIsProblemLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [problemId, session.authenticated, sessionLoaded]);

  useEffect(() => {
    return () => {
      if (runTimeoutRef.current !== null) {
        window.clearTimeout(runTimeoutRef.current);
        runTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    leftPaneRatioRef.current = leftPaneRatio;
  }, [leftPaneRatio]);

  useEffect(() => {
    rightTopPaneRatioRef.current = rightTopPaneRatio;
  }, [rightTopPaneRatio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SOLO_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftPaneRatio,
        rightTopPaneRatio,
      }),
    );
  }, [leftPaneRatio, rightTopPaneRatio]);

  useEffect(() => {
    const memberId = session.member?.memberId;

    if (!session.authenticated || !memberId) {
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      reconnectDelay: 3000,
      // 연결(및 재연결) 시마다 1회용 토큰을 새로 발급해 STOMP CONNECT 헤더에 주입.
      // 토큰은 30초 TTL이고 1회 사용 후 폐기되므로 재연결 시에도 반드시 새 토큰이 필요.
      // 토큰 발급 실패 시 쿠키 기반 인증(로컬 환경)으로 자동 폴백됨.
      beforeConnect: async () => {
        // 재연결 시 이전 연결에서 소비된 토큰이 재사용되지 않도록 먼저 초기화
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
        client.subscribe(`/topic/solo/${memberId}`, (message) => {
          let payload: unknown;

          try {
            payload = JSON.parse(message.body) as unknown;
          } catch {
            return;
          }

          if (!isSoloSubmissionEvent(payload)) {
            return;
          }

          if (payload.userId !== memberId) {
            return;
          }

          setLeftPanelTab("submission");
          setSubmitState({
            status: "done",
            result: payload.result,
            passedCount: payload.passedCount,
            totalCount: payload.totalCount,
            message: null,
          });
        });

        client.subscribe(`/topic/solo/${memberId}/run`, (message) => {
          let payload: unknown;

          try {
            payload = JSON.parse(message.body) as unknown;
          } catch {
            return;
          }

          if (!isRunResultEvent(payload)) {
            return;
          }

          const sampleCases = problem?.sampleCases ?? [];

          setCaseRunResults(() => {
            const nextResults: Record<number, SoloCaseRunResult> = {};

            sampleCases.forEach((_, index) => {
              const runResult = payload.results[index];

              if (!runResult) {
                nextResults[index] = {
                  status: "error",
                  verdict: "NO_RESULT",
                  message: "해당 케이스 실행 결과를 받지 못했습니다.",
                };
                return;
              }

              nextResults[index] = {
                status: isPassVerdict(runResult.status) ? "done" : "error",
                verdict: runResult.status,
                message: runResult.stderr ? "실행 중 오류가 발생했습니다." : "",
                output: runResult.actualOutput?.trim() || "(empty)",
                expected: runResult.expectedOutput?.trim() || "(empty)",
                stderr: runResult.stderr || undefined,
              };
            });

            return nextResults;
          });

          if (runTimeoutRef.current !== null) {
            window.clearTimeout(runTimeoutRef.current);
            runTimeoutRef.current = null;
          }

          setRunningCaseIndex(null);
        });
      },
    });

    client.activate();

    return () => {
      void client.deactivate();
    };
  }, [problem, session.authenticated, session.member?.memberId]);

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    setCode(resolveStarterCode(problem, nextLanguage));
    writePreferredEditorLanguage(nextLanguage);
  }

  async function handleRunCase(caseIndex: number) {
    if (!problem) {
      return;
    }

    const caseCount = problem.sampleCases?.length ?? 0;
    const runningMessage = "실행 요청을 전송했습니다. 결과를 기다리는 중입니다.";

    setSelectedCaseIndex(caseIndex);
    setRunningCaseIndex(caseIndex);
    setCaseRunResults(createPendingCaseResults(caseCount, runningMessage));

    if (runTimeoutRef.current !== null) {
      window.clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }

    try {
      const requestBody: SoloRunRequest = {
        code,
        language,
      };

      const response = await fetch(`/api/problems/${problem.problemId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        const failMessage = errorPayload?.message ?? "실행 요청에 실패했습니다.";
        setCaseRunResults(() => {
          const nextResults: Record<number, SoloCaseRunResult> = {};

          Array.from({ length: caseCount }, (_, index) => index).forEach((index) => {
            nextResults[index] = {
              status: "error",
              verdict: "REQUEST_FAILED",
              message: failMessage,
            };
          });

          return nextResults;
        });
        setRunningCaseIndex((current) => (current === caseIndex ? null : current));
        return;
      }

      const runPayload = (await response.json().catch(() => null)) as SoloRunResponse | null;
      const acceptedMessage = runPayload?.message ?? "실행이 접수되었습니다. WebSocket 결과를 기다립니다.";
      setCaseRunResults(createPendingCaseResults(caseCount, acceptedMessage));

      runTimeoutRef.current = window.setTimeout(() => {
        setCaseRunResults((prev) => {
          let hasPendingCase = false;
          const nextResults = { ...prev };

          Array.from({ length: caseCount }, (_, index) => index).forEach((index) => {
            const current = prev[index];

            if (!current || current.status !== "pending") {
              return;
            }

            hasPendingCase = true;
            nextResults[index] = {
              status: "error",
              verdict: "TIMEOUT",
              message: "결과 수신이 지연되고 있습니다. 다시 Run 해주세요.",
            };
          });

          if (!hasPendingCase) {
            return prev;
          }

          return nextResults;
        });
        setRunningCaseIndex((current) => (current === caseIndex ? null : current));
        runTimeoutRef.current = null;
      }, 15000);
    } catch {
      setCaseRunResults(() => {
        const nextResults: Record<number, SoloCaseRunResult> = {};

        Array.from({ length: caseCount }, (_, index) => index).forEach((index) => {
          nextResults[index] = {
            status: "error",
            verdict: "REQUEST_FAILED",
            message: "실행 요청 중 네트워크 오류가 발생했습니다.",
          };
        });

        return nextResults;
      });
      setRunningCaseIndex((current) => (current === caseIndex ? null : current));
    }
  }

  async function handleSubmit() {
    if (!problem) {
      return;
    }

    setIsSubmitting(true);
    setLeftPanelTab("submission");
    setSubmitState({
      status: "submitting",
      result: null,
      passedCount: null,
      totalCount: null,
      message: "제출 요청 중입니다.",
    });

    try {
      const requestBody: SoloSubmitRequest = {
        code,
        language,
      };

      const response = await fetch(`/api/problems/${problem.problemId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        setSubmitState({
          status: "error",
          result: null,
          passedCount: null,
          totalCount: null,
          message: errorPayload?.message ?? "제출 요청에 실패했습니다.",
        });
        setIsSubmitting(false);
        return;
      }

      const payload = (await response.json().catch(() => null)) as SubmissionResponse | null;
      const result = payload?.result ?? "JUDGING";
      const normalizedResult = normalizeVerdict(result);

      setSubmitState({
        status: normalizedResult === "JUDGING" ? "judging" : "done",
        result,
        passedCount: payload?.passedCount ?? 0,
        totalCount: payload?.totalCount ?? 0,
        message:
          normalizedResult === "JUDGING"
            ? "채점 중입니다. 잠시 후 결과가 갱신됩니다."
            : null,
      });
      setIsSubmitting(false);
    } catch {
      setSubmitState({
        status: "error",
        result: null,
        passedCount: null,
        totalCount: null,
        message: "제출 요청 중 네트워크 오류가 발생했습니다.",
      });
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

      if (runningCaseIndex !== null) {
        return;
      }

      const sampleCaseCount = problem?.sampleCases?.length ?? 0;
      const runCaseIndex = selectedCaseIndex ?? (sampleCaseCount > 0 ? 0 : null);

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
  }, [handleRunCase, handleSubmit, isSubmitting, problem, runningCaseIndex, selectedCaseIndex]);

  if (!sessionLoaded) {
    return (
      <Panel title="세션 확인" description="인증 상태를 확인하는 중입니다.">
        <p className="text-sm text-zinc-600">잠시만 기다려주세요.</p>
      </Panel>
    );
  }

  if (!session.authenticated) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-zinc-300 bg-white px-4 py-3">
          <p className="text-sm font-medium text-zinc-700">
            개인 풀이는 로그인 후 이용할 수 있습니다.
          </p>
          <StatusPill tone="warn">로그인 필요</StatusPill>
        </div>
        <Panel title="이동" description="로그인 후 다시 개인 풀이로 돌아올 수 있습니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/problems/${problemId}`)}`}
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/problems"
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
            >
              문제 목록으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (!problem) {
    if (isProblemLoading) {
      return (
        <Panel title="문제 로딩" description="문제 상세를 불러오는 중입니다.">
          <p className="text-sm text-zinc-600">잠시만 기다려주세요.</p>
        </Panel>
      );
    }

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3">
          <p className="text-sm font-medium text-rose-900">
            문제 정보를 가져오지 못했습니다.
          </p>
          <StatusPill tone="danger">Load failed</StatusPill>
        </div>
        <Panel title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-zinc-700">
            {problemError ?? "문제 상세 응답이 없습니다."}
          </p>
        </Panel>
      </div>
    );
  }

  const languages = resolveLanguages(problem);
  const sampleCases = problem.sampleCases ?? [];
  const activeCase = selectedCaseIndex !== null ? sampleCases[selectedCaseIndex] : null;
  const activeCaseResult = selectedCaseIndex !== null ? caseRunResults[selectedCaseIndex] : null;
  const activeCasePass = isPassVerdict(activeCaseResult?.verdict);
  const activeCaseWrongAnswer = isWrongAnswerVerdict(activeCaseResult?.verdict);
  const submitHeadline = getSubmitHeadline(submitState);
  const submitCode = normalizeVerdict(submitState.result ?? undefined);
  const submitIsAccepted = submitCode === "AC" || submitCode === "ACCEPTED";
  const submitIsWaiting =
    submitState.status === "submitting" ||
    submitState.status === "judging" ||
    submitCode === "JUDGING";
  const submitHasResult = submitState.status !== "idle";
  const submitCardClass = submitIsAccepted
    ? "border-emerald-300 bg-emerald-50"
    : submitIsWaiting
      ? "border-amber-300 bg-amber-50"
      : submitState.status === "idle"
        ? "border-zinc-300 bg-zinc-50"
        : "border-rose-300 bg-rose-50";
  const submitHeadlineClass = submitIsAccepted
    ? "text-emerald-700"
    : submitIsWaiting
      ? "text-amber-700"
      : submitState.status === "idle"
        ? "text-zinc-700"
        : "text-rose-700";
  const submitBadgeClass = submitIsAccepted
    ? "bg-emerald-700/15 text-emerald-700"
    : submitIsWaiting
      ? "bg-amber-700/15 text-amber-700"
      : "bg-rose-700/15 text-rose-700";
  const submitProgressText =
    submitState.passedCount !== null && submitState.totalCount !== null
      ? `${submitState.passedCount}/${submitState.totalCount} testcases passed`
      : null;
  const runTargetCaseIndex = selectedCaseIndex ?? (sampleCases.length > 0 ? 0 : null);
  const runActionDisabled = runTargetCaseIndex === null || runningCaseIndex !== null;
  const runActionLabel = runningCaseIndex !== null ? "Running..." : "Run";
  const submitActionLabel = isSubmitting ? "Submitting..." : "Submit";
  const isLeftPaneCollapsed = leftPaneRatio <= 8;
  const isTestcaseCollapsed = rightTopPaneRatio >= 96;

  return (
    <div className="h-full space-y-6 lg:space-y-0">
      <div className="hidden h-full min-h-0 overflow-hidden lg:block">
        <div ref={splitContainerRef} className="flex h-full min-h-0">
          <div
            className={`h-full ${isLeftPaneCollapsed ? "" : "min-w-0"}`}
            style={isLeftPaneCollapsed ? { width: "44px" } : { width: `${leftPaneRatio}%` }}
          >
            {isLeftPaneCollapsed ? (
              <div
                className="group relative flex h-full flex-col items-center gap-2 rounded-xl border border-zinc-300 bg-white px-1 py-3"
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
                  className="absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize items-center justify-center"
                >
                  <div className="h-14 w-0.5 rounded-full bg-zinc-400 transition group-hover:bg-zinc-600" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLeftPanelTab("description");
                    setLeftPaneRatio(32);
                  }}
                  className={`w-full rounded-md border px-1 py-2 text-xs font-semibold transition ${
                    leftPanelTab === "description"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
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
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  Submission
                </button>
              </div>
            ) : (
              <Panel
                title="문제 상세"
                className="flex h-full min-h-0 flex-col"
              >
                <div className="space-y-4 min-h-0 flex-1 overflow-y-auto pr-1">
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
                        Solo
                      </p>
                      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                        {problem.problemId}. {problem.title}
                      </h1>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill>{problem.difficulty}</StatusPill>
                        <StatusPill>오프라인 솔로</StatusPill>
                      </div>
                    </div>
                    <DefinitionGrid
                      compact
                      items={[
                        { label: "timeLimitMs", value: problem.timeLimitMs },
                        { label: "memoryLimitMb", value: problem.memoryLimitMb },
                      ]}
                    />
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
                  </>
                ) : (
                  submitHasResult ? (
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
                          {submitCode ? (
                            <span className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}>
                              {submitCode}
                            </span>
                          ) : null}
                          <p className="text-xs text-zinc-600">language: {language}</p>
                        </div>
                      </div>

                      {submitState.message ? (
                        <div className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-700">
                          {submitState.message}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Current Submission
                        </p>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                          {code}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
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
            className="group mx-1 flex w-3 cursor-col-resize items-center justify-center"
          >
            <div className="h-full w-px rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
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
              <SoloCodeEditor
                languages={languages}
                language={language}
                onLanguageChange={(nextLanguage) => handleLanguageChange(nextLanguage)}
                value={code}
                onChange={setCode}
                onRun={() => {
                  if (runTargetCaseIndex !== null) {
                    void handleRunCase(runTargetCaseIndex);
                  }
                }}
                onSubmit={() => void handleSubmit()}
                runDisabled={runActionDisabled}
                submitDisabled={isSubmitting}
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
              <div className="h-px w-full rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
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
                  className="group relative flex h-full cursor-row-resize items-center rounded-xl border border-zinc-300 bg-white px-4"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex h-2 items-start justify-center">
                    <div className="mt-1 h-0.5 w-14 rounded-full bg-zinc-400 transition group-hover:bg-zinc-600" />
                  </div>
                  <p className="text-base font-semibold text-zinc-900">TestCase</p>
                </div>
              ) : (
                <section className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-zinc-950">TestCase</h2>
                    <p className="shrink-0 text-xs font-medium text-zinc-500">
                      {TESTCASE_SHORTCUT_HINT}
                    </p>
                  </div>
                  <div className="space-y-4 min-h-0 flex-1 overflow-y-auto">
                    {sampleCases.length > 0 ? (
                      <>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                          <div className="flex w-max gap-2 pr-1">
                          {sampleCases.map((_, index) => {
                            const caseResult = caseRunResults[index];
                            const badgeState = getCaseBadgeState(caseResult);
                            const isSelected = selectedCaseIndex === index;
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
                                key={`case-tab-${index}`}
                                type="button"
                                onClick={() => setSelectedCaseIndex(index)}
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
                        </div>
                      </div>

                      {activeCase ? (
                        <div className="grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                          <div className="space-y-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                Input
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                                {activeCase.input || "(empty)"}
                              </MathText>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                Output
                              </p>
                              <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                                {activeCase.output || "(empty)"}
                              </MathText>
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-zinc-300 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              Run Result
                            </p>
                            <div
                              className={`rounded-xl border p-3 text-sm ${
                                !activeCaseResult
                                  ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                                  : activeCasePass
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                    : "border-rose-200 bg-rose-50 text-rose-900"
                              }`}
                            >
                              {runningCaseIndex === selectedCaseIndex ? (
                                <p className="text-amber-700">실행 요청 중입니다...</p>
                              ) : activeCaseResult ? (
                                <div className="space-y-2">
                                  <p
                                    className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                      activeCasePass
                                        ? "bg-emerald-700/15 text-emerald-700"
                                        : "bg-rose-700/15 text-rose-700"
                                    }`}
                                  >
                                    {activeCasePass
                                      ? "PASS"
                                      : activeCaseWrongAnswer
                                        ? "WRONG ANSWER"
                                        : normalizeVerdict(activeCaseResult.verdict)}
                                  </p>
                                  {activeCaseResult.stderr ? (
                                    <div className="rounded-lg border border-rose-200 bg-white/60 p-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                                        Error
                                      </p>
                                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-rose-800">
                                        {activeCaseResult.stderr}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="grid gap-2">
                                      <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                          Output
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                          {activeCaseResult.output ?? "(empty)"}
                                        </pre>
                                      </div>
                                      <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                          Expected
                                        </p>
                                        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                          {activeCaseResult.expected ?? "(empty)"}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                  {activeCaseResult.message ? (
                                    <p className={activeCasePass ? "text-emerald-800" : "text-rose-800"}>
                                      {activeCaseResult.message}
                                    </p>
                                  ) : null}
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
                </section>
              )}
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
                    Solo
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                    {problem.problemId}. {problem.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill>{problem.difficulty}</StatusPill>
                    <StatusPill>오프라인 솔로</StatusPill>
                  </div>
                </div>
                <DefinitionGrid
                  compact
                  items={[
                    { label: "timeLimitMs", value: problem.timeLimitMs },
                    { label: "memoryLimitMb", value: problem.memoryLimitMb },
                  ]}
                />
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
              </>
            ) : (
              submitHasResult ? (
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
                      {submitCode ? (
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${submitBadgeClass}`}>
                          {submitCode}
                        </span>
                      ) : null}
                      <p className="text-xs text-zinc-600">language: {language}</p>
                    </div>
                  </div>

                  {submitState.message ? (
                    <div className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm text-zinc-700">
                      {submitState.message}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-zinc-200 bg-white/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Current Submission
                    </p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                      {code}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  아직 제출 결과가 없습니다.
                </div>
              )
            )}
          </div>
        </Panel>

        <SoloCodeEditor
          languages={languages}
          language={language}
          onLanguageChange={(nextLanguage) => handleLanguageChange(nextLanguage)}
          value={code}
          onChange={setCode}
          onRun={() => {
            if (runTargetCaseIndex !== null) {
              void handleRunCase(runTargetCaseIndex);
            }
          }}
          onSubmit={() => void handleSubmit()}
          runDisabled={runActionDisabled}
          submitDisabled={isSubmitting}
          runLabel={runActionLabel}
          submitLabel={submitActionLabel}
        />

        <section className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950">TestCase</h2>
            <p className="shrink-0 text-xs font-medium text-zinc-500">
              {TESTCASE_SHORTCUT_HINT}
            </p>
          </div>
          <div className="space-y-4">
            {sampleCases.length > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                    <div className="flex w-max gap-2 pr-1">
                    {sampleCases.map((_, index) => {
                      const caseResult = caseRunResults[index];
                      const badgeState = getCaseBadgeState(caseResult);
                      const isSelected = selectedCaseIndex === index;
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
                          key={`case-tab-mobile-${index}`}
                          type="button"
                          onClick={() => setSelectedCaseIndex(index)}
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
                  </div>
                </div>
                {activeCase ? (
                  <div className="grid gap-3">
                    <div className="space-y-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Input
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                          {activeCase.input || "(empty)"}
                        </MathText>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Output
                        </p>
                        <MathText className="mt-2 block text-sm leading-7 text-zinc-800">
                          {activeCase.output || "(empty)"}
                        </MathText>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-zinc-300 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Run Result
                      </p>
                      <div
                        className={`rounded-xl border p-3 text-sm ${
                          !activeCaseResult
                            ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                            : activeCasePass
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-rose-200 bg-rose-50 text-rose-900"
                        }`}
                      >
                        {runningCaseIndex === selectedCaseIndex ? (
                          <p className="text-amber-700">실행 요청 중입니다...</p>
                        ) : activeCaseResult ? (
                          <div className="space-y-2">
                            <p
                              className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${
                                activeCasePass
                                  ? "bg-emerald-700/15 text-emerald-700"
                                  : "bg-rose-700/15 text-rose-700"
                              }`}
                            >
                              {activeCasePass
                                ? "PASS"
                                : activeCaseWrongAnswer
                                  ? "WRONG ANSWER"
                                  : normalizeVerdict(activeCaseResult.verdict)}
                            </p>
                            {activeCaseResult.stderr ? (
                              <div className="rounded-lg border border-rose-200 bg-white/60 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                                  Error
                                </p>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-rose-800">
                                  {activeCaseResult.stderr}
                                </pre>
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Output
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                    {activeCaseResult.output ?? "(empty)"}
                                  </pre>
                                </div>
                                <div className="rounded-lg border border-zinc-200 bg-white/60 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Expected
                                  </p>
                                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800">
                                    {activeCaseResult.expected ?? "(empty)"}
                                  </pre>
                                </div>
                              </div>
                            )}
                            {activeCaseResult.message ? (
                              <p className={activeCasePass ? "text-emerald-800" : "text-rose-800"}>
                                {activeCaseResult.message}
                              </p>
                            ) : null}
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
        </section>
      </div>
    </div>
  );
}
