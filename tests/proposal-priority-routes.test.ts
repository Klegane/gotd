import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/voting", () => ({
  castVoteForSession: vi.fn(),
  getVotingSessionState: vi.fn(),
  InvalidPointError: class InvalidPointError extends Error {},
  InvalidProposalError: class InvalidProposalError extends Error {},
  InvalidSessionError: class InvalidSessionError extends Error {},
  InvalidVoteError: class InvalidVoteError extends Error {},
  proposeGameForSession: vi.fn(),
  recordPlayedGameAndSettlePoints: vi.fn(),
  setPointBidForSession: vi.fn(),
  setPriorityProposal: vi.fn(),
  submitBallotForSession: vi.fn()
}));

import { POST as postPriority } from "@/app/api/sessions/[id]/priority/route";
import { POST as postProposal } from "@/app/api/sessions/[id]/proposals/route";
import { POST as postSettlement } from "@/app/api/sessions/[id]/settlement/route";
import { POST as postVote } from "@/app/api/sessions/[id]/vote/route";
import { getRequiredUser } from "@/server/auth";
import {
  castVoteForSession,
  getVotingSessionState,
  proposeGameForSession,
  recordPlayedGameAndSettlePoints,
  setPointBidForSession,
  setPriorityProposal,
  submitBallotForSession
} from "@/server/voting";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedCastVoteForSession = vi.mocked(castVoteForSession);
const mockedGetVotingSessionState = vi.mocked(getVotingSessionState);
const mockedProposeGameForSession = vi.mocked(proposeGameForSession);
const mockedRecordPlayedGameAndSettlePoints = vi.mocked(recordPlayedGameAndSettlePoints);
const mockedSetPointBidForSession = vi.mocked(setPointBidForSession);
const mockedSetPriorityProposal = vi.mocked(setPriorityProposal);
const mockedSubmitBallotForSession = vi.mocked(submitBallotForSession);

describe("proposal, ballot, priority, and settlement routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated proposal requests", async () => {
    mockedGetRequiredUser.mockResolvedValue(null);

    const response = await postProposal(jsonRequest({ gameId: "game_1" }), routeContext("session_1"));

    expect(response.status).toBe(401);
    expect(mockedProposeGameForSession).not.toHaveBeenCalled();
  });

  it("passes proposal payloads through with priority and admin context", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("admin"));
    mockedProposeGameForSession.mockResolvedValue([]);

    const response = await postProposal(jsonRequest({ gameId: "game_1", isPriority: true }), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedProposeGameForSession).toHaveBeenCalledWith("user_1", "session_1", "game_1", true, true);
  });

  it("submits full ballot allocations through the vote route", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("user"));
    mockedSubmitBallotForSession.mockResolvedValue({ ok: true } as never);

    const response = await postVote(
      jsonRequest({ allocations: [{ gameId: "game_1", voteCount: 2 }] }),
      routeContext("session_1")
    );

    expect(response.status).toBe(200);
    expect(mockedSubmitBallotForSession).toHaveBeenCalledWith(
      "user_1",
      "session_1",
      [{ gameId: "game_1", voteCount: 2 }],
      false
    );
    expect(mockedCastVoteForSession).not.toHaveBeenCalled();
  });

  it("keeps legacy single-game vote payloads working", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("user"));
    mockedCastVoteForSession.mockResolvedValue({ ok: true } as never);

    const response = await postVote(jsonRequest({ gameId: "game_1" }), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedCastVoteForSession).toHaveBeenCalledWith("user_1", "session_1", "game_1", false);
  });

  it("uses the priority route for priority selection and point bids", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("admin"));
    mockedSetPriorityProposal.mockResolvedValue([]);
    mockedSetPointBidForSession.mockResolvedValue({ ok: true } as never);

    const priorityResponse = await postPriority(jsonRequest({ gameId: "game_1" }), routeContext("session_1"));
    const bidResponse = await postPriority(jsonRequest({ gameId: "game_1", points: 7 }), routeContext("session_1"));

    expect(priorityResponse.status).toBe(200);
    expect(bidResponse.status).toBe(200);
    expect(mockedSetPriorityProposal).toHaveBeenCalledWith("user_1", "session_1", "game_1");
    expect(mockedSetPointBidForSession).toHaveBeenCalledWith("user_1", "session_1", "game_1", 7, true);
  });

  it("records played games with actor authorization context", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("user"));
    mockedRecordPlayedGameAndSettlePoints.mockResolvedValue({ id: "session_1" } as never);
    mockedGetVotingSessionState.mockResolvedValue({ id: "state_1" } as never);

    const response = await postSettlement(jsonRequest({ playedGameId: "game_1" }), routeContext("session_1"));

    expect(response.status).toBe(200);
    expect(mockedRecordPlayedGameAndSettlePoints).toHaveBeenCalledWith("user_1", "session_1", "game_1", false);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/session_1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function routeContext(id: string): Parameters<typeof postProposal>[1] {
  return {
    params: Promise.resolve({ id })
  };
}

function user(role: "admin" | "user") {
  return {
    id: "user_1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    role
  };
}
