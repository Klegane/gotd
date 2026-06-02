import { afterEach, describe, expect, it, vi } from "vitest";

const { getRequiredUserMock } = vi.hoisted(() => ({
  getRequiredUserMock: vi.fn()
}));

vi.mock("@/server/auth", () => ({
  getRequiredUser: () => getRequiredUserMock()
}));

vi.mock("@/server/env", () => ({
  getServerEnv: () => ({ APP_TIMEZONE: "Europe/Madrid" })
}));

vi.mock("@/server/voting", () => ({
  getLocalDateForTimeZone: () => "2026-06-02"
}));

import { POST } from "@/app/api/chatbot/route";

describe("chatbot route", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated chatbot requests", async () => {
    getRequiredUserMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ message: "hola" }));

    expect(response.status).toBe(401);
  });

  it("returns assistant actions for authenticated users", async () => {
    getRequiredUserMock.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });

    const response = await POST(jsonRequest({ message: "crea una sesion manana a las 20" }));
    const body = (await response.json()) as { actions: Array<{ type: string; payload?: { localDate: string } }> };

    expect(response.status).toBe(200);
    expect(body.actions.some((action) => action.type === "create-session" && action.payload?.localDate === "2026-06-03")).toBe(true);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/chatbot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
