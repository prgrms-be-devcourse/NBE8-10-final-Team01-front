import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  QueueJoinRequest,
  QueueStateResponse,
  QueueStatusResponse,
} from "@/shared/api/contracts";
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;

  if (!token || !member) {
    return unauthorizedResponse();
  }

  let payload: QueueJoinRequest;

  try {
    payload = (await request.json()) as QueueJoinRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 매칭 요청입니다." }, { status: 400 });
  }

  if (payload.category === "RANDOM") {
    return NextResponse.json(
      {
        message:
          "현재 백엔드 매칭은 실제 카테고리 태그만 지원합니다. 전체(무작위) 대신 구체 카테고리를 선택해주세요.",
      },
      { status: 400 },
    );
  }

  try {
    const queueStateResponse = await fetchBackend("/api/v1/queue/me", {
      token,
      searchParams: { userId: member.memberId },
    });

    if (queueStateResponse.ok) {
      const queueState = await readJsonBody<QueueStateResponse>(queueStateResponse);

      if (queueState?.inQueue) {
        return NextResponse.json(
          {
            message: `이미 ${queueState.category}/${queueState.difficulty} 큐에 참가 중입니다.`,
            category: queueState.category ?? payload.category,
            difficulty: queueState.difficulty ?? payload.difficulty,
            waitingCount: queueState.waitingCount,
          } satisfies QueueStatusResponse,
          { status: 409 },
        );
      }
    }

    const response = await fetchBackend("/api/v1/queue/join", {
      method: "POST",
      token,
      searchParams: { userId: member.memberId },
      body: payload,
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
      message: body?.message ?? "매칭 대기열에 참가했습니다.",
      category: body?.category ?? payload.category,
      difficulty: body?.difficulty ?? payload.difficulty,
      waitingCount: body?.waitingCount ?? 0,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "큐 참가 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
