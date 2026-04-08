import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import type { SessionResponse } from "@/shared/api/contracts";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getSessionMemberFromToken,
} from "@/shared/auth/session";

import "./globals.css";
import "katex/dist/katex.min.css";
import IdeShell from "@/features/layout/ide-shell";

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
    default: "BRACKET",
    template: "%s | BRACKET",
  },
  description: "실제 백엔드 API와 화면 구조를 맞추는 Algo Battle 프론트엔드.",
  icons: {
    icon: "/bracCo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;
  const initialSession: SessionResponse = {
    authenticated: member !== null,
    member,
  };

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[image:var(--app-bg-shell-gradient)] text-app-primary">
          <header className="sticky top-0 z-20 h-[var(--app-header-h)] border-b border-app-accent/25 bg-app-header/90 text-app-primary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.82)] backdrop-blur">
            <div className="flex h-full w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight text-app-primary"
              >
                BRACKET C{"{ }"}DE
              </Link>
            </div>
          </header>
          <main className="flex min-h-0 flex-1 overflow-hidden">
            <IdeShell initialSession={initialSession}>{children}</IdeShell>
          </main>
        </div>
      </body>
    </html>
  );
}
