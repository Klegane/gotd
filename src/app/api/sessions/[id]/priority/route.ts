import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { InvalidPointError, InvalidProposalError, setPointBidForSession, setPriorityProposal } from "@/server/voting";

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
  const body = (await request.json().catch(() => null)) as { gameId?: unknown; points?: unknown } | null;
  const gameId = typeof body?.gameId === "string" ? body.gameId : null;

  if (!gameId) {
    return badRequest("gameId is required");
  }

  try {
    if (body?.points === undefined) {
      const proposals = await setPriorityProposal(user.id, id, gameId);
      return NextResponse.json({ proposals });
    }

    if (typeof body.points !== "number") {
      return badRequest("points must be a number");
    }

    const state = await setPointBidForSession(user.id, id, gameId, body.points, user.role === "admin");
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof InvalidProposalError || error instanceof InvalidPointError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
