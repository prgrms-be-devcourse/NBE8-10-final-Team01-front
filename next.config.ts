import type { NextConfig } from "next";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ws/:path*",
        destination: `${BACKEND_BASE_URL}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
