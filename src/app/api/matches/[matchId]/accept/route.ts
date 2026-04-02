import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { MatchStateResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

const defaultMatchState: MatchStateResponse = {
  status: "IDLE",
  readyCheck: null,
  room: null,
  message: null,
};

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matches/[matchId]/accept">,
) {
  const { matchId } = await context.params;
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(`/api/v2/matches/${matchId}/accept`, {
      method: "POST",
    }, cookieStore);

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

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
      { message: "매칭 수락 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
