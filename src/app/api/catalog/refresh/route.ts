import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { syncBoardGameGeekCatalog } from "@/server/bgg";
import { ConfigurationError } from "@/server/env";
import { configurationProblem, serverProblem, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  try {
    const result = await syncBoardGameGeekCatalog();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return configurationProblem(error.issues);
    }

    return serverProblem(error instanceof Error ? error.message : "BoardGameGeek refresh failed");
  }
}
