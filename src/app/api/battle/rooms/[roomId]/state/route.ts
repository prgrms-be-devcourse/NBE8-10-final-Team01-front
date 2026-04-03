import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { BattleRoomStateResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/battle/rooms/[roomId]/state">,
) {
  const { roomId } = await context.params;
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(`/api/v1/battle/rooms/${roomId}/state`, {}, cookieStore);

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<BattleRoomStateResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "배틀룸 상태를 가져오지 못했습니다." },
      { status: 503 },
    );
  }
}
