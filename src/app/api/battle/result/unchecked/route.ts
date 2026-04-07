import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { UncheckedBattleResult } from "@/shared/api/contracts";
import { fetchBackendWithReissue, getErrorMessage, readJsonBody } from "@/shared/api/backend";

export async function GET() {
  const cookieStore = await cookies();

  try {
    const response = await fetchBackendWithReissue("/api/v1/battle/result/unchecked", {}, cookieStore);

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<UncheckedBattleResult | null>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "미확인 배틀 결과를 가져오지 못했습니다." },
      { status: 503 },
    );
  }
}
