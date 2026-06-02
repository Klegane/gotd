import { NextResponse } from "next/server";

import { getConfigStatus } from "@/server/env";

export const dynamic = "force-dynamic";

// Liveness probe: is the app process up and configured? This intentionally
// does NOT touch the database, so polling it (e.g. the Docker healthcheck)
// never wakes a suspended/serverless database. Use /api/ready for a check
// that verifies database connectivity.
export async function GET() {
  const config = getConfigStatus();

  if (!config.ok) {
    return NextResponse.json(
      {
        status: "unhealthy",
        configuration: config.issues
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    appUrl: config.env.APP_URL,
    timezone: config.env.APP_TIMEZONE
  });
}
