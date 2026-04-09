import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  AdminProblemMutationResponse,
  AdminProblemUpsertRequest,
} from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ problemId: string }> },
) {
  const { problemId } = await context.params;
  const parsedProblemId = Number(problemId);

  if (!Number.isInteger(parsedProblemId) || parsedProblemId <= 0) {
    return NextResponse.json({ message: "유효하지 않은 problemId입니다." }, { status: 400 });
  }

  let payload: AdminProblemUpsertRequest;
  try {
    payload = (await request.json()) as AdminProblemUpsertRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      `/api/v1/admin/problems/${parsedProblemId}`,
      {
        method: "PATCH",
        body: payload,
      },
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<AdminProblemMutationResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "문제 수정 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
