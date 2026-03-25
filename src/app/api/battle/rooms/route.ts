import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { RoomListResponse } from "@/shared/api/contracts";
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
    const response = await fetchBackend("/api/v1/battle/rooms", { token });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<RoomListResponse[]>(response);
    return NextResponse.json(body ?? []);
  } catch {
    return NextResponse.json(
      { message: "진행 중인 방 목록을 가져오지 못했습니다." },
      { status: 503 },
    );
  }
}
