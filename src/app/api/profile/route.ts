import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getUserProfile, InvalidProfileError, updateUserProfile } from "@/server/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  try {
    return NextResponse.json(await getUserProfile(user.id));
  } catch (error) {
    if (error instanceof InvalidProfileError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as { nickname?: unknown } | null;

  if (!body) {
    return badRequest("Profile details are required");
  }

  try {
    const updated = await updateUserProfile(user.id, body);
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof InvalidProfileError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
