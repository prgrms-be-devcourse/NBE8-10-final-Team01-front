import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueStatusResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getSessionMemberFromToken,
} from "@/shared/auth/session";

function unauthorizedResponse() {
  return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;

  if (!token || !member) {
    return unauthorizedResponse();
  }

  try {
    const response = await fetchBackend("/api/v1/queue/cancel", {
      method: "DELETE",
      token,
      searchParams: { userId: member.memberId },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<{
      message: string;
      category: string;
      difficulty: string;
      waitingCount: number;
    }>(response);

    const result: QueueStatusResponse = {
      message: body?.message ?? "매칭 대기열에서 취소되었습니다.",
      category: body?.category ?? "",
      difficulty: body?.difficulty ?? "",
      waitingCount: body?.waitingCount ?? 0,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "큐 취소 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
