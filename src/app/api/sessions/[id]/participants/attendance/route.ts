import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { InvalidParticipantError, markSessionAttendance } from "@/server/participants";

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
  const body = (await request.json().catch(() => null)) as { userId?: unknown; status?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const status = body?.status === "attended" || body?.status === "absent" ? body.status : null;

  if (!userId || !status) {
    return badRequest("userId and attendance status are required");
  }

  try {
    const participants = await markSessionAttendance(user.id, id, userId, status, user.role === "admin");
    return NextResponse.json({ participants });
  } catch (error) {
    if (error instanceof InvalidParticipantError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
