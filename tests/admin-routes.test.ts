import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/voting", () => ({
  createVotingSession: vi.fn(),
  deleteVotingSession: vi.fn(),
  updateVotingSession: vi.fn(),
  InvalidCurationError: class InvalidCurationError extends Error {},
  InvalidSessionError: class InvalidSessionError extends Error {}
}));

import { DELETE, PATCH } from "@/app/api/admin/sessions/[id]/route";
import { POST } from "@/app/api/admin/sessions/route";
import { getRequiredUser } from "@/server/auth";
import { createVotingSession, deleteVotingSession, InvalidSessionError } from "@/server/voting";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedCreateVotingSession = vi.mocked(createVotingSession);
const mockedDeleteVotingSession = vi.mocked(deleteVotingSession);

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

  it("passes proposal policy through for admin session creation", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "admin_1",
      name: "Grace",
      email: "grace@example.com",
      image: null,
      role: "admin"
    });
    mockedCreateVotingSession.mockResolvedValue({ id: "session_1" } as never);

    const payload = { localDate: "2026-04-18", allowPlayerProposals: false, creatorGameIds: ["game_1"] };
    const response = await POST(jsonRequest(payload));

    expect(response.status).toBe(200);
    expect(mockedCreateVotingSession).toHaveBeenCalledWith("admin_1", payload, true);
  });

  it("rejects non-admin session deletion", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });

    const response = await DELETE(jsonRequest(null), routeContext("session_1"));

    expect(response.status).toBe(403);
    expect(mockedDeleteVotingSession).not.toHaveBeenCalled();
  });

  it("deletes sessions for admins", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "admin_1",
      name: "Grace",
      email: "grace@example.com",
      image: null,
      role: "admin"
    });
    mockedDeleteVotingSession.mockResolvedValue({ id: "session_1" } as never);

    const response = await DELETE(jsonRequest(null), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedDeleteVotingSession).toHaveBeenCalledWith("session_1");
  });

  it("returns bad request when deleting a missing session", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "admin_1",
      name: "Grace",
      email: "grace@example.com",
      image: null,
      role: "admin"
    });
    mockedDeleteVotingSession.mockRejectedValue(new InvalidSessionError("Voting session does not exist"));

    const response = await DELETE(jsonRequest(null), routeContext("missing"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Voting session does not exist");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/sessions", {
    method: body === null ? "DELETE" : "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: body === null ? undefined : JSON.stringify(body)
  });
}

function routeContext(id: string): Parameters<typeof PATCH>[1] {
  return {
    params: Promise.resolve({ id })
  };
}
