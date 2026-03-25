"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ApiErrorResponse, JoinRequest } from "@/shared/api/contracts";
import { MetricCard, MetricGrid, PageHero, Panel, StatusPill } from "@/shared/ui";

const initialForm: JoinRequest = {
  email: "",
  password: "",
  passwordConfirm: "",
  name: "",
};

export default function SignupScreen() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("회원가입 후 로그인 페이지로 이동합니다.");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordMatched =
    form.password.length > 0 &&
    form.passwordConfirm.length > 0 &&
    form.password === form.passwordConfirm;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setError(payload?.message ?? "회원가입에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as { message: string };
        setMessage(payload.message);
        router.push("/login");
      })();
    });
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Signup"
        title="백엔드 JoinRequest 그대로 받는 회원가입 화면"
        description="이메일, 비밀번호, 비밀번호 확인, 닉네임 네 필드만 실제 계약에 맞춰 보냅니다. 중복 확인과 소셜 가입은 아직 계약이 없어 UI에 넣지 않습니다."
        actions={
          <>
            <StatusPill tone="success">POST /api/auth/signup</StatusPill>
            <StatusPill>Validation by backend</StatusPill>
          </>
        }
      />

      <MetricGrid>
        <MetricCard label="필수 필드" value="4" hint="email, password, passwordConfirm, name" />
        <MetricCard
          label="비밀번호 규칙"
          value="8-12"
          hint="영문, 숫자, 특수문자 포함"
        />
        <MetricCard label="자동 이동" value="/login" hint="가입 성공 후 로그인 화면으로 이동" />
        <MetricCard
          label="현재 범위"
          value="기본 가입"
          hint="중복 확인, 비밀번호 찾기 제외"
        />
      </MetricGrid>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="회원가입 폼" description="실제 백엔드 DTO 이름에 맞춰 입력합니다.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                placeholder="rookie@example.com"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">비밀번호</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                placeholder="영문, 숫자, 특수문자 포함"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">비밀번호 확인</span>
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    passwordConfirm: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">닉네임</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                placeholder="2~20자 닉네임"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isPending || !passwordMatched}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
            >
              {isPending ? "가입 처리 중..." : "회원가입 완료"}
            </button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="실시간 체크" description="프론트에서 최소한으로 보여주는 확인 상태">
            <div className="space-y-3 text-sm text-zinc-700">
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                비밀번호 확인 일치 여부: {passwordMatched ? "일치" : "미일치"}
              </div>
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-600">
                이메일 중복 확인: 백엔드 계약 준비 전
              </div>
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-600">
                닉네임 중복 확인: 백엔드 계약 준비 전
              </div>
            </div>
          </Panel>

          <Panel title="이동 경로" description="가입 후 사용자가 바로 이어서 할 행동">
            <div className="flex flex-col gap-3 text-sm">
              <Link
                href="/login"
                className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 font-medium text-zinc-900 transition hover:border-zinc-500"
              >
                로그인 페이지로 돌아가기
              </Link>
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  error
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {error ?? message}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
