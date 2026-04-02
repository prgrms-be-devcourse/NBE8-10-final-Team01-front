import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

interface BackendTagItem {
  code?: string;
  label?: string;
  value?: string;
  name?: string;
}

interface TagOption {
  value: string;
  label: string;
}

function normalizeTags(payload: unknown): TagOption[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : null;

  if (!Array.isArray(source)) {
    return [];
  }

  const mapped = source
    .map((item) => {
      if (typeof item === "string") {
        return {
          value: item.trim(),
          label: item.trim(),
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as BackendTagItem;
      const value = (candidate.code ?? candidate.value ?? candidate.name ?? "").trim();
      const label = (candidate.label ?? candidate.name ?? candidate.code ?? value).trim();

      if (!value || !label) {
        return null;
      }

      return { value, label };
    })
    .filter((item): item is TagOption => item !== null);

  const deduped: TagOption[] = [];
  const seen = new Set<string>();

  for (const item of mapped) {
    const key = item.value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json([] as TagOption[]);
  }

  try {
    const response = await fetchBackendWithReissue("/api/v1/tags", {}, cookieStore);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json([] as TagOption[]);
      }

      return NextResponse.json(
        { message: await getErrorMessage(response) },
        { status: response.status },
      );
    }

    const body = await readJsonBody<unknown>(response);
    return NextResponse.json(normalizeTags(body));
  } catch {
    return NextResponse.json([] as TagOption[]);
  }
}
