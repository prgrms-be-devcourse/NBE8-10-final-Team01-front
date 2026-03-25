import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  SubmissionResponse,
  SubmitPayload,
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const member = token ? getSessionMemberFromToken(token) : null;

  if (!token || !member) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload: SubmitPayload;

  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ message: "잘못된 제출 요청입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackend("/api/v1/submissions", {
      method: "POST",
      token,
      body: {
        roomId: payload.roomId,
        memberId: member.memberId,
        code: payload.code,
        language: payload.language,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<SubmissionResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "제출 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
