import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized } from "@/server/http";
import { listRegisteredUsers } from "@/server/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ users: await listRegisteredUsers() });
}
