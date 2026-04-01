import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { MyBattleResultsResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

function buildFallbackPageInfo(pageParam: string | null, sizeParam: string | null) {
  const page = Number(pageParam ?? "0");
  const size = Number(sizeParam ?? "20");

  return {
    page: Number.isFinite(page) ? page : 0,
    size: Number.isFinite(size) ? size : 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "0";
  const size = url.searchParams.get("size") ?? "20";

  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue("/api/v1/members/me/battle-results", {
      searchParams: {
        page,
        size,
      },
    }, cookieStore);

    if (response.status === 401) {
      return NextResponse.json(
        {
          resultCode: "MEMBER_401",
          msg: "로그인이 필요합니다.",
          data: null,
        } satisfies MyBattleResultsResponse,
        { status: 401 },
      );
    }

    const body = await readJsonBody<MyBattleResultsResponse>(response.clone());

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
        msg: "내 전적 조회 성공",
        data: {
          battleResults: [],
          pageInfo: buildFallbackPageInfo(page, size),
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        resultCode: "MEMBER_503",
        msg: "내 전적 조회에 실패했습니다.",
        data: null,
      } satisfies MyBattleResultsResponse,
      { status: 503 },
    );
  }
}
