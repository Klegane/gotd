import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  game: {
    findFirst: vi.fn()
  },
  userGamePreference: {
    count: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import { getVetoCapacity, InvalidPreferenceError, MAX_ACTIVE_VETOES, setGamePreference } from "@/server/preferences";

describe("veto preference limits", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects new vetoes above the active limit", async () => {
    prismaMock.game.findFirst.mockResolvedValue({ id: "game_4" });
    prismaMock.userGamePreference.findUnique.mockResolvedValue(null);
    prismaMock.userGamePreference.count.mockResolvedValue(MAX_ACTIVE_VETOES);

    await expect(setGamePreference("user_1", "game_4", "vetoed")).rejects.toThrow(InvalidPreferenceError);
    expect(prismaMock.userGamePreference.upsert).not.toHaveBeenCalled();
  });

  it("reports veto capacity", async () => {
    prismaMock.userGamePreference.count.mockResolvedValue(2);

    await expect(getVetoCapacity("user_1")).resolves.toEqual({
      used: 2,
      max: MAX_ACTIVE_VETOES,
      remaining: 1
    });
  });
});
