"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemDetailResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import {
  DefinitionGrid,
  MathText,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";

const SoloCodeEditor = dynamic(() => import("@/features/battle-room/code-editor"), {
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

function toEditorLanguage(language: string) {
  if (language === "python3") {
    return "python";
  }

  return language;
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
  const [inputMemo, setInputMemo] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const storageKey = useMemo(
    () => `solo-problem-${problemId}-language-${language}`,
    [language, problemId],
  );

  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);
      setSessionLoaded(true);
    })();
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
      const nextLanguage = resolveDefaultLanguage(nextProblem);
      const nextStarterCode = resolveStarterCode(nextProblem, nextLanguage);
      const nextStorageKey = `solo-problem-${problemId}-language-${nextLanguage}`;
      const savedCode =
        typeof window !== "undefined" ? window.localStorage.getItem(nextStorageKey) : null;

      setProblem(nextProblem);
      setProblemError(null);
      setLanguage(nextLanguage);
      setCode(savedCode ?? nextStarterCode);
      setSaveNotice(null);
      setIsProblemLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [problemId, session.authenticated, sessionLoaded]);

  function handleLanguageChange(nextLanguage: string) {
    setLanguage(nextLanguage);
    setSaveNotice(null);

    if (typeof window === "undefined") {
      setCode(resolveStarterCode(problem, nextLanguage));
      return;
    }

    const nextStorageKey = `solo-problem-${problemId}-language-${nextLanguage}`;
    const savedCode = window.localStorage.getItem(nextStorageKey);
    setCode(savedCode ?? resolveStarterCode(problem, nextLanguage));
  }

  function handleSaveCode() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, code);
    setSaveNotice("현재 코드가 브라우저 로컬 저장소에 저장되었습니다.");
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
        <PageHero
          eyebrow="Solo"
          title="개인 풀이는 로그인 후 이용할 수 있습니다."
          description="문제 상세 API가 보호되어 있어 로그인 후 접근할 수 있습니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
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
        <PageHero
          eyebrow="Solo"
          title="문제 정보를 가져오지 못했습니다."
          description="problemId를 확인하거나 백엔드 API 상태를 점검해주세요."
          actions={<StatusPill tone="danger">Load failed</StatusPill>}
        />
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

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Solo"
        title={`${problem.problemId}. ${problem.title}`}
        description="이 화면은 멀티 룸과 분리된 개인 풀이 전용입니다. 큐, 참가자 상태, 소켓 이벤트 없이 문제/에디터에만 집중합니다."
        actions={
          <>
            <StatusPill>{problem.difficulty}</StatusPill>
            <StatusPill>오프라인 솔로</StatusPill>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Panel title="문제 상세" description="문제 본문과 입출력 형식은 상세 API를 그대로 사용합니다.">
            <div className="space-y-4">
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

          <Panel title="샘플 케이스" description="백엔드 `sampleCases`를 표시합니다.">
            <div className="space-y-3">
              {sampleCases.length > 0 ? (
                sampleCases.map((sampleCase, index) => (
                  <div key={`sample-${index}`} className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Case {index + 1}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">Input</p>
                    <MathText className="block text-sm leading-7 text-zinc-700">
                      {sampleCase.input || "(empty)"}
                    </MathText>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">Output</p>
                    <MathText className="block text-sm leading-7 text-zinc-700">
                      {sampleCase.output || "(empty)"}
                    </MathText>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  현재 샘플 케이스가 등록되지 않았습니다.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="개인 풀이 에디터"
            description="코드는 브라우저 localStorage에 저장됩니다. 이 단계에서는 서버 제출/정산을 연결하지 않습니다."
          >
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">언어</span>
                <select
                  value={language}
                  onChange={(event) => handleLanguageChange(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                >
                  {languages.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <SoloCodeEditor
                language={toEditorLanguage(language)}
                value={code}
                onChange={setCode}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveCode}
                  className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  코드 저장
                </button>
                <Link
                  href="/problems"
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
                >
                  목록으로
                </Link>
              </div>

              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700">
                {saveNotice ?? "Run/Submit은 추후 솔로 전용 실행 API가 붙을 때 연결합니다."}
              </div>
            </div>
          </Panel>

          <Panel title="입력 메모" description="예제 입력이나 테스트 아이디어를 임시로 기록합니다.">
            <textarea
              value={inputMemo}
              onChange={(event) => setInputMemo(event.target.value)}
              rows={8}
              placeholder="예제 입력, 풀이 메모, 반례를 적어두세요."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-zinc-900 outline-none transition focus:border-zinc-500"
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
