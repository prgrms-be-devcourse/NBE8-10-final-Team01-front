"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemDetailResponse,
  SessionResponse,
} from "@/shared/api/contracts";
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
const MIN_LEFT_RATIO = 32;
const MAX_LEFT_RATIO = 68;
const MIN_TOP_RATIO = 28;
const MAX_TOP_RATIO = 72;

interface SoloCaseRunResult {
  status: "api_missing";
  verdict: string;
  message: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  if (problem?.defaultLanguage && languages.includes(problem.defaultLanguage)) {
    return problem.defaultLanguage;
  }

  return languages[0];
}

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return {
      authenticated: false,
      member: null,
    } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
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
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(true);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(defaultCodeByLanguage.javascript);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number | null>(null);
  const [runningCaseIndex, setRunningCaseIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseRunResults, setCaseRunResults] = useState<Record<number, SoloCaseRunResult>>({});
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [leftPaneRatio, setLeftPaneRatio] = useState(54);
  const [rightTopPaneRatio, setRightTopPaneRatio] = useState(52);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);
      setSessionLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
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

      setProblem(nextProblem);
      setProblemError(null);
      setLanguage(nextLanguage);
      setCode(nextStarterCode);
      setSelectedCaseIndex(hasSampleCase ? 0 : null);
      setRunningCaseIndex(null);
      setIsSubmitting(false);
      setCaseRunResults({});
      setSubmitNotice(null);
      setIsProblemLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [problemId, session.authenticated, sessionLoaded]);

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    setCode(resolveStarterCode(problem, nextLanguage));
  }

  async function handleRunCase(caseIndex: number) {
    setSelectedCaseIndex(caseIndex);
    setRunningCaseIndex(caseIndex);
    setSubmitNotice(null);

    // TODO(backend): 솔로 실행 API가 추가되면 아래 fallback 대신 실제 호출로 교체합니다.
    // 예상 형태: POST /api/problems/{problemId}/run { language, code, input }
    await new Promise((resolve) => setTimeout(resolve, 180));

    setCaseRunResults((prev) => ({
      ...prev,
      [caseIndex]: {
        status: "api_missing",
        verdict: "UNAVAILABLE",
        message: "솔로 Run API 미연동 상태입니다. 백엔드 endpoint 추가 후 실제 결과를 표시합니다.",
      },
    }));

    setRunningCaseIndex((current) => (current === caseIndex ? null : current));
  }

  async function handleSubmit() {
    if (selectedCaseIndex === null) {
      return;
    }

    setIsSubmitting(true);

    // TODO(backend): 솔로 제출 API가 추가되면 아래 fallback 대신 실제 호출로 교체합니다.
    // 예상 형태: POST /api/problems/{problemId}/submit { language, code }
    await new Promise((resolve) => setTimeout(resolve, 220));

    setSubmitNotice(
      "솔로 Submit API 미연동 상태입니다. 현재 제출은 배틀룸(/api/submissions, roomId 기반)에서만 동작합니다.",
    );
    setIsSubmitting(false);
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
      setLeftPaneRatio(clamp(nextRatio, MIN_LEFT_RATIO, MAX_LEFT_RATIO));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
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
      setRightTopPaneRatio(clamp(nextRatio, MIN_TOP_RATIO, MAX_TOP_RATIO));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

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

  return (
    <div className="space-y-6">
      <div className="hidden h-[calc(100dvh-10.5rem)] min-h-0 overflow-hidden xl:block">
        <div ref={splitContainerRef} className="flex h-full min-h-0">
          <div className="h-full min-w-0" style={{ width: `${leftPaneRatio}%` }}>
            <Panel
              title="문제 상세"
              className="flex h-full min-h-0 flex-col"
            >
              <div className="space-y-4 min-h-0 flex-1 overflow-y-auto pr-1">
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
                  items={[
                    { label: "problemId", value: problem.problemId },
                    { label: "difficulty", value: problem.difficulty },
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
              </div>
            </Panel>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startVerticalResize}
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
              <SoloCodeEditor
                languages={languages}
                language={language}
                onLanguageChange={(nextLanguage) => handleLanguageChange(nextLanguage)}
                value={code}
                onChange={setCode}
                height="100%"
                className="h-full"
              />
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              onMouseDown={startHorizontalResize}
              className="group my-1 flex h-3 cursor-row-resize items-center justify-center"
            >
              <div className="h-px w-full rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
            </div>

            <div className="min-h-0" style={{ height: `${100 - rightTopPaneRatio}%` }}>
              <Panel
                title="TestCase"
                className="flex h-full min-h-0 flex-col"
              >
                <div className="space-y-4 min-h-0 flex-1 overflow-y-auto">
                  {sampleCases.length > 0 ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {sampleCases.map((_, index) => (
                            <button
                              key={`case-tab-${index}`}
                              type="button"
                              onClick={() => setSelectedCaseIndex(index)}
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                                selectedCaseIndex === index
                                  ? "bg-zinc-900 text-white"
                                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                              }`}
                            >
                              Case {index + 1}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              selectedCaseIndex !== null
                                ? void handleRunCase(selectedCaseIndex)
                                : null
                            }
                            disabled={selectedCaseIndex === null || runningCaseIndex !== null}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                          >
                            {runningCaseIndex !== null ? "실행 중..." : "▶ Run"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={selectedCaseIndex === null || isSubmitting}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                          >
                            {isSubmitting ? "제출 중..." : "Submit"}
                          </button>
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
                              Result
                            </p>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                              {runningCaseIndex === selectedCaseIndex ? (
                                <p className="text-zinc-600">실행 요청 중입니다...</p>
                              ) : activeCaseResult ? (
                                <div className="space-y-2">
                                  <p className="font-semibold text-zinc-900">{activeCaseResult.verdict}</p>
                                  <p className="text-zinc-700">{activeCaseResult.message}</p>
                                </div>
                              ) : (
                                <p className="text-zinc-600">
                                  아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                                </p>
                              )}
                            </div>
                            {submitNotice ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                {submitNotice}
                              </div>
                            ) : null}
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

      <div className="space-y-6 xl:hidden">
        <Panel title="문제 상세">
          <div className="space-y-4">
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
              items={[
                { label: "problemId", value: problem.problemId },
                { label: "difficulty", value: problem.difficulty },
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
          </div>
        </Panel>

        <SoloCodeEditor
          languages={languages}
          language={language}
          onLanguageChange={(nextLanguage) => handleLanguageChange(nextLanguage)}
          value={code}
          onChange={setCode}
        />

        <Panel title="TestCase">
          <div className="space-y-4">
            {sampleCases.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {sampleCases.map((_, index) => (
                      <button
                        key={`case-tab-mobile-${index}`}
                        type="button"
                        onClick={() => setSelectedCaseIndex(index)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                          selectedCaseIndex === index
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Case {index + 1}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        selectedCaseIndex !== null ? void handleRunCase(selectedCaseIndex) : null
                      }
                      disabled={selectedCaseIndex === null || runningCaseIndex !== null}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                    >
                      {runningCaseIndex !== null ? "실행 중..." : "▶ Run"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={selectedCaseIndex === null || isSubmitting}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isSubmitting ? "제출 중..." : "Submit"}
                    </button>
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
                        Result
                      </p>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                        {runningCaseIndex === selectedCaseIndex ? (
                          <p className="text-zinc-600">실행 요청 중입니다...</p>
                        ) : activeCaseResult ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-zinc-900">{activeCaseResult.verdict}</p>
                            <p className="text-zinc-700">{activeCaseResult.message}</p>
                          </div>
                        ) : (
                          <p className="text-zinc-600">
                            아직 실행 결과가 없습니다. Run 버튼으로 해당 케이스를 실행하세요.
                          </p>
                        )}
                      </div>
                      {submitNotice ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                          {submitNotice}
                        </div>
                      ) : null}
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
  );
}
