import { NextResponse } from "next/server";

import { getRequiredUser } from "@/server/auth";
import { badRequest, unauthorized } from "@/server/http";
import { getAllLocations, createLocation, InvalidLocationError } from "@/server/locations";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const locations = await getAllLocations();
  return NextResponse.json({ locations });
}

export async function POST(request: Request) {
  const user = await getRequiredUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as { name?: string; address?: string } | null;

  if (!body?.name || !body?.address) {
    return badRequest("Name and address are required");
  }

  try {
    const location = await createLocation(user.id, { name: body.name, address: body.address });
    return NextResponse.json({ location });
  } catch (error) {
    if (error instanceof InvalidLocationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
