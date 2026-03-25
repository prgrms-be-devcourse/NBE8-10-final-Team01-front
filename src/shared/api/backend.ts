const DEFAULT_BACKEND_BASE_URL = "http://localhost:8080";

export function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;
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
    headers,
    body,
    method = "GET",
    searchParams,
  }: {
    token?: string;
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
