import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueStatusResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

const DEFAULT_REQUIRED_COUNT = 4;

export async function DELETE() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue("/api/v2/queue/cancel", {
      method: "DELETE",
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
      message: body?.message ?? "매칭 대기열에서 취소됐습니다.",
      category: body?.category ?? "",
      difficulty: body?.difficulty ?? "",
      waitingCount: body?.waitingCount ?? 0,
      requiredCount: body?.requiredCount ?? DEFAULT_REQUIRED_COUNT,
    } satisfies QueueStatusResponse);
  } catch {
    return NextResponse.json(
      { message: "매칭 취소 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
