import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { RatingProgressApiResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      "/api/v1/members/me/rating-progress",
      {},
      cookieStore,
    );

    if (response.status === 401) {
      return NextResponse.json(
        {
          resultCode: "MEMBER_401",
          msg: "로그인이 필요합니다.",
          data: null,
        } satisfies RatingProgressApiResponse,
        { status: 401 },
      );
    }

    const body = await readJsonBody<RatingProgressApiResponse>(response.clone());

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
        msg: "내 레이팅 진행도 조회 성공",
        data: null,
      } satisfies RatingProgressApiResponse,
    );
  } catch {
    return NextResponse.json(
      {
        resultCode: "MEMBER_503",
        msg: "내 레이팅 진행도 조회에 실패했습니다.",
        data: null,
      } satisfies RatingProgressApiResponse,
      { status: 503 },
    );
  }
}
