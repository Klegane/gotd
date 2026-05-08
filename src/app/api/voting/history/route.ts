import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized } from "@/server/http";
import { getVotingHistory } from "@/server/voting";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const history = await getVotingHistory();
  return NextResponse.json({ history });
}
