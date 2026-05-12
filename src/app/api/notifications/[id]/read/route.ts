import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { InvalidNotificationError, markNotificationRead } from "@/server/notifications";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    await markNotificationRead(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidNotificationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
