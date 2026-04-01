import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueStateResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

const DEFAULT_REQUIRED_COUNT = 4;

const inactiveQueueState: QueueStateResponse = {
  inQueue: false,
  category: null,
  difficulty: null,
  waitingCount: 0,
  requiredCount: DEFAULT_REQUIRED_COUNT,
};

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue("/api/v2/queue/me", {}, cookieStore);

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<QueueStateResponse>(response);

    return NextResponse.json(
      body
        ? {
            ...body,
            requiredCount: body.requiredCount ?? DEFAULT_REQUIRED_COUNT,
          }
        : inactiveQueueState,
    );
  } catch {
    return NextResponse.json(
      { message: "대기열 상태 조회에 실패했습니다." },
      { status: 503 },
    );
  }
}
