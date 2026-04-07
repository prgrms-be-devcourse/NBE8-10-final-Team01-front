import {
  FRONTEND_ACCESS_TOKEN_COOKIE,
  FRONTEND_REFRESH_TOKEN_COOKIE,
  extractAccessTokenFromSetCookie,
  ONE_YEAR_IN_SECONDS,
} from "@/shared/auth/session";

interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(cookie: {
    name: string;
    value: string;
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  }): void;
  delete(name: string): void;
}

const DEFAULT_BACKEND_BASE_URL = "http://localhost:8080";

function normalizeBackendBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function getBackendBaseUrl() {
  return normalizeBackendBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BACKEND_BASE_URL,
  );
}

export function buildBackendUrl(
  path: string,
  searchParams?: Record<string, string | number | undefined>,
) {
  const url = new URL(path, getBackendBaseUrl());

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

export async function fetchBackend(
  path: string,
  {
    token,
    refreshToken,
    headers,
    body,
    method = "GET",
    searchParams,
  }: {
    token?: string;
    refreshToken?: string;
    headers?: HeadersInit;
    body?: BodyInit | object;
    method?: string;
    searchParams?: Record<string, string | number | undefined>;
  } = {},
) {
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Cookie", `accessToken=${token}`);
  }

  if (refreshToken) {
    const existing = requestHeaders.get("Cookie");
    const rtCookie = `refreshToken=${refreshToken}`;
    requestHeaders.set("Cookie", existing ? `${existing}; ${rtCookie}` : rtCookie);
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    cache: "no-store",
  };

  if (body !== undefined) {
    if (
      typeof body === "string" ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof ArrayBuffer
    ) {
      init.body = body;
    } else {
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }

      init.body = JSON.stringify(body);
    }
  }

  return fetch(buildBackendUrl(path, searchParams), init);
}

export async function readJsonBody<T>(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBackendWithReissue(
  path: string,
  options: {
    headers?: HeadersInit;
    body?: BodyInit | object;
    method?: string;
    searchParams?: Record<string, string | number | undefined>;
  } = {},
  cookieStore: CookieStore,
): Promise<Response> {
  const accessToken = cookieStore.get(FRONTEND_ACCESS_TOKEN_COOKIE)?.value;
  const response = await fetchBackend(path, { ...options, token: accessToken });

  if (response.status !== 401) return response;

  const refreshToken = cookieStore.get(FRONTEND_REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) return response;

  const reissueResponse = await fetchBackend("/api/v1/auth/reissue", {
    method: "POST",
    refreshToken,
  });

  if (!reissueResponse.ok) {
    cookieStore.delete(FRONTEND_ACCESS_TOKEN_COOKIE);
    cookieStore.delete(FRONTEND_REFRESH_TOKEN_COOKIE);
    return response;
  }

  const newToken = extractAccessTokenFromSetCookie(reissueResponse.headers.get("set-cookie"));

  if (!newToken) return response;

  cookieStore.set({
    name: FRONTEND_ACCESS_TOKEN_COOKIE,
    value: newToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });

  return fetchBackend(path, { ...options, token: newToken });
}

export async function getErrorMessage(response: Response) {
  const json = await readJsonBody<{
    msg?: string;
    message?: string;
    error?: string;
  }>(response.clone());

  if (json?.msg) {
    return json.msg;
  }

  if (json?.message) {
    return json.message;
  }

  if (json?.error) {
    return json.error;
  }

  const text = await response.text();
  return text || "백엔드 요청에 실패했습니다.";
}
