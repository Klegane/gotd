import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, notFound, unauthorized } from "@/server/http";
import { getVotingSessionState, InvalidSessionError } from "@/server/voting";

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

  try {
    const state = await getVotingSessionState(user.id, id, user.role === "admin");
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return notFound(error.message);
    }

    return badRequest(error instanceof Error ? error.message : "Could not load session");
  }
}
