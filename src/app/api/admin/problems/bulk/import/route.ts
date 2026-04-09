import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type {
  AdminProblemBulkImportResponse,
  AdminProblemBulkRequest,
} from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function POST(request: Request) {
  let payload: AdminProblemBulkRequest;
  try {
    payload = (await request.json()) as AdminProblemBulkRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      "/api/v1/admin/problems/bulk/import",
      {
        method: "POST",
        body: payload,
      },
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (response.status === 400) {
      const invalid = await readJsonBody<Record<string, unknown>>(response);
      return NextResponse.json(
        invalid ?? { message: "대량 등록 검증에 실패했습니다." },
        { status: 400 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<AdminProblemBulkImportResponse>(response);
    return NextResponse.json(body, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "대량 등록 요청에 실패했습니다." },
      { status: 503 },
    );
  }
}
