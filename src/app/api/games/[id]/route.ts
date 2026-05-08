import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { unauthorized, notFound } from "@/server/http";
import { getGameDetail } from "@/server/games";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await params;
  const result = await getGameDetail(id, user.id);

  if (!result) {
    return notFound("Game not found");
  }

  return NextResponse.json(result);
}
