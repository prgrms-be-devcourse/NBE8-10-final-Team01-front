import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { fetchBackendWithReissue, getErrorMessage } from "@/shared/api/backend";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/battle/result/[roomId]/check">,
) {
  const { roomId } = await context.params;
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue(
      `/api/v1/battle/result/${roomId}/check`,
      { method: "POST" },
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

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { message: "배틀 결과 확인 처리에 실패했습니다." },
      { status: 503 },
    );
  }
}
