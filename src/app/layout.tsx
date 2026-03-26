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
        <div className="min-h-screen bg-zinc-100 text-zinc-950">
          <header className="sticky top-0 z-20 border-b border-zinc-300 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <Link href="/" className="text-lg font-semibold tracking-tight">
                    Algo Battle Front
                  </Link>
                  <p className="text-sm text-zinc-600">
                    Next 16 App Router 기준 화면 구조를 실제 API 흐름에 맞춰 정리한다.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  API-first / BFF proxy
                </p>
              </div>
              <nav className="flex flex-wrap gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
