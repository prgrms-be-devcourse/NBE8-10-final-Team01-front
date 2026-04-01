import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  SoloSubmitRequest,
  SubmissionResponse,
} from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function POST(
  request: Request,
  context: RouteContext<"/api/problems/[problemId]/submit">,
) {
  const { problemId } = await context.params;
  const parsedProblemId = Number(problemId);

  if (!Number.isFinite(parsedProblemId)) {
    return NextResponse.json({ message: "유효하지 않은 problemId입니다." }, { status: 400 });
  }

  const cookieStore = await cookies();

  let payload: SoloSubmitRequest;

  try {
    payload = (await request.json()) as SoloSubmitRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 제출 요청입니다." }, { status: 400 });
  }

  if (!payload.code || !payload.language) {
    return NextResponse.json({ message: "code와 language는 필수입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackendWithReissue("/api/v1/solo/submissions", {
      method: "POST",
      body: {
        problemId: parsedProblemId,
        code: payload.code,
        language: payload.language,
      },
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

    const body = await readJsonBody<SubmissionResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "솔로 제출 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
