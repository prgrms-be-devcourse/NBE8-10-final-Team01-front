import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueJoinRequest, QueueStatusResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

const DEFAULT_REQUIRED_COUNT = 4;

export async function POST(request: Request) {
  const cookieStore = await cookies();

  let payload: QueueJoinRequest;

  try {
    payload = (await request.json()) as QueueJoinRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackendWithReissue("/api/v2/queue/join", {
      method: "POST",
      body: payload,
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
