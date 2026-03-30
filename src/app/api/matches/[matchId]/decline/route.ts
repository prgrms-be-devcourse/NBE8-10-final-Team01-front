import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { MatchStateResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

const defaultMatchState: MatchStateResponse = {
  status: "IDLE",
  readyCheck: null,
  room: null,
  message: null,
};

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matches/[matchId]/decline">,
) {
  const { matchId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const response = await fetchBackend(`/api/v2/matches/${matchId}/decline`, {
      method: "POST",
      token,
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<MatchStateResponse>(response);
    return NextResponse.json(body ?? defaultMatchState);
  } catch {
    return NextResponse.json(
      { message: "매칭 거절 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
