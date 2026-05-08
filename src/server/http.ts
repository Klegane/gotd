import { NextResponse } from "next/server";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function configurationProblem(issues: string[]) {
  return NextResponse.json({ error: "Configuration error", issues }, { status: 503 });
}

export function serverProblem(message = "Unexpected server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
