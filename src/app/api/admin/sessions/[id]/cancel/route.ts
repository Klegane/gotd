import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { forbidden, badRequest, unauthorized } from "@/server/http";
import { cancelVotingSession, InvalidSessionError } from "@/server/voting";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden();
  }

  const { id } = await context.params;

  try {
    const session = await cancelVotingSession(user.id, id);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
