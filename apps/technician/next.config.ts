import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import fs from "fs";
import path from "path";

function resolveMonorepoRoot(): string {
  const candidates = [path.join(__dirname, "../.."), process.cwd(), path.join(process.cwd(), "../..")];
  for (const dir of candidates) {
    const abs = path.resolve(dir);
    if (fs.existsSync(path.join(abs, ".env")) || fs.existsSync(path.join(abs, "yarn.lock"))) {
      return abs;
    }
  }
  return path.resolve(path.join(__dirname, "../.."));
}

loadEnvConfig(resolveMonorepoRoot());

const apiUpstream = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  transpilePackages: ["@adb/ui", "@adb/api-client"],
  env: {
    NEXT_PUBLIC_API_BASE_URL: apiUpstream,
    NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:8102",
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUpstream}/api/v1/:path*` }];
  },
};

export default nextConfig;
