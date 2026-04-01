import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { fetchBackend } from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE, FRONTEND_REFRESH_TOKEN_COOKIE } from "@/shared/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  try {
    if (token) {
      await fetchBackend("/api/v1/members/logout", {
        method: "POST",
        token,
      });
    }
  } catch {
    // 로그아웃은 프론트 쿠키 삭제를 우선한다.
  }

  cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(FRONTEND_REFRESH_TOKEN_COOKIE);

  return NextResponse.json({
    message: "로그아웃되었습니다.",
    authenticated: false,
    member: null,
  });
}
