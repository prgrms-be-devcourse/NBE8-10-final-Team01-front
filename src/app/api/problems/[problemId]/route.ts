import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { ProblemDetailResponse } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/problems/[problemId]">,
) {
  const { problemId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const response = await fetchBackend(`/api/v1/problems/${problemId}`, { token });

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
