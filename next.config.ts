import type { NextConfig } from "next";

const DEFAULT_BACKEND_BASE_URL = "http://localhost:8080";

function normalizeBackendBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

const BACKEND_BASE_URL = normalizeBackendBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BACKEND_BASE_URL,
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_BASE_URL}/api/v1/:path*`,
      },
      {
        source: "/api/v2/:path*",
        destination: `${BACKEND_BASE_URL}/api/v2/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${BACKEND_BASE_URL}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
