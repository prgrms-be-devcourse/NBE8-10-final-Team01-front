"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ApiErrorResponse,
  ProblemListResponse,
  RsData,
  TodayReviewItem,
  TodayReviewResponse,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";

const PROBLEM_PAGE_SIZE = 20;
const MAX_PAGE_BUTTONS = 7;

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

async function readTodayReviews() {
  const response = await fetch("/api/v1/review/today", { cache: "no-store" });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return {
      data: null,
      error: payload?.message ?? "복습 목록을 불러오지 못했습니다.",
    };
  }

  const body = (await response.json()) as RsData<TodayReviewResponse>;
  return { data: body.data, error: null };
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

function ReviewTable({ reviews }: { reviews: TodayReviewItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-app-border">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-app-elevated text-app-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">제목</th>
              <th className="px-4 py-3 text-left font-semibold">난이도</th>
              <th className="px-4 py-3 text-left font-semibold">레이팅</th>
              <th className="px-4 py-3 text-left font-semibold">시간 제한</th>
              <th className="px-4 py-3 text-left font-semibold">메모리 제한</th>
              <th className="px-4 py-3 text-left font-semibold">풀이 횟수</th>
              <th className="px-4 py-3 text-left font-semibold">개인 풀이</th>
            </tr>
          </thead>
          <tbody className="bg-app-base">
            {reviews.length > 0 ? (
              reviews.map((item) => (
                <tr key={item.problemId} className="border-t border-app-border">
                  <td className="px-4 py-3 font-medium text-app-primary">{item.problemId}</td>
                  <td className="px-4 py-3 text-app-primary">
                    <Link
                      href={`/problems/${item.problemId}`}
                      className="font-medium text-app-primary underline-offset-4 hover:text-app-accent-soft hover:underline"
                    >
                      {item.problemTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-app-secondary">{item.difficulty}</td>
                  <td className="px-4 py-3 text-app-secondary">{item.difficultyRating ?? "-"}</td>
                  <td className="px-4 py-3 text-app-secondary">{item.timeLimitMs}ms</td>
                  <td className="px-4 py-3 text-app-secondary">{item.memoryLimitMb}MB</td>
                  <td className="px-4 py-3 text-app-secondary">{item.reviewCount}회</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${item.problemId}`}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-xs font-medium text-app-primary transition hover:bg-app-elevated/90"
                    >
                      열기
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-app-border">
                <td colSpan={8} className="px-4 py-6 text-center text-app-dim">
                  오늘 복습할 문제가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProblemsScreen() {
  const { session, sessionLoaded } = useAppSession();
  const [view, setView] = useState<"all" | "review">("all");

  // 전체 문제 목록
  const [problemPage, setProblemPage] = useState(0);
  const [problemList, setProblemList] = useState<ProblemListResponse | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(false);

  // 복습 목록
  const [reviewList, setReviewList] = useState<TodayReviewResponse | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);

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

  useEffect(() => {
    if (!sessionLoaded || !session.authenticated || view !== "review") {
      return;
    }

    let active = true;

    void (async () => {
      setIsReviewLoading(true);
      setReviewError(null);

      const result = await readTodayReviews();

      if (!active) {
        return;
      }

      if (result.error) {
        setReviewList(null);
        setReviewError(result.error);
        setIsReviewLoading(false);
        return;
      }

      setReviewList(result.data);
      setReviewError(null);
      setIsReviewLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [view, session.authenticated, sessionLoaded]);

  const problemRows = problemList?.problems ?? [];
  const problemPageInfo = problemList?.pageInfo ?? null;
  const canMovePrevProblemPage = problemPage > 0 && !isProblemLoading;
  const canMoveNextProblemPage = Boolean(problemPageInfo?.hasNext) && !isProblemLoading;
  const totalPages = problemPageInfo?.totalPages ?? 0;
  const pageTokens = getPageTokens(problemPage, totalPages);

  return (
    <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
        <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
          <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
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
          <span className="text-app-dim">×</span>
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-app-base">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-app-border/70 pb-3">
            <div>
              <h1 className="text-xl font-semibold text-app-primary">
                {view === "all" ? "문제 목록" : "오늘 복습할 문제"}
              </h1>
              <p className="mt-1 text-sm text-app-muted">
                {view === "all"
                  ? "문제를 선택해 개인 풀이 화면으로 이동합니다."
                  : "오늘 복습 기한이 된 문제 목록입니다."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {session.authenticated && view === "all" && problemPageInfo ? (
                <p className="text-xs text-app-dim">
                  {`총 ${problemPageInfo.totalElements.toLocaleString()}개 · ${problemPageInfo.page + 1}/${problemPageInfo.totalPages} 페이지`}
                </p>
              ) : session.authenticated && view === "review" && reviewList ? (
                <p className="text-xs text-app-dim">
                  {`총 ${reviewList.totalCount}개`}
                </p>
              ) : null}
              {session.authenticated ? (
                view === "all" ? (
                  <button
                    type="button"
                    onClick={() => setView("review")}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                  >
                    오늘 복습할 문제
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setView("all")}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                  >
                    전체 문제보기
                  </button>
                )
              ) : null}
            </div>
          </div>

          {!sessionLoaded ? (
            <div className="rounded-md border border-app-border bg-app-elevated px-4 py-4 text-sm text-app-secondary">
              세션 상태를 확인하는 중입니다.
            </div>
          ) : !session.authenticated ? (
            <div className="space-y-4 rounded-md border border-app-border bg-app-elevated px-4 py-4">
              <p className="text-sm text-app-secondary">
                문제 목록 조회는 로그인 후 이용할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login?next=/problems"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white transition hover:bg-app-accent-hover"
                >
                  로그인
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-app-border bg-app-base px-4 text-sm font-medium text-app-primary transition hover:bg-app-elevated/90"
                >
                  메인으로
                </Link>
              </div>
            </div>
          ) : view === "review" ? (
            <div className="space-y-5">
              <p className="text-xs text-app-dim">* 레이팅 : 숫자로 표기된 상세 난이도</p>
              {reviewError ? (
                <div className="rounded-md border border-app-danger/60 bg-app-danger/20 px-3 py-2 text-sm text-app-danger">
                  {reviewError}
                </div>
              ) : isReviewLoading ? (
                <div className="rounded-md border border-app-border bg-app-elevated px-4 py-4 text-sm text-app-secondary">
                  복습 목록을 불러오는 중입니다.
                </div>
              ) : (
                <ReviewTable reviews={reviewList?.reviews ?? []} />
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-app-muted">
                  {isProblemLoading
                    ? "문제 목록을 불러오는 중입니다."
                    : "문제를 선택한 뒤 열기를 눌러 개인 풀이를 시작하세요."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => Math.max(0, current - 1))}
                    disabled={!canMovePrevProblemPage}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-sm text-app-primary transition hover:bg-app-elevated/90 disabled:cursor-not-allowed disabled:text-app-dim"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemPage((current) => current + 1)}
                    disabled={!canMoveNextProblemPage}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-sm text-app-primary transition hover:bg-app-elevated/90 disabled:cursor-not-allowed disabled:text-app-dim"
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
                          className="inline-flex h-8 w-8 items-center justify-center text-sm text-app-dim"
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
                              ? "border-app-accent/60 bg-app-accent text-white shadow-[0_0_0_1px_var(--app-accent-glow)]"
                              : "border-app-border bg-app-elevated text-app-primary hover:bg-app-elevated/90"
                          } disabled:cursor-not-allowed disabled:text-app-dim`}
                        >
                          {token + 1}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                {problemPageInfo ? (
                  <p className="text-xs text-app-dim">
                    현재 {problemPageInfo.page + 1} / {problemPageInfo.totalPages}
                  </p>
                ) : null}
              </div>

              {problemError ? (
                <div className="rounded-md border border-app-danger/60 bg-app-danger/20 px-3 py-2 text-sm text-app-danger">
                  {problemError}
                </div>
              ) : null}

              <p className="text-xs text-app-dim">* 레이팅 : 숫자로 표기된 상세 난이도</p>

              <div className="overflow-hidden rounded-md border border-app-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-app-elevated text-app-secondary">
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
                    <tbody className="bg-app-base">
                      {problemRows.length > 0 ? (
                        problemRows.map((problem) => (
                          <tr key={problem.problemId} className="border-t border-app-border">
                            <td className="px-4 py-3 font-medium text-app-primary">
                              {problem.problemId}
                            </td>
                            <td className="px-4 py-3 text-app-primary">
                              <Link
                                href={`/problems/${problem.problemId}`}
                                className="font-medium text-app-primary underline-offset-4 hover:text-app-accent-soft hover:underline"
                              >
                                {problem.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-app-secondary">{problem.difficulty}</td>
                            <td className="px-4 py-3 text-app-secondary">{problem.difficultyRating}</td>
                            <td className="px-4 py-3 text-app-secondary">{problem.timeLimitMs}ms</td>
                            <td className="px-4 py-3 text-app-secondary">{problem.memoryLimitMb}MB</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/problems/${problem.problemId}`}
                                className="inline-flex h-8 items-center justify-center rounded-md border border-app-border bg-app-elevated px-3 text-xs font-medium text-app-primary transition hover:bg-app-elevated/90"
                              >
                                열기
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-app-border">
                          <td colSpan={7} className="px-4 py-6 text-center text-app-dim">
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
