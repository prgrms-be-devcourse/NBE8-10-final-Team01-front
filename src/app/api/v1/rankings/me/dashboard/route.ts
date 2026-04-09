import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { RankingDashboardResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      "/api/v1/rankings/me/dashboard",
      {},
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await readJsonBody<RankingDashboardResponse>(response.clone());

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    if (!body) {
      return NextResponse.json(
        { message: "랭킹 대시보드 응답을 읽지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "랭킹 대시보드 조회에 실패했습니다." },
      { status: 503 },
    );
  }
}
