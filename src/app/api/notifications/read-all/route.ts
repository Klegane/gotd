import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized } from "@/server/http";
import { markAllNotificationsRead } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
