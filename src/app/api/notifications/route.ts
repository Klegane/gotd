import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized } from "@/server/http";
import { getUserNotifications } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(await getUserNotifications(user.id));
}
