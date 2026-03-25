import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { QueueStateResponse } from "@/shared/api/contracts";
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

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;

  if (!token || !member) {
    return unauthorizedResponse();
  }

  try {
    const response = await fetchBackend("/api/v1/queue/me", {
      token,
      searchParams: { userId: member.memberId },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<QueueStateResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "큐 상태를 조회할 수 없습니다." },
      { status: 503 },
    );
  }
}
