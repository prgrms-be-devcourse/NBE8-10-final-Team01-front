import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { SessionResponse } from "@/shared/api/contracts";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getSessionMemberFromToken,
} from "@/shared/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;

  if (token && !member) {
    cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
  }

  const payload: SessionResponse = {
    authenticated: member !== null,
    member,
  };

  return NextResponse.json(payload);
}
