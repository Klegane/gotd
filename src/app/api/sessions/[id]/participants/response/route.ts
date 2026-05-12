import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { InvalidParticipantError, isParticipantStatus, respondToSessionInvitation } from "@/server/participants";

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
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;

  if (!isParticipantStatus(body?.status)) {
    return badRequest("status is required");
  }

  try {
    const participants = await respondToSessionInvitation(user.id, id, body.status);
    return NextResponse.json({ participants });
  } catch (error) {
    if (error instanceof InvalidParticipantError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
