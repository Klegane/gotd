import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { forbidden, badRequest, unauthorized } from "@/server/http";
import { ForbiddenCurationError, InvalidCurationError, setCuratedGameOptions } from "@/server/voting";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { gameIds?: unknown } | null;

  if (!Array.isArray(body?.gameIds) || !body.gameIds.every((gameId) => typeof gameId === "string")) {
    return badRequest("gameIds must be an array of game ids");
  }

  try {
    const curatedGameIds = await setCuratedGameOptions(user.id, id, body.gameIds, user.role === "admin");
    return NextResponse.json({ curatedGameIds });
  } catch (error) {
    if (error instanceof ForbiddenCurationError) {
      return forbidden(error.message);
    }

    if (error instanceof InvalidCurationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
