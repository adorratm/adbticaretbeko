import { NextResponse } from "next/server";
import { readEnv, readGoogleClientId } from "../../../lib/read-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleClientId = readGoogleClientId();
  return NextResponse.json({
    googleClientId,
    apiBaseUrl: "",
    gatewayUrl: readEnv("NEXT_PUBLIC_API_BASE_URL") || "http://localhost:8080",
    realtimeUrl: readEnv("NEXT_PUBLIC_REALTIME_URL") || "http://localhost:8102",
  });
}
