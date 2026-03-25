import { NextResponse } from "next/server";

import type { JoinRequest, RsData } from "@/shared/api/contracts";
import {
  fetchBackend,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

export async function POST(request: Request) {
  let payload: JoinRequest;

  try {
    payload = (await request.json()) as JoinRequest;
  } catch {
    return NextResponse.json({ message: "잘못된 회원가입 요청입니다." }, { status: 400 });
  }

  try {
    const response = await fetchBackend("/api/v1/members/join", {
      method: "POST",
      body: payload,
    });

    const body = await readJsonBody<RsData<null>>(response.clone());

    if (!response.ok) {
      return NextResponse.json(
        { message: body?.msg ?? (await getErrorMessage(response)) },
        { status: response.status },
      );
    }

    return NextResponse.json({
      message: body?.msg ?? "회원가입이 완료되었습니다.",
    });
  } catch {
    return NextResponse.json(
      { message: "백엔드 회원가입 서버에 연결하지 못했습니다." },
      { status: 503 },
    );
  }
}
