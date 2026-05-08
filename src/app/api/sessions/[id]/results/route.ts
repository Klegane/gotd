import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized } from "@/server/http";
import { getResultsForSession } from "@/server/voting";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const results = await getResultsForSession(id);
  return NextResponse.json({ results });
}
