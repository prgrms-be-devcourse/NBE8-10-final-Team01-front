"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  ApiErrorResponse,
  AuthMutationResponse,
  LoginRequest,
} from "@/shared/api/contracts";
import { PageHero, Panel, StatusPill } from "@/shared/ui";

const initialForm: LoginRequest = {
  email: "",
  password: "",
};

export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("로그인 후 메인에서 바로 매칭을 시작할 수 있습니다.");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setError(payload?.message ?? "로그인에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as AuthMutationResponse;
        setMessage(payload.message);
        router.push(nextPath);
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Login"
        title="로그인 후 바로 메인에서 큐를 잡는 구조"
        description="백엔드 로그인은 HttpOnly 쿠키를 발급합니다. 프론트는 자체 BFF를 통해 세션을 중계하고, 성공 후 메인 또는 원래 가려던 보호 화면으로 되돌립니다."
        actions={
          <>
            <StatusPill tone="success">POST /api/auth/login</StatusPill>
            <StatusPill>JWT cookie proxy</StatusPill>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="로그인"
          description="현재 백엔드 계약은 email, password 두 필드만 받습니다."
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-700">이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-500"
                placeholder="duel@example.com"
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
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-500"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
            >
              {isPending ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="다음 단계" description="로그인 이후 실제 이동 흐름">
            <ul className="space-y-3 text-sm leading-7 text-zinc-700">
              <li>메인 `/`에서 카테고리와 난이도를 고르고 매칭을 시작합니다.</li>
              <li>현재 큐 API는 userId 쿼리를 요구하므로 프론트가 JWT subject를 읽어 중계합니다.</li>
              <li>매칭 응답 메시지에 `roomId`가 포함되면 해당 배틀룸으로 자동 이동합니다.</li>
            </ul>
          </Panel>

          <Panel title="보조 링크" description="아직 없는 기능은 명시적으로 분리합니다.">
            <div className="flex flex-col gap-3 text-sm">
              <Link
                href="/signup"
                className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 font-medium text-zinc-900 transition hover:border-zinc-500"
              >
                회원가입 하기
              </Link>
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-600">
                비밀번호 찾기: 백엔드 계약 준비 전
              </div>
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-600">
                소셜 로그인: 추후 확장 예정
              </div>
            </div>
          </Panel>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {error ?? message}
          </div>
        </div>
      </div>
    </div>
  );
}
