import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { castVoteForSession, InvalidSessionError, InvalidVoteError, submitBallotForSession, type BallotAllocationInput } from "@/server/voting";

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
  const body = (await request.json().catch(() => null)) as { allocations?: unknown; gameId?: unknown } | null;
  const gameId = typeof body?.gameId === "string" ? body.gameId : null;
  const allocations = parseAllocations(body?.allocations);

  if (!gameId && !allocations) {
    return badRequest("allocations or gameId is required");
  }

  try {
    const state = allocations
      ? await submitBallotForSession(user.id, id, allocations, user.role === "admin")
      : await castVoteForSession(user.id, id, gameId ?? "", user.role === "admin");
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidVoteError || error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

function parseAllocations(value: unknown): BallotAllocationInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((allocation) => {
      if (!allocation || typeof allocation !== "object") {
        return null;
      }

      const candidate = allocation as { gameId?: unknown; voteCount?: unknown };
      return typeof candidate.gameId === "string" && typeof candidate.voteCount === "number"
        ? { gameId: candidate.gameId, voteCount: candidate.voteCount }
        : null;
    })
    .filter((allocation): allocation is BallotAllocationInput => allocation !== null);
}
