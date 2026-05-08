import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getSessionMessages, createSessionMessage, InvalidMessageError } from "@/server/messages";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;
  const messages = await getSessionMessages(id);
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { content?: string } | null;

  if (!body?.content) {
    return badRequest("Message content is required");
  }

  try {
    const message = await createSessionMessage(user.id, id, body.content);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof InvalidMessageError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
