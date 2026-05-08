import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { castVoteForSession, InvalidSessionError, InvalidVoteError } from "@/server/voting";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { gameId?: unknown } | null;
  const gameId = typeof body?.gameId === "string" ? body.gameId : null;

  if (!gameId) {
    return badRequest("gameId is required");
  }

  try {
    const state = await castVoteForSession(user.id, id, gameId, user.role === "admin");
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidVoteError || error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
