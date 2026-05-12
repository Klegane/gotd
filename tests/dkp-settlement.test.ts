import { afterEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  pointBid: {
    findMany: vi.fn()
  },
  priorityPointLedger: {
    upsert: vi.fn()
  },
  sessionGameProposal: {
    findMany: vi.fn()
  },
  votingSession: {
    update: vi.fn()
  }
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
  game: {
    findMany: vi.fn()
  },
  pointBid: {
    aggregate: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn()
  },
  priorityPointLedger: {
    aggregate: vi.fn()
  },
  sessionGameProposal: {
    findFirst: vi.fn()
  },
  voteBallot: {
    upsert: vi.fn()
  },
  votingSession: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  votingSessionGameOption: {
    findMany: vi.fn()
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import { InvalidPointError, recordPlayedGameAndSettlePoints, setPointBidForSession } from "@/server/voting";

describe("DKP settlement", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("awards unplayed priority proposals and spends or partially loses bids", async () => {
    prismaMock.votingSession.findUnique.mockResolvedValue({
      id: "session_1",
      createdByUserId: "creator_1",
      pointsSettledAt: null
    });
    prismaMock.votingSessionGameOption.findMany.mockResolvedValue([{ gameId: "played" }, { gameId: "lost" }]);
    txMock.sessionGameProposal.findMany.mockResolvedValue([
      { id: "proposal_played", userId: "user_played", gameId: "played" },
      { id: "proposal_lost", userId: "user_lost", gameId: "lost" }
    ]);
    txMock.pointBid.findMany.mockResolvedValue([
      { id: "bid_played", userId: "user_played", gameId: "played", points: 8 },
      { id: "bid_lost", userId: "user_lost", gameId: "lost", points: 5 }
    ]);
    txMock.votingSession.update.mockResolvedValue({ id: "session_1", status: "closed" });

    await recordPlayedGameAndSettlePoints("creator_1", "session_1", "played", false);

    expect(txMock.priorityPointLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_lost",
          gameId: "lost",
          amount: 2,
          reason: "proposal_not_played"
        })
      })
    );
    expect(txMock.priorityPointLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_played",
          gameId: "played",
          amount: -8,
          reason: "bid_spent_played"
        })
      })
    );
    expect(txMock.priorityPointLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_lost",
          gameId: "lost",
          amount: -3,
          reason: "bid_partial_loss_not_played"
        })
      })
    );
    expect(txMock.votingSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: expect.objectContaining({
        playedGameId: "played",
        status: "closed",
        updatedByUserId: "creator_1"
      })
    });
  });

  it("does not create duplicate ledger entries when settlement already exists", async () => {
    prismaMock.votingSession.findUnique.mockResolvedValue({
      id: "session_1",
      createdByUserId: "creator_1",
      pointsSettledAt: new Date("2026-05-09T10:00:00.000Z")
    });
    prismaMock.votingSessionGameOption.findMany.mockResolvedValue([{ gameId: "played" }]);
    prismaMock.votingSession.update.mockResolvedValue({ id: "session_1", playedGameId: "played" });

    await recordPlayedGameAndSettlePoints("creator_1", "session_1", "played", false);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.priorityPointLedger.upsert).not.toHaveBeenCalled();
    expect(prismaMock.votingSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { playedGameId: "played" }
    });
  });

  it("rejects point bids above the available balance before mutating bid rows", async () => {
    prismaMock.votingSession.findUnique.mockResolvedValue({ id: "session_1", status: "open" });
    prismaMock.sessionGameProposal.findFirst.mockResolvedValue({ id: "proposal_1" });
    prismaMock.voteBallot.upsert.mockResolvedValue({ id: "ballot_1" });
    prismaMock.priorityPointLedger.aggregate.mockResolvedValue({ _sum: { amount: 3 } });
    prismaMock.pointBid.aggregate.mockResolvedValue({ _sum: { points: 1 } });

    await expect(setPointBidForSession("user_1", "session_1", "game_1", 5, false)).rejects.toThrow(InvalidPointError);

    expect(prismaMock.pointBid.upsert).not.toHaveBeenCalled();
    expect(prismaMock.pointBid.deleteMany).not.toHaveBeenCalled();
  });
});
