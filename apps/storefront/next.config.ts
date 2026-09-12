import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import fs from "fs";
import path from "path";

function resolveMonorepoRoot(): string {
  const candidates = [
    path.join(__dirname, "../.."),
    process.cwd(),
    path.join(process.cwd(), "../.."),
  ];
  for (const dir of candidates) {
    const abs = path.resolve(dir);
    if (fs.existsSync(path.join(abs, ".env")) || fs.existsSync(path.join(abs, "yarn.lock"))) {
      return abs;
    }
  }
  return path.resolve(path.join(__dirname, "../.."));
}

loadEnvConfig(resolveMonorepoRoot());

const apiUpstream =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  transpilePackages: ["@adb/ui", "@adb/api-client", "@adb/api-types", "@adb/validation"],
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    // Browser uses same-origin /api/v1/* rewrite; absolute URL kept for SSR.
    NEXT_PUBLIC_API_BASE_URL: apiUpstream,
  },
  async redirects() {
    return [
      { source: "/kategori/beyaz-esya", destination: "/kategori/buzdolaplari", permanent: false },
      { source: "/kategori/ankastre", destination: "/kategori/ankastre-setler", permanent: false },
      { source: "/kategori/klima-kombi", destination: "/kategori/klimalar", permanent: false },
      { source: "/kategori/kucuk-ev", destination: "/kategori/kucuk-ev-robot", permanent: false },
      { source: "/kategori/tv", destination: "/kategori/kucuk-ev-robot", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUpstream}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
