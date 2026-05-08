import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { forbidden, badRequest, unauthorized } from "@/server/http";
import { createVotingSession, InvalidSessionError, type SessionMutationInput } from "@/server/voting";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "admin") {
    return forbidden();
  }

  const body = (await request.json().catch(() => null)) as SessionMutationInput | null;

  if (!body) {
    return badRequest("Session details are required");
  }

  try {
    const session = await createVotingSession(user.id, body);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
