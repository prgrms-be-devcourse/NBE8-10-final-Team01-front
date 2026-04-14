import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { Difficulty } from "@/shared/api/contracts";

import {
  fetchBackendWithReissue,
  getErrorMessage,
  readJsonBody,
} from "@/shared/api/backend";
import { FRONTEND_ACCESS_TOKEN_COOKIE } from "@/shared/auth/session";

const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

interface BackendTagItem {
  code?: string;
  label?: string;
  value?: string;
  name?: string;
  difficulties?: unknown;
}

interface TagOption {
  value: string;
  label: string;
  difficulties?: Difficulty[];
}

function normalizeDifficulties(raw: unknown): Difficulty[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const incoming = new Set(
    raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is Difficulty => DIFFICULTY_ORDER.includes(item as Difficulty)),
  );

  return DIFFICULTY_ORDER.filter((item) => incoming.has(item));
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
      const difficulties = normalizeDifficulties(candidate.difficulties);

      if (!value || !label) {
        return null;
      }

      return { value, label, difficulties };
    })
    .filter((item): item is TagOption => item !== null);

  const dedupedByValue = new Map<string, TagOption>();

  for (const item of mapped) {
    const key = item.value.toLowerCase();
    const existing = dedupedByValue.get(key);

    if (!existing) {
      dedupedByValue.set(key, item);
      continue;
    }

    if (!item.difficulties || item.difficulties.length === 0) {
      continue;
    }

    const merged = new Set([...(existing.difficulties ?? []), ...item.difficulties]);
    dedupedByValue.set(key, {
      ...existing,
      difficulties: DIFFICULTY_ORDER.filter((difficulty) => merged.has(difficulty)),
    });
  }

  return Array.from(dedupedByValue.values());
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
