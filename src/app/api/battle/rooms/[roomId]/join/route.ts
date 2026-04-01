import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { JoinRoomResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getMemberIdFromToken,
} from "@/shared/auth/session";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/battle/rooms/[roomId]/join">,
) {
  const { roomId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const memberId = token ? getMemberIdFromToken(token) : null;

  if (!token || !memberId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const response = await fetchBackendWithReissue(`/api/v1/battle/rooms/${roomId}/join`, {
      method: "POST",
      body: { memberId },
    }, cookieStore);

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<JoinRoomResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "배틀룸 입장 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
