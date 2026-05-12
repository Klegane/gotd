import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getVotingSessionState, InvalidSessionError, recordPlayedGameAndSettlePoints } from "@/server/voting";

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
  const body = (await request.json().catch(() => null)) as { playedGameId?: unknown } | null;
  const playedGameId = typeof body?.playedGameId === "string" ? body.playedGameId : null;

  if (!playedGameId) {
    return badRequest("playedGameId is required");
  }

  try {
    await recordPlayedGameAndSettlePoints(user.id, id, playedGameId, user.role === "admin");
    return NextResponse.json(await getVotingSessionState(user.id, id, user.role === "admin"));
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
