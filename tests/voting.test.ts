import { describe, expect, it, vi } from "vitest";

import {
  CLOSED_PROPOSAL_MISSING_OPTION_COST,
  getAvailablePriorityPoints,
  getBallotLimits,
  getBlockedCuratedGameRemovals,
  getClosedProposalControlCost,
  getDefaultSessionTitle,
  getLocalDateForTimeZone,
  getPartialBidLoss,
  getPriorityPointBalance,
  InvalidSessionError,
  InvalidVoteError,
  isSessionVisibleToUser,
  isValidLocalDate,
  isValidLocalTime,
  isVotableStatus,
  summarizeScoredVoteRows,
  summarizeVoteRows,
  validateBallotAllocations,
  validateSessionMutationInput
} from "@/server/voting";

describe("daily voting helpers", () => {
  it("derives the configured local date", () => {
    const date = new Date("2026-04-16T22:30:00.000Z");

    expect(getLocalDateForTimeZone(date, "Europe/Madrid")).toBe("2026-04-17");
  });

  it("counts votes and selects a single leader", () => {
    const results = summarizeVoteRows([
      { gameId: "a", gameName: "Azul", thumbnailUrl: null },
      { gameId: "b", gameName: "Catan", thumbnailUrl: null },
      { gameId: "a", gameName: "Azul", thumbnailUrl: null }
    ]);

    expect(results.totalVotes).toBe(3);
    expect(results.leaders).toEqual([
      { gameId: "a", gameName: "Azul", thumbnailUrl: null, votes: 2, normalVotes: 2, bidPoints: 0, vetoCount: 0, vetoPenalty: 0, score: 2 }
    ]);
  });

  it("keeps tied games when totals match", () => {
    const results = summarizeVoteRows([
      { gameId: "a", gameName: "Azul", thumbnailUrl: null },
      { gameId: "b", gameName: "Catan", thumbnailUrl: null }
    ]);

    expect(results.totalVotes).toBe(2);
    expect(results.leaders.map((leader) => leader.gameName)).toEqual(["Azul", "Catan"]);
  });

  it("does not choose a winner when no votes exist", () => {
    const results = summarizeVoteRows([]);

    expect(results.totalVotes).toBe(0);
    expect(results.totalNormalVotes).toBe(0);
    expect(results.totalBidPoints).toBe(0);
    expect(results.totalVetoPenalty).toBe(0);
    expect(results.leaders).toEqual([]);
    expect(results.items).toEqual([]);
  });

  it("calculates ballot limits for small and larger game pools", () => {
    expect(getBallotLimits(3)).toMatchObject({
      eligibleGameCount: 3,
      maxTotalVotes: 1,
      maxDistinctGames: 1,
      allowRepeatedVotes: false
    });
    expect(getBallotLimits(5)).toMatchObject({
      eligibleGameCount: 5,
      maxTotalVotes: 4,
      maxDistinctGames: 4,
      allowRepeatedVotes: true
    });
  });

  it("validates repeated votes and merges duplicate allocations", () => {
    expect(validateBallotAllocations([{ gameId: "a", voteCount: 3 }], ["a", "b", "c", "d"])).toEqual([
      { gameId: "a", voteCount: 3 }
    ]);
    expect(
      validateBallotAllocations(
        [
          { gameId: "a", voteCount: 1 },
          { gameId: "a", voteCount: 2 }
        ],
        ["a", "b", "c", "d"]
      )
    ).toEqual([{ gameId: "a", voteCount: 3 }]);
  });

  it("rejects over-capacity ballots and ballots for all larger-session games", () => {
    expect(() => validateBallotAllocations([{ gameId: "a", voteCount: 5 }], ["a", "b", "c", "d"])).toThrow(InvalidVoteError);
    expect(() =>
      validateBallotAllocations(
        [
          { gameId: "a", voteCount: 1 },
          { gameId: "b", voteCount: 1 },
          { gameId: "c", voteCount: 1 },
          { gameId: "d", voteCount: 1 }
        ],
        ["a", "b", "c", "d"]
      )
    ).toThrow(InvalidVoteError);
  });

  it("combines normal votes and point bids into score leaders", () => {
    const results = summarizeScoredVoteRows(
      [
        { gameId: "a", gameName: "Azul", thumbnailUrl: null, voteCount: 2 },
        { gameId: "b", gameName: "Catan", thumbnailUrl: null, voteCount: 1 }
      ],
      [{ gameId: "b", gameName: "Catan", thumbnailUrl: null, points: 3 }]
    );

    expect(results.totalVotes).toBe(6);
    expect(results.totalNormalVotes).toBe(3);
    expect(results.totalBidPoints).toBe(3);
    expect(results.leaders).toEqual([
      { gameId: "b", gameName: "Catan", thumbnailUrl: null, votes: 4, normalVotes: 1, bidPoints: 3, vetoCount: 0, vetoPenalty: 0, score: 4 }
    ]);
  });

  it("applies veto penalties and uses veto count as tie protection", () => {
    const results = summarizeScoredVoteRows(
      [
        { gameId: "a", gameName: "Azul", thumbnailUrl: null, voteCount: 5 },
        { gameId: "b", gameName: "Catan", thumbnailUrl: null, voteCount: 3 }
      ],
      [],
      [{ gameId: "a", gameName: "Azul", thumbnailUrl: null }]
    );

    expect(results.totalVetoPenalty).toBe(2);
    expect(results.items[0]).toMatchObject({ gameId: "b", score: 3, vetoCount: 0 });
    expect(results.items[1]).toMatchObject({ gameId: "a", score: 3, vetoCount: 1, vetoPenalty: 2 });
    expect(results.leaders.map((leader) => leader.gameId)).toEqual(["b"]);
  });

  it("calculates closed-proposal control costs", () => {
    expect(CLOSED_PROPOSAL_MISSING_OPTION_COST).toBe(2);
    expect(getClosedProposalControlCost(true, 0)).toBe(0);
    expect(getClosedProposalControlCost(false, 0)).toBe(6);
    expect(getClosedProposalControlCost(false, 2)).toBe(2);
    expect(getClosedProposalControlCost(false, 3)).toBe(0);
  });

  it("calculates point balances, reservations, and partial bid loss", async () => {
    const db = {
      priorityPointLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 10 } })
      },
      pointBid: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { points: 4 } })
      }
    };

    await expect(getPriorityPointBalance("user_1", db as never)).resolves.toBe(10);
    await expect(getAvailablePriorityPoints("user_1", "ballot_1", db as never)).resolves.toBe(6);
    expect(getPartialBidLoss(5)).toBe(3);
    expect(db.pointBid.aggregate).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        NOT: { ballotId: "ballot_1" },
        votingSession: {
          pointsSettledAt: null,
          NOT: { status: "cancelled" }
        }
      },
      _sum: { points: true }
    });
  });

  it("validates session calendar dates and times", () => {
    expect(isValidLocalDate("2026-04-16")).toBe(true);
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalTime("19:30")).toBe(true);
    expect(isValidLocalTime("24:00")).toBe(false);
  });

  it("keeps draft sessions hidden from normal users", () => {
    expect(isSessionVisibleToUser("draft", false)).toBe(false);
    expect(isSessionVisibleToUser("draft", true)).toBe(true);
    expect(isSessionVisibleToUser("open", false)).toBe(true);
    expect(isVotableStatus("open")).toBe(true);
    expect(isVotableStatus("closed")).toBe(false);
  });

  it("normalizes scheduled session input", () => {
    expect(
      validateSessionMutationInput(
        {
          localDate: "2026-04-18",
          localStartTime: "20:00",
          localEndTime: "",
          title: "  Heavy games  ",
          notes: "  Bring snacks  ",
          status: "open"
        },
        true
      )
    ).toEqual({
      localDate: "2026-04-18",
      localStartTime: "20:00",
      localEndTime: null,
      title: "Heavy games",
      notes: "Bring snacks",
      status: "open",
      allowPlayerProposals: undefined,
      creatorGameIds: [],
      invitedUserIds: []
    });

    expect(() => validateSessionMutationInput({ localDate: "tomorrow" }, true)).toThrow(InvalidSessionError);
  });

  it("uses a default title for daily sessions", () => {
    expect(getDefaultSessionTitle({ title: null, localDate: "2026-04-16" })).toBe("Jueves 16 de abril de 2026");
    expect(getDefaultSessionTitle({ title: "Friday night", localDate: "2026-04-16" })).toBe("Friday night");
  });

  it("blocks curated option removals when existing votes would be affected", () => {
    expect(getBlockedCuratedGameRemovals(["a", "b", "c"], ["a", "c"], ["b"])).toEqual(["b"]);
    expect(getBlockedCuratedGameRemovals(["a", "b"], ["a"], ["c"])).toEqual([]);
  });
});
