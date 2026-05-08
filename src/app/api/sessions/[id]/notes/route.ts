import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, forbidden, unauthorized, notFound } from "@/server/http";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { notes?: string } | null;

  if (body === null || typeof body.notes !== "string") {
    return badRequest("Notes field is required");
  }

  const session = await prisma.votingSession.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true }
  });

  if (!session) {
    return notFound("Session not found");
  }

  if (session.createdByUserId !== user.id && user.role !== "admin") {
    return forbidden("Only the session creator or an admin can edit notes");
  }

  const updated = await prisma.votingSession.update({
    where: { id },
    data: {
      notes: body.notes.trim() || null,
      updatedByUserId: user.id
    }
  });

  return NextResponse.json({ notes: updated.notes });
}
