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

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue("/api/v2/matches/me", {}, cookieStore);

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
      { message: "매칭 상태 조회에 실패했습니다." },
      { status: 503 },
    );
  }
}
