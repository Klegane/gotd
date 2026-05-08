import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/voting", () => ({
  createVotingSession: vi.fn(),
  InvalidSessionError: class InvalidSessionError extends Error {}
}));

import { POST } from "@/app/api/admin/sessions/route";
import { getRequiredUser } from "@/server/auth";
import { createVotingSession } from "@/server/voting";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedCreateVotingSession = vi.mocked(createVotingSession);

describe("admin session routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated session creation", async () => {
    mockedGetRequiredUser.mockResolvedValue(null);

    const response = await POST(jsonRequest({ localDate: "2026-04-18" }));

    expect(response.status).toBe(401);
    expect(mockedCreateVotingSession).not.toHaveBeenCalled();
  });

  it("rejects non-admin session creation", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });

    const response = await POST(jsonRequest({ localDate: "2026-04-18" }));

    expect(response.status).toBe(403);
    expect(mockedCreateVotingSession).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
