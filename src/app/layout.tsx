import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BRACKET {}",
    template: "%s | BRACKET {}",
  },
  description:
    "실제 백엔드 API와 화면 구조를 맞추는 Algo Battle 프론트엔드.",
};

const navigation = [
  { href: "/", label: "메인" },
  { href: "/problems", label: "문제목록" },
  { href: "/login", label: "로그인" },
  { href: "/signup", label: "회원가입" },
  { href: "/mypage", label: "마이페이지" },
  { href: "/spectate", label: "관전" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="min-h-screen bg-[radial-gradient(circle_at_16%_0%,rgba(167,139,250,0.16),transparent_36%),radial-gradient(circle_at_82%_100%,rgba(139,92,246,0.1),transparent_44%),linear-gradient(180deg,#0f1115_0%,#12141b_48%,#0d0f13_100%)] text-zinc-100">
          <header className="sticky top-0 z-20 h-[var(--app-header-h)] border-b border-violet-400/20 bg-[#12141c]/88 text-zinc-100 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.82)] backdrop-blur">
            <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
                BRACKET {"{}"}
              </Link>
              <nav className="flex flex-wrap items-center justify-end gap-1.5">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-violet-300/70 hover:bg-violet-500/20 hover:text-zinc-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
