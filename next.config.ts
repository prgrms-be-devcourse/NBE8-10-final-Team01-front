import type { NextConfig } from "next";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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