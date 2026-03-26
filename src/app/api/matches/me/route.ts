import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { MatchStatusResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const response = await fetchBackend("/api/v1/matches/me", { token });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<MatchStatusResponse>(response);
    return NextResponse.json(
      body ?? {
        status: "IDLE",
        roomId: null,
      } satisfies MatchStatusResponse,
    );
  } catch {
    return NextResponse.json(
      { message: "매칭 상태 조회에 실패했습니다." },
      { status: 503 },
    );
  }
}
