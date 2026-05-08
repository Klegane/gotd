import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getCalendarSessions, getLocalDateForTimeZone, createVotingSession, InvalidSessionError, type SessionMutationInput } from "@/server/voting";
import { getServerEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const env = getServerEnv();
  const today = getLocalDateForTimeZone(new Date(), env.APP_TIMEZONE);
  const from = url.searchParams.get("from") ?? shiftLocalDate(today, -14);
  const to = url.searchParams.get("to") ?? shiftLocalDate(today, 45);

  try {
    const result = await getCalendarSessions(user.id, from, to, user.role === "admin");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

export async function POST(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as SessionMutationInput | null;

  if (!body) {
    return badRequest("Session details are required");
  }

  try {
    const session = await createVotingSession(user.id, body);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

function shiftLocalDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
