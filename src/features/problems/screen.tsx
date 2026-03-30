"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemListResponse,
  SessionResponse,
} from "@/shared/api/contracts";
import { MetricCard, MetricGrid, PageHero, Panel, StatusPill } from "@/shared/ui";

const PAGE_SIZE = 20;

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

async function readProblems(page: number) {
  const searchParams = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
  });

  const response = await fetch(`/api/problems?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return {
      data: null,
      error: payload?.message ?? "문제 목록 조회에 실패했습니다.",
    };
  }

  return {
    data: (await response.json()) as ProblemListResponse,
    error: null,
  };
}

export default function ProblemsScreen() {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [problems, setProblems] = useState<ProblemListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

      setIsLoading(true);
      setError(null);

      const result = await readProblems(page);

      if (!active) {
        return;
      }

      if (result.error) {
        setProblems(null);
        setError(result.error);
        setIsLoading(false);
        return;
      }

      setProblems(result.data);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [page, session.authenticated, sessionLoaded]);

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
          eyebrow="Problems"
          title="로그인 후 문제 목록을 조회할 수 있습니다."
          description="솔로 풀이 진입 전, 문제 목록은 보호된 API로 조회됩니다."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />
        <Panel title="이동" description="로그인 후 문제 목록으로 돌아옵니다.">
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
      </div>
    );
  }

  const pageInfo = problems?.pageInfo;
  const rows = problems?.problems ?? [];
  const canPrev = page > 0 && !isLoading;
  const canNext = Boolean(pageInfo?.hasNext) && !isLoading;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Problems"
        title="솔로 문제 목록"
        description="문제를 선택해 개인 풀이 화면으로 이동합니다. Run/Submit 연동은 제외하고 화면/데이터 연결만 적용합니다."
        actions={
          <>
            <StatusPill>size {PAGE_SIZE}</StatusPill>
            <StatusPill tone="success">API</StatusPill>
          </>
        }
      />

      <MetricGrid>
        <MetricCard label="Total" value={pageInfo ? pageInfo.totalElements : "-"} />
        <MetricCard label="Page" value={pageInfo ? pageInfo.page + 1 : "-"} />
        <MetricCard label="Total Pages" value={pageInfo ? pageInfo.totalPages : "-"} />
        <MetricCard label="Rows" value={rows.length} />
      </MetricGrid>

      <Panel title="문제 목록" description="`GET /api/problems?page&size` 결과를 표시합니다.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {isLoading
                ? "목록을 불러오는 중입니다."
                : pageInfo
                  ? `${pageInfo.totalElements}개 문제`
                  : "문제 목록을 불러오지 못했습니다."}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={!canPrev}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!canNext}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                다음
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
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
                  <th className="px-4 py-3 text-left font-semibold">진입</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((problem) => (
                    <tr key={problem.problemId} className="border-t border-zinc-200">
                      <td className="px-4 py-3 font-medium text-zinc-900">{problem.problemId}</td>
                      <td className="px-4 py-3 text-zinc-700">{problem.title}</td>
                      <td className="px-4 py-3 text-zinc-700">{problem.difficulty}</td>
                      <td className="px-4 py-3 text-zinc-700">{problem.difficultyRating ?? "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{problem.timeLimitMs}ms</td>
                      <td className="px-4 py-3 text-zinc-700">{problem.memoryLimitMb}MB</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/problems/${problem.problemId}`}
                          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:border-zinc-500"
                        >
                          솔로 풀이
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-zinc-200">
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                      {isLoading ? "불러오는 중입니다." : "표시할 문제가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}
