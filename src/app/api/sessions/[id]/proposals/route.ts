import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { InvalidProposalError, proposeGameForSession } from "@/server/voting";

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
  const body = (await request.json().catch(() => null)) as { gameId?: unknown; isPriority?: unknown } | null;
  const gameId = typeof body?.gameId === "string" ? body.gameId : null;

  if (!gameId) {
    return badRequest("gameId is required");
  }

  try {
    const proposals = await proposeGameForSession(user.id, id, gameId, body?.isPriority === true, user.role === "admin");
    return NextResponse.json({ proposals });
  } catch (error) {
    if (error instanceof InvalidProposalError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
