import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { SessionResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  readJsonBody,
} from "@/shared/api/backend";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  FRONTEND_REFRESH_TOKEN_COOKIE,
  ONE_YEAR_IN_SECONDS,
  extractAccessTokenFromSetCookie,
  getSessionMemberFromToken,
} from "@/shared/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  let member = token ? getSessionMemberFromToken(token) : null;

  if (token && !member) {
    // accessToken이 만료된 경우 reissue 시도
    const refreshToken = cookieStore.get(FRONTEND_REFRESH_TOKEN_COOKIE)?.value;

    if (refreshToken) {
      try {
        const reissueResponse = await fetchBackend("/api/v1/auth/reissue", {
          method: "POST",
          refreshToken,
        });

        if (reissueResponse.ok) {
          const newToken = extractAccessTokenFromSetCookie(reissueResponse.headers.get("set-cookie"));

          if (newToken) {
            cookieStore.set({
              name: FRONTEND_ACCESS_TOKEN_COOKIE,
              value: newToken,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: ONE_YEAR_IN_SECONDS,
            });
            member = getSessionMemberFromToken(newToken);
          }
        } else {
          await readJsonBody(reissueResponse); // body drain
          cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
          cookieStore.delete(FRONTEND_REFRESH_TOKEN_COOKIE);
        }
      } catch {
        cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
        cookieStore.delete(FRONTEND_REFRESH_TOKEN_COOKIE);
      }
    } else {
      cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
    }
  }

  const payload: SessionResponse = {
    authenticated: member !== null,
    member,
  };

  return NextResponse.json(payload);
}
