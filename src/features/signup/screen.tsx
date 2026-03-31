"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ApiErrorResponse, JoinRequest } from "@/shared/api/contracts";

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
    <form onSubmit={handleSubmit} className="h-full min-h-0">
      <main className="flex h-full min-h-0 flex-col border-b border-zinc-700/80 bg-[#1e1f22] lg:border-b-0 lg:border-r">
        <div className="flex h-12 items-center border-b border-zinc-700/80 bg-[#1e1f22] px-3">
          <div className="relative flex h-10 items-center gap-2 border-r border-zinc-700/70 bg-[#1e1f22] px-3 font-mono text-xs text-zinc-200">
            <span className="inline-flex h-4 w-4 items-center justify-center text-[#a78bfa]">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path
                  d="M5.3 6.1a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M2.7 11.8c.3-1.8 1.4-2.9 2.7-2.9s2.4 1.1 2.7 2.9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <path
                  d="M11.2 5.2v3m-1.5-1.5h3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>join-request.json</span>
            <span className="text-zinc-500">×</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-zinc-300" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#1e1f22]">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-zinc-100">회원가입</h1>
              <p className="mt-1 text-sm text-zinc-400">
                이메일, 비밀번호, 닉네임을 입력해 계정을 생성합니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-200">이메일</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="rookie@example.com"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#4e89ff]/70"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">비밀번호</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="영문, 숫자, 특수문자 포함"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#4e89ff]/70"
                  required
                />
                <p className="text-xs text-zinc-500">
                  8~12자, 영문/숫자/특수문자를 포함해주세요.
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-200">비밀번호 확인</span>
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      passwordConfirm: event.target.value,
                    }))
                  }
                  placeholder="비밀번호를 다시 입력하세요"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#4e89ff]/70"
                  required
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-200">닉네임</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="2~20자 닉네임"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-[#2b2d30] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#4e89ff]/70"
                  required
                />
              </label>
            </div>

            <div
              className={`mt-5 rounded-md border px-3 py-2 text-sm ${
                error
                  ? "border-rose-400/60 bg-rose-900/25 text-rose-200"
                  : "border-zinc-700 bg-[#2b2d30] text-zinc-300"
              }`}
            >
              {error
                ? error
                : passwordMatched
                  ? message
                  : "비밀번호와 비밀번호 확인이 일치해야 회원가입을 진행할 수 있습니다."}
            </div>

            <button
              type="submit"
              disabled={isPending || !passwordMatched}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#9146ff] px-4 text-sm font-semibold text-white transition hover:bg-[#7f39fa] disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
            >
              {isPending ? "가입 중..." : "회원가입"}
            </button>

            <div className="mt-3 text-sm text-zinc-400">
              이미 계정이 있다면{" "}
              <Link
                href="/login"
                className="font-medium text-violet-300 transition hover:text-violet-200"
              >
                로그인
              </Link>
              으로 이동하세요.
            </div>
          </div>
        </div>
      </main>
    </form>
  );
}
