import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { forbidden, badRequest, unauthorized } from "@/server/http";
import { InvalidSessionError, updateVotingSession, type SessionMutationInput } from "@/server/voting";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden();
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as SessionMutationInput | null;

  if (!body) {
    return badRequest("Session details are required");
  }

  try {
    const session = await updateVotingSession(user.id, id, body);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
