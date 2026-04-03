"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  ApiErrorResponse,
  AuthMutationResponse,
  LoginRequest,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";

const initialForm: LoginRequest = {
  email: "",
  password: "",
};

export default function LoginScreen() {
  const router = useRouter();
  const { applySession } = useAppSession();
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
        applySession({
          authenticated: payload.authenticated,
          member: payload.member,
        });
        router.push(nextPath);
        router.refresh();
      })();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="h-full min-h-0">
      <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
        <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-3">
          <div className="relative flex h-10 items-center gap-2 border-r border-app-border/70 bg-app-base px-3 font-mono text-xs text-app-primary">
            <span className="inline-flex h-4 w-4 items-center justify-center text-app-accent-soft">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <rect
                  x="3.4"
                  y="7.1"
                  width="9.2"
                  height="6.1"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M5.5 7.1V5.8a2.5 2.5 0 0 1 5 0v1.3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="10.2" r="0.8" fill="currentColor" />
              </svg>
            </span>
            <span>login-request.json</span>
            <span className="text-app-dim">×</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-app-border-strong" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-app-base">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-app-primary">로그인</h1>
              <p className="mt-1 text-sm text-app-muted">
                이메일과 비밀번호를 입력해 계정에 로그인합니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-app-primary">이메일</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="duel@example.com"
                  className="h-10 w-full rounded-md border border-app-border bg-app-elevated px-3 text-sm text-app-primary outline-none transition focus:border-app-accent/60"
                  required
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-app-primary">비밀번호</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="비밀번호를 입력하세요"
                  className="h-10 w-full rounded-md border border-app-border bg-app-elevated px-3 text-sm text-app-primary outline-none transition focus:border-app-accent/60"
                  required
                />
              </label>
            </div>

            <div
              className={`mt-5 rounded-md border px-3 py-2 text-sm ${
                error
                  ? "border-app-danger/60 bg-app-danger/20 text-app-danger"
                  : "border-app-border bg-app-elevated text-app-secondary"
              }`}
            >
              {error ?? message}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white transition hover:bg-app-accent-hover disabled:cursor-not-allowed disabled:bg-app-elevated disabled:text-app-secondary"
            >
              {isPending ? "로그인 중..." : "로그인"}
            </button>

            <div className="mt-3 text-sm text-app-muted">
              아직 계정이 없다면{" "}
              <Link
                href="/signup"
                className="font-medium text-app-accent-soft transition hover:text-app-primary"
              >
                회원가입
              </Link>
              으로 이동하세요.
            </div>
          </div>
        </div>
      </main>
    </form>
  );
}
