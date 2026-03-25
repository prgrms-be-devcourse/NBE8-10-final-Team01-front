import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  AuthMutationResponse,
  LoginRequest,
  RsData,
} from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import {
  extractAccessTokenFromSetCookie,
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getSessionMemberFromToken,
  ONE_YEAR_IN_SECONDS,
} from "@/shared/auth/session";

export async function POST(request: Request) {
  let payload: LoginRequest;

  try {
    payload = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 로그인 요청입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackend("/api/v1/members/login", {
      method: "POST",
      body: payload,
    });

    const body = await readJsonBody<RsData<null>>(response.clone());

    if (!response.ok) {
      return NextResponse.json(
        { message: body?.msg ?? (await getErrorMessage(response)) },
        { status: response.status },
      );
    }

    const token = extractAccessTokenFromSetCookie(response.headers.get("set-cookie"));
    const member = token ? getSessionMemberFromToken(token) : null;

    if (!token || !member) {
      return NextResponse.json(
        { message: "로그인 응답에서 세션 정보를 복원하지 못했습니다." },
        { status: 502 },
      );
    }

    const cookieStore = await cookies();

    cookieStore.set({
      name: FRONTEND_ACCESS_TOKEN_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_IN_SECONDS,
    });

    const result: AuthMutationResponse = {
      message: body?.msg ?? "로그인 성공",
      authenticated: true,
      member,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "백엔드 로그인 서버에 연결하지 못했습니다." },
      { status: 503 },
    );
  }
}
