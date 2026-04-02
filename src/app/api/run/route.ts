import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { RunPayload } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload: RunPayload;

  try {
    payload = (await request.json()) as RunPayload;
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackendWithReissue("/api/v1/run", {
      method: "POST",
      body: {
        roomId: payload.roomId,
        code: payload.code,
        language: payload.language,
      },
    }, cookieStore);

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "실행 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
