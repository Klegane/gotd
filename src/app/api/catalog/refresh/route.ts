import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { enqueueCatalogSync } from "@/server/bgg";
import { wakeCatalogSyncWorker } from "@/server/catalog-sync-worker";
import { ConfigurationError } from "@/server/env";
import { configurationProblem, forbidden, serverProblem, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden("Admin access required");
  }

  try {
    const result = await enqueueCatalogSync(user.id);
    wakeCatalogSyncWorker();

    return NextResponse.json(
      {
        run: result.run,
        reused: !result.created
      },
      {
        status: 202,
        headers: {
          Location: `/api/catalog/refresh/${result.run.id}`
        }
      }
    );
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return configurationProblem(error.issues);
    }

    return serverProblem(error instanceof Error ? error.message : "BoardGameGeek refresh failed");
  }
}
