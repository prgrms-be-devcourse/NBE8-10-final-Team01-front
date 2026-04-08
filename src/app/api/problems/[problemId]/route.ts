import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { ProblemDetailResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function GET(
  request: Request,
  context: RouteContext<"/api/problems/[problemId]">,
) {
  const { problemId } = await context.params;
  const cookieStore = await cookies();

  const requestUrl = new URL(request.url);
  const lang = requestUrl.searchParams.get("lang");

  const backendPath = lang
    ? `/api/v1/problems/${problemId}?lang=${encodeURIComponent(lang)}`
    : `/api/v1/problems/${problemId}`;

  try {
    const response = await fetchBackendWithReissue(
      backendPath,
      {},
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<ProblemDetailResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "문제 상세를 가져오지 못했습니다." },
      { status: 503 },
    );
  }
}
