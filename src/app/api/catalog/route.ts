import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { getCatalogSummary } from "@/server/bgg";
import { unauthorized } from "@/server/http";
import { addPreferencesToGames } from "@/server/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const summary = await getCatalogSummary();
  return NextResponse.json({
    ...summary,
    games: await addPreferencesToGames(user.id, summary.games)
  });
}
