import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/bgg", () => ({
  syncBoardGameGeekCatalog: vi.fn()
}));

import { POST } from "@/app/api/catalog/refresh/route";
import { getRequiredUser } from "@/server/auth";
import { syncBoardGameGeekCatalog } from "@/server/bgg";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedSync = vi.mocked(syncBoardGameGeekCatalog);

describe("catalog refresh route", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication", async () => {
    mockedGetRequiredUser.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it("requires an admin user", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      image: null,
      role: "user"
    });

    const response = await POST();

    expect(response.status).toBe(403);
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it("returns the complete sync result to admins", async () => {
    mockedGetRequiredUser.mockResolvedValue({
      id: "admin_1",
      name: "Grace",
      email: "grace@example.com",
      image: null,
      role: "admin"
    });
    mockedSync.mockResolvedValue({
      status: "partial",
      importedCount: 10,
      activeCount: 10,
      runId: "run_1",
      detailsRefreshedCount: 8,
      detailFailureCount: 2,
      warnings: ["Two detail records could not be refreshed"]
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "partial",
      activeCount: 10,
      detailFailureCount: 2
    });
  });
});
