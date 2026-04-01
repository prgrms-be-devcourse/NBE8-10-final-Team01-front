"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemListResponse,
  SessionResponse,
} from "@/shared/api/contracts";

const PROBLEM_PAGE_SIZE = 20;
const MAX_PAGE_BUTTONS = 7;

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

async function readProblemList(page: number) {
  const searchParams = new URLSearchParams({
    page: String(page),
    size: String(PROBLEM_PAGE_SIZE),
  });

  const response = await fetch(`/api/problems?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return {
      data: null,
      error: payload?.message ?? "문제 목록을 불러오지 못했습니다.",
    };
  }

  return {
    data: (await response.json()) as ProblemListResponse,
    error: null,
  };
}

function getPageTokens(currentPage: number, totalPages: number) {
  if (totalPages <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const firstPage = 0;
  const lastPage = totalPages - 1;
  const pages = new Set([firstPage, lastPage, currentPage - 1, currentPage, currentPage + 1]);
  const inRangePages = Array.from(pages)
    .filter((page) => page >= firstPage && page <= lastPage)
    .sort((a, b) => a - b);
  const tokens: Array<number | "ellipsis"> = [];

  for (let index = 0; index < inRangePages.length; index += 1) {
    const page = inRangePages[index];
    const prev = inRangePages[index - 1];

    if (prev !== undefined && page - prev > 1) {
      tokens.push("ellipsis");
    }

    tokens.push(page);
  }

  return tokens;
}

export default function ProblemsScreen() {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [problemPage, setProblemPage] = useState(0);
  const [problemList, setProblemList] = useState<ProblemListResponse | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);
      setSessionLoaded(true);
    })();
  }, []);

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

        setProblemList(null);
        setProblemError(null);
        setIsProblemLoading(false);
        return;
      }

      setIsProblemLoading(true);
      setProblemError(null);

      const result = await readProblemList(problemPage);

      if (!active) {
        return;
      }

      if (result.error) {
        setProblemList(null);
        setProblemError(result.error);
        setIsProblemLoading(false);
        return;
      }

      setProblemList(result.data);
      setProblemError(null);
      setIsProblemLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [problemPage, session.authenticated, sessionLoaded]);

  const problemRows = problemList?.problems ?? [];
  const problemPageInfo = problemList?.pageInfo ?? null;
  const canMovePrevProblemPage = problemPage > 0 && !isProblemLoading;
  const canMoveNextProblemPage = Boolean(problemPageInfo?.hasNext) && !isProblemLoading;
  const totalPages = problemPageInfo?.totalPages ?? 0;
  const pageTokens = getPageTokens(problemPage, totalPages);

  return (
    <main className="flex h-full min-h-0 flex-col border-b border-zinc-700/80 bg-[#1e1f22] lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-zinc-700/80 bg-[#1e1f22] px-3">
        <div className="relative flex h-10 items-center gap-2 border-r border-zinc-700/70 bg-[#1e1f22] px-3 font-mono text-xs text-zinc-200">
          <span className="inline-flex h-4 w-4 items-center justify-center text-[#a78bfa]">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path
                d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.2 8.2h5.6M5.2 10.2h5.6" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </span>
          <span>problem-list.json</span>
          <span className="text-zinc-500">×</span>
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-zinc-300" />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#1e1f22]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-zinc-700/70 pb-3">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">문제 목록</h1>
              <p className="mt-1 text-sm text-zinc-400">문제를 선택해 개인 풀이 화면으로 이동합니다.</p>
            </div>
            {session.authenticated ? (
              <p className="text-xs text-zinc-500">
                {problemPageInfo
                  ? `총 ${problemPageInfo.totalElements.toLocaleString()}개 · ${problemPageInfo.page + 1}/${problemPageInfo.totalPages} 페이지`
                  : isProblemLoading
                    ? "문제 목록을 불러오는 중입니다."
                    : ""}
              </p>
            ) : null}
          </div>

          {!sessionLoaded ? (
            <div className="rounded-md border border-zinc-700 bg-[#2b2d30] px-4 py-4 text-sm text-zinc-300">
              세션 상태를 확인하는 중입니다.
            </div>
          ) : !session.authenticated ? (
            <div className="space-y-4 rounded-md border border-zinc-700 bg-[#2b2d30] px-4 py-4">
              <p className="text-sm text-zinc-300">
                문제 목록 조회는 로그인 후 이용할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login?next=/problems"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#9146ff] px-4 text-sm font-semibold text-white transition hover:bg-[#7f39fa]"
                >
                  로그인
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#1e1f22] px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/30"
                >
                  메인으로
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-zinc-400">
                  {isProblemLoading
                    ? "문제 목록을 불러오는 중입니다."
                    : "문제를 선택한 뒤 열기를 눌러 개인 풀이를 시작하세요."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => Math.max(0, current - 1))}
                    disabled={!canMovePrevProblemPage}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-200 transition hover:bg-zinc-700/40 disabled:cursor-not-allowed disabled:text-zinc-500"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => current + 1)}
                    disabled={!canMoveNextProblemPage}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-200 transition hover:bg-zinc-700/40 disabled:cursor-not-allowed disabled:text-zinc-500"
                  >
                    다음
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="w-full overflow-x-auto sm:w-auto">
                  <div className="inline-flex min-w-max items-center gap-1.5">
                    {pageTokens.map((token, index) =>
                      token === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="inline-flex h-8 w-8 items-center justify-center text-sm text-zinc-500"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={token}
                          type="button"
                          onClick={() => setProblemPage(token)}
                          disabled={isProblemLoading}
                          className={`inline-flex h-8 w-9 items-center justify-center rounded-md border text-sm font-semibold transition ${
                            token === problemPage
                              ? "border-violet-400/60 bg-[#9146ff] text-white shadow-[0_0_0_1px_rgba(167,139,250,0.3)]"
                              : "border-zinc-700 bg-[#2b2d30] text-zinc-200 hover:bg-zinc-700/40"
                          } disabled:cursor-not-allowed disabled:text-zinc-500`}
                        >
                          {token + 1}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                {problemPageInfo ? (
                  <p className="text-xs text-zinc-500">
                    현재 {problemPageInfo.page + 1} / {problemPageInfo.totalPages}
                  </p>
                ) : null}
              </div>

              {problemError ? (
                <div className="rounded-md border border-rose-400/60 bg-rose-900/25 px-3 py-2 text-sm text-rose-200">
                  {problemError}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-md border border-zinc-700">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-[#2b2d30] text-zinc-300">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">ID</th>
                        <th className="px-4 py-3 text-left font-semibold">제목</th>
                        <th className="px-4 py-3 text-left font-semibold">난이도</th>
                        <th className="px-4 py-3 text-left font-semibold">레이팅</th>
                        <th className="px-4 py-3 text-left font-semibold">시간 제한</th>
                        <th className="px-4 py-3 text-left font-semibold">메모리 제한</th>
                        <th className="px-4 py-3 text-left font-semibold">개인 풀이</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1e1f22]">
                      {problemRows.length > 0 ? (
                        problemRows.map((problem) => (
                          <tr key={problem.problemId} className="border-t border-zinc-700">
                            <td className="px-4 py-3 font-medium text-zinc-100">
                              {problem.problemId}
                            </td>
                            <td className="px-4 py-3 text-zinc-200">
                              <Link
                                href={`/problems/${problem.problemId}`}
                                className="font-medium text-zinc-100 underline-offset-4 hover:text-violet-300 hover:underline"
                              >
                                {problem.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{problem.difficulty}</td>
                            <td className="px-4 py-3 text-zinc-300">{problem.difficultyRating}</td>
                            <td className="px-4 py-3 text-zinc-300">{problem.timeLimitMs}ms</td>
                            <td className="px-4 py-3 text-zinc-300">{problem.memoryLimitMb}MB</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/problems/${problem.problemId}`}
                                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700/40"
                              >
                                열기
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-zinc-700">
                          <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                            {isProblemLoading
                              ? "목록을 불러오는 중입니다."
                              : "표시할 문제가 없습니다."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
