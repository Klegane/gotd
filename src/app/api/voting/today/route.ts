import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { castVote, getDailyVotingState, InvalidSessionError, InvalidVoteError } from "@/server/voting";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  try {
    const state = await getDailyVotingState(user.id);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

export async function POST(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as { gameId?: unknown } | null;
  const gameId = typeof body?.gameId === "string" ? body.gameId : null;

  if (!gameId) {
    return badRequest("gameId is required");
  }

  try {
    const state = await castVote(user.id, gameId);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidVoteError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
