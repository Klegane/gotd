import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { getCatalogSyncJob } from "@/server/bgg";
import { forbidden, notFound, serverProblem, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden("Admin access required");
  }

  try {
    const { runId } = await context.params;
    const run = await getCatalogSyncJob(runId);

    if (!run) {
      return notFound("Catalog refresh not found");
    }

    return NextResponse.json({ run });
  } catch (error) {
    return serverProblem(error instanceof Error ? error.message : "Could not load catalog refresh status");
  }
}
