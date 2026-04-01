import type { SessionMember } from "@/shared/api/contracts";

export const FRONTEND_ACCESS_TOKEN_COOKIE = "accessToken";
export const FRONTEND_REFRESH_TOKEN_COOKIE = "refreshToken";
export const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

interface JwtPayload {
  sub?: string;
  email?: string;
  nickname?: string;
  role?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getSessionMemberFromToken(token: string): SessionMember | null {
  const payload = decodeJwtPayload(token);

  if (!payload?.sub || !payload.email || !payload.nickname || !payload.role) {
    return null;
  }

  if (payload.exp && Date.now() >= payload.exp * 1000) {
    return null;
  }

  const memberId = Number(payload.sub);

  if (!Number.isFinite(memberId)) {
    return null;
  }

  return {
    memberId,
    email: payload.email,
    nickname: payload.nickname,
    role: payload.role,
  };
}

export function extractAccessTokenFromSetCookie(
  setCookieHeader: string | null,
): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const matched = setCookieHeader.match(/(?:^|,\s*)accessToken=([^;]+)/);

  if (!matched?.[1]) {
    return null;
  }

  return decodeURIComponent(matched[1]);
}

export function extractRefreshTokenFromSetCookie(
  setCookieHeader: string | null,
): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const matched = setCookieHeader.match(/(?:^|,\s*)refreshToken=([^;]+)/);

  if (!matched?.[1]) {
    return null;
  }

  return decodeURIComponent(matched[1]);
}

// exp 만료 여부와 무관하게 토큰에서 memberId만 추출 — 만료된 토큰에서도 사용 가능
export function getMemberIdFromToken(token: string): number | null {
  const payload = decodeJwtPayload(token);

  if (!payload?.sub) {
    return null;
  }

  const memberId = Number(payload.sub);

  return Number.isFinite(memberId) ? memberId : null;
}
