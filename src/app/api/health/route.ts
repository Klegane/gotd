import { NextResponse } from "next/server";

import { checkDatabase } from "@/server/db";
import { getConfigStatus } from "@/server/env";

export const dynamic = "force-dynamic";

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

  try {
    await checkDatabase();
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: error instanceof Error ? error.message : "Database check failed"
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
