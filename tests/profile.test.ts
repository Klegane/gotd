import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import { InvalidProfileError, updateUserProfile } from "@/server/profile";

describe("profile updates", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores normalized nicknames", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({ id: "user_1", nickname: "Ada Lovelace" });

    await updateUserProfile("user_1", { nickname: "  Ada   Lovelace  " });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nickname: "Ada Lovelace",
          normalizedNickname: "ada lovelace"
        }
      })
    );
  });

  it("rejects duplicate nicknames", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user_2" });

    await expect(updateUserProfile("user_1", { nickname: "Ada" })).rejects.toThrow(InvalidProfileError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
