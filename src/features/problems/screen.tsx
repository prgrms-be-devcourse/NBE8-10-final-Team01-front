"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemListResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import { ApiCallout, MetricCard, MetricGrid, PageHero, Panel, StatusPill } from "@/shared/ui";

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
    <div className="space-y-8">
      <PageHero
        eyebrow="Problems"
        title="문제 전체 조회 페이지"
        description="문제 목록은 메인이 아니라 독립 화면에서 조회합니다. 네비게이션에서 바로 들어와 페이지 단위로 문제를 확인할 수 있습니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인 상태" : "로그인 필요"}
            </StatusPill>
            <StatusPill>{`size ${PROBLEM_PAGE_SIZE}`}</StatusPill>
          </>
        }
      />

      {!sessionLoaded ? (
        <Panel title="세션 확인" description="인증 상태를 확인하는 중입니다.">
          <p className="text-sm text-zinc-600">잠시만 기다려주세요.</p>
        </Panel>
      ) : !session.authenticated ? (
        <Panel title="로그인이 필요합니다" description="문제 전체 조회는 보호된 API로 동작합니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/problems"
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
      ) : (
        <>
          <MetricGrid>
            <MetricCard
              label="총 문제 수"
              value={
                problemPageInfo ? problemPageInfo.totalElements.toLocaleString() : "-"
              }
            />
            <MetricCard
              label="현재 페이지"
              value={problemPageInfo ? `${problemPageInfo.page + 1}` : "-"}
            />
            <MetricCard
              label="전체 페이지"
              value={problemPageInfo ? `${problemPageInfo.totalPages}` : "-"}
            />
            <MetricCard label="페이지 크기" value={`${PROBLEM_PAGE_SIZE}`} />
          </MetricGrid>

          <Panel
            title="문제 목록"
            description="`GET /api/problems?page&size`를 통해 백엔드 문제 목록을 조회합니다."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-600">
                  {isProblemLoading
                    ? "문제 목록을 불러오는 중입니다."
                    : problemPageInfo
                      ? `${problemPageInfo.totalElements.toLocaleString()}개 문제 / ${problemPageInfo.page + 1}페이지`
                      : "문제 목록을 불러오지 못했습니다."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => Math.max(0, current - 1))}
                    disabled={!canMovePrevProblemPage}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => current + 1)}
                    disabled={!canMoveNextProblemPage}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    다음
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {pageTokens.map((token, index) =>
                  token === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-zinc-500">
                      ...
                    </span>
                  ) : (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setProblemPage(token)}
                      disabled={isProblemLoading}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        token === problemPage
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500"
                      } disabled:cursor-not-allowed disabled:text-zinc-400`}
                    >
                      {token + 1}
                    </button>
                  ),
                )}
              </div>

              {problemError ? (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {problemError}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-zinc-300">
                <table className="min-w-full border-collapse bg-white text-sm">
                  <thead className="bg-zinc-100 text-zinc-700">
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
                  <tbody>
                    {problemRows.length > 0 ? (
                      problemRows.map((problem) => (
                        <tr key={problem.problemId} className="border-t border-zinc-200">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {problem.problemId}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <Link
                              href={`/problems/${problem.problemId}`}
                              className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                            >
                              {problem.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{problem.difficulty}</td>
                          <td className="px-4 py-3 text-zinc-700">{problem.difficultyRating}</td>
                          <td className="px-4 py-3 text-zinc-700">{problem.timeLimitMs}ms</td>
                          <td className="px-4 py-3 text-zinc-700">{problem.memoryLimitMb}MB</td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/problems/${problem.problemId}`}
                              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:border-zinc-500"
                            >
                              열기
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-zinc-200">
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
          </Panel>

          <Panel title="연결 포인트" description="문제 목록 화면에서 사용하는 API 경로">
            <div className="grid gap-4 lg:grid-cols-2">
              <ApiCallout
                method="GET"
                path="/api/problems?page={page}&size={size}"
                note="프론트 BFF에서 문제 목록을 페이지네이션으로 조회합니다."
              />
              <ApiCallout
                method="GET"
                path="/api/v1/problems?page={page}&size={size}"
                note="백엔드 실제 문제 목록 엔드포인트입니다."
              />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
