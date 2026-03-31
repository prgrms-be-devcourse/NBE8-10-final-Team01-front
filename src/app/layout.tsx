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
    default: "Algo Battle Front",
    template: "%s | Algo Battle Front",
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
        <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(196,181,253,0.55),transparent_38%),radial-gradient(circle_at_85%_100%,rgba(167,139,250,0.32),transparent_42%),linear-gradient(180deg,#f8f4ff_0%,#f2ebff_52%,#ede4ff_100%)] text-zinc-950">
          <header className="sticky top-0 z-20 border-b border-violet-300/60 bg-white/82 text-zinc-900 shadow-[0_10px_22px_-18px_rgba(76,29,149,0.55)] backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
              <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900">
                Algo Battle Front
              </Link>
              <nav className="flex flex-wrap items-center justify-end gap-1.5">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-violet-300/80 bg-white px-2.5 py-1 text-xs text-violet-900 transition hover:border-violet-500 hover:bg-violet-100"
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
