import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/voting", () => ({
  ForbiddenCurationError: class ForbiddenCurationError extends Error {},
  InvalidCurationError: class InvalidCurationError extends Error {},
  setCuratedGameOptions: vi.fn()
}));

import { PUT } from "@/app/api/admin/sessions/[id]/games/route";
import { getRequiredUser } from "@/server/auth";
import { ForbiddenCurationError, setCuratedGameOptions } from "@/server/voting";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedSetCuratedGameOptions = vi.mocked(setCuratedGameOptions);

describe("session game curation route", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockedGetRequiredUser.mockResolvedValue(null);

    const response = await PUT(jsonRequest({ gameIds: ["game_1"] }), routeContext("session_1"));

    expect(response.status).toBe(401);
    expect(mockedSetCuratedGameOptions).not.toHaveBeenCalled();
  });

  it("allows non-admin users to request curation when the service authorizes them", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });
    mockedSetCuratedGameOptions.mockResolvedValue(["game_1"]);

    const response = await PUT(jsonRequest({ gameIds: ["game_1"] }), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedSetCuratedGameOptions).toHaveBeenCalledWith("user_1", "session_1", ["game_1"], false);
  });

  it("passes the admin flag through to the curation service", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "admin_1",
      name: "Grace",
      email: "grace@example.com",
      image: null,
      role: "admin"
    });
    mockedSetCuratedGameOptions.mockResolvedValue(["game_1"]);

    const response = await PUT(jsonRequest({ gameIds: ["game_1"] }), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedSetCuratedGameOptions).toHaveBeenCalledWith("admin_1", "session_1", ["game_1"], true);
  });

  it("returns forbidden when the user cannot curate that session", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });
    mockedSetCuratedGameOptions.mockRejectedValue(new ForbiddenCurationError("Only admins and the session creator can curate games"));

    const response = await PUT(jsonRequest({ gameIds: ["game_1"] }), routeContext("session_1"));

    expect(response.status).toBe(403);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/sessions/session_1/games", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function routeContext(id: string): Parameters<typeof PUT>[1] {
  return {
    params: Promise.resolve({ id })
  };
}
