import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getSessionParticipants, inviteUsersToSession, InvalidParticipantError } from "@/server/participants";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  return NextResponse.json({ participants: await getSessionParticipants(id) });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { userIds?: unknown } | null;
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((value): value is string => typeof value === "string") : [];

  try {
    const participants = await inviteUsersToSession(user.id, id, userIds, user.role === "admin");
    return NextResponse.json({ participants });
  } catch (error) {
    if (error instanceof InvalidParticipantError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
