import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { clearGamePreference, InvalidPreferenceError, isPreferenceState, setGamePreference } from "@/server/preferences";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { gameId } = await context.params;
  const body = (await request.json().catch(() => null)) as { preference?: unknown } | null;

  if (!isPreferenceState(body?.preference)) {
    return badRequest("preference must be favorite or vetoed");
  }

  try {
    const preference = await setGamePreference(user.id, gameId, body.preference);
    return NextResponse.json({ preference });
  } catch (error) {
    if (error instanceof InvalidPreferenceError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { gameId } = await context.params;
  await clearGamePreference(user.id, gameId);
  return NextResponse.json({ ok: true });
}
