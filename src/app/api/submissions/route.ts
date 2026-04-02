import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  SubmissionResponse,
  SubmitPayload,
} from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  getMemberIdFromToken,
} from "@/shared/auth/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const memberId = token ? getMemberIdFromToken(token) : null;

  if (!token || !memberId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload: SubmitPayload;

  try {
    payload = (await request.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ message: "잘못된 제출 요청입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackendWithReissue("/api/v1/submissions", {
      method: "POST",
      body: {
        roomId: payload.roomId,
        memberId,
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

    const body = await readJsonBody<SubmissionResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "제출 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
