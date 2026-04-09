import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  AdminProblemSingleValidateResponse,
  AdminProblemUpsertRequest,
} from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  let payload: AdminProblemUpsertRequest;
  try {
    payload = (await request.json()) as AdminProblemUpsertRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackendWithReissue(
      "/api/v1/admin/problems/validate",
      {
        method: "POST",
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

    const body = await readJsonBody<AdminProblemSingleValidateResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "단건 검증 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}

