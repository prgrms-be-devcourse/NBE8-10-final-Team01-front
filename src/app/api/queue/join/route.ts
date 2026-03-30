import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueJoinRequest, QueueStatusResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

const DEFAULT_REQUIRED_COUNT = 4;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload: QueueJoinRequest;

  try {
    payload = (await request.json()) as QueueJoinRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackend("/api/v2/queue/join", {
      method: "POST",
      token,
      body: payload,
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<QueueStatusResponse>(response);

    return NextResponse.json({
      message: body?.message ?? "매칭 대기열에 참가했습니다.",
      category: body?.category ?? payload.category,
      difficulty: body?.difficulty ?? payload.difficulty,
      waitingCount: body?.waitingCount ?? 1,
      requiredCount: body?.requiredCount ?? DEFAULT_REQUIRED_COUNT,
    } satisfies QueueStatusResponse);
  } catch {
    return NextResponse.json(
      { message: "매칭 참가 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
