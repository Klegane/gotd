import { describe, expect, it, vi } from "vitest";

import { freezeUserVetoesForSession } from "@/server/voting";

describe("veto snapshots", () => {
  it("captures current vetoes once for a session", async () => {
    const db = {
      votingSessionVetoSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        createMany: vi.fn()
      },
      userGamePreference: {
        findMany: vi.fn().mockResolvedValue([{ gameId: "game_a" }, { gameId: "game_b" }])
      }
    };

    await freezeUserVetoesForSession("user_1", "session_1", "first_ballot", db as never);

    expect(db.votingSessionVetoSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        { votingSessionId: "session_1", userId: "user_1", gameId: "game_a", source: "first_ballot" },
        { votingSessionId: "session_1", userId: "user_1", gameId: "game_b", source: "first_ballot" }
      ],
      skipDuplicates: true
    });
  });

  it("does not rebuild existing snapshots", async () => {
    const db = {
      votingSessionVetoSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "snapshot_1" }),
        createMany: vi.fn()
      },
      userGamePreference: {
        findMany: vi.fn()
      }
    };

    await freezeUserVetoesForSession("user_1", "session_1", "first_ballot", db as never);

    expect(db.userGamePreference.findMany).not.toHaveBeenCalled();
    expect(db.votingSessionVetoSnapshot.createMany).not.toHaveBeenCalled();
  });
});
