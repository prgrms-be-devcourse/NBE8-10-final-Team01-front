"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { SessionResponse } from "@/shared/api/contracts";
import { MetricCard, MetricGrid, PageHero, Panel, SimpleTable, StatusPill } from "@/shared/ui";

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

export default function MyPageScreen() {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });

  useEffect(() => {
    void (async () => {
      setSession(await readSession());
    })();
  }, []);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="My Page"
        title="프로필과 전적 화면의 최소 운영 골격"
        description="현재 백엔드에는 `/me`, 전적, 점수 그래프 계약이 아직 없습니다. 그래서 세션 쿠키에서 복원 가능한 식별 정보만 먼저 보여주고, 나머지는 실제 엔드포인트가 정리되면 연결할 자리로 남겨둡니다."
        actions={
          <>
            <StatusPill tone={session.authenticated ? "success" : "warn"}>
              {session.authenticated ? "로그인됨" : "로그인 필요"}
            </StatusPill>
            <StatusPill>Profile placeholder</StatusPill>
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          label="닉네임"
          value={session.member?.nickname ?? "게스트"}
          hint="현재는 JWT payload 기준"
        />
        <MetricCard
          label="이메일"
          value={session.member?.email ?? "-"}
          hint="실제 members 조회 API 연동 전"
        />
        <MetricCard label="티어" value="연결 전" hint="백엔드 프로필 API 필요" />
        <MetricCard label="총점" value="연결 전" hint="전적/점수 API 필요" />
      </MetricGrid>

      {session.authenticated ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="프로필 영역" description="현재 세션에서 바로 읽을 수 있는 정보">
            <dl className="space-y-3 text-sm leading-7 text-zinc-700">
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                닉네임: {session.member?.nickname}
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                이메일: {session.member?.email}
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                역할: {session.member?.role}
              </div>
            </dl>
          </Panel>

          <Panel title="전적 리스트 자리" description="실제 전적 API 연결 전 레이아웃만 확보">
            <SimpleTable
              headers={["날짜", "문제", "결과", "순위", "점수 변동"]}
              rows={[
                ["-", "전적 API 준비 전", "-", "-", "-"],
                ["-", "결과 집계 API 준비 전", "-", "-", "-"],
              ]}
            />
          </Panel>
        </div>
      ) : (
        <Panel title="로그인이 필요합니다" description="전적과 프로필은 보호 화면입니다.">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/mypage"
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/signup"
              className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900"
            >
              회원가입
            </Link>
          </div>
        </Panel>
      )}
    </div>
  );
}
