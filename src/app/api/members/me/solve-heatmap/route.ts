import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { SolveHeatmapApiResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year") ?? String(new Date().getFullYear());
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      "/api/v1/members/me/solve-heatmap",
      {
        searchParams: {
          year,
        },
      },
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json(
        {
          resultCode: "MEMBER_401",
          msg: "로그인이 필요합니다.",
          data: null,
        } satisfies SolveHeatmapApiResponse,
        { status: 401 },
      );
    }

    const body = await readJsonBody<SolveHeatmapApiResponse>(response.clone());

    if (!response.ok) {
      return NextResponse.json(
        body ?? {
          resultCode: String(response.status),
          msg: await getErrorMessage(response),
          data: null,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(
      body ?? {
        resultCode: "200",
        msg: "풀이 히트맵 조회 성공",
        data: null,
      } satisfies SolveHeatmapApiResponse,
    );
  } catch {
    return NextResponse.json(
      {
        resultCode: "MEMBER_503",
        msg: "풀이 히트맵 조회에 실패했습니다.",
        data: null,
      } satisfies SolveHeatmapApiResponse,
      { status: 503 },
    );
  }
}
