import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { ProblemListResponse } from "@/shared/api/contracts";
import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";

const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 20;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(request.url);
  const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const size = parsePositiveInteger(searchParams.get("size"), DEFAULT_SIZE);

  try {
    const response = await fetchBackendWithReissue("/api/v1/problems", {
      searchParams: { page, size },
    }, cookieStore);

    if (response.status === 401) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<ProblemListResponse>(response);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "문제 목록을 조회하지 못했습니다." },
      { status: 503 },
    );
  }
}
