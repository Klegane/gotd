import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  getRequiredUser: vi.fn()
}));

vi.mock("@/server/bgg", () => ({
  enqueueCatalogSync: vi.fn(),
  getCatalogSyncJob: vi.fn()
}));

vi.mock("@/server/catalog-sync-worker", () => ({
  wakeCatalogSyncWorker: vi.fn()
}));

import { GET as GET_STATUS } from "@/app/api/catalog/refresh/[runId]/route";
import { POST } from "@/app/api/catalog/refresh/route";
import { getRequiredUser } from "@/server/auth";
import { enqueueCatalogSync, getCatalogSyncJob } from "@/server/bgg";
import { wakeCatalogSyncWorker } from "@/server/catalog-sync-worker";

const mockedGetRequiredUser = vi.mocked(getRequiredUser);
const mockedEnqueue = vi.mocked(enqueueCatalogSync);
const mockedGetJob = vi.mocked(getCatalogSyncJob);
const mockedWakeWorker = vi.mocked(wakeCatalogSyncWorker);

describe("catalog refresh routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication and admin access", async () => {
    mockedGetRequiredUser.mockResolvedValueOnce(null);
    expect((await POST()).status).toBe(401);

    mockedGetRequiredUser.mockResolvedValueOnce(user("user"));
    expect((await POST()).status).toBe(403);
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues a durable job, wakes the worker, and returns 202", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("admin"));
    mockedEnqueue.mockResolvedValue({ run: queuedRun(), created: true });

    const response = await POST();

    expect(response.status).toBe(202);
    expect(response.headers.get("location")).toBe("/api/catalog/refresh/run_1");
    expect(mockedEnqueue).toHaveBeenCalledWith("user_1");
    expect(mockedWakeWorker).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      run: { id: "run_1", status: "queued" },
      reused: false
    });
  });

  it("returns an existing active job instead of creating a duplicate", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("admin"));
    mockedEnqueue.mockResolvedValue({ run: { ...queuedRun(), status: "running" }, created: false });

    const response = await POST();

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ reused: true });
  });

  it("lets an admin resume status polling by run id", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("admin"));
    mockedGetJob.mockResolvedValue({ ...queuedRun(), status: "success", activeCount: 12 });

    const response = await GET_STATUS(
      new Request("http://localhost/api/catalog/refresh/run_1"),
      { params: Promise.resolve({ runId: "run_1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockedGetJob).toHaveBeenCalledWith("run_1");
    await expect(response.json()).resolves.toMatchObject({
      run: { id: "run_1", status: "success", activeCount: 12 }
    });
  });

  it("does not expose job status to non-admin users", async () => {
    mockedGetRequiredUser.mockResolvedValue(user("user"));

    const response = await GET_STATUS(
      new Request("http://localhost/api/catalog/refresh/run_1"),
      { params: Promise.resolve({ runId: "run_1" }) }
    );

    expect(response.status).toBe(403);
    expect(mockedGetJob).not.toHaveBeenCalled();
  });
});

function user(role: "admin" | "user") {
  return {
    id: "user_1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    role
  };
}

function queuedRun() {
  return {
    id: "run_1",
    sourceUsername: "player",
    status: "queued" as const,
    startedAt: new Date("2026-10-22T12:00:00.000Z"),
    claimedAt: null,
    heartbeatAt: null,
    completedAt: null,
    attemptCount: 0,
    importedCount: 0,
    activeCount: 0,
    detailsRefreshedCount: 0,
    detailFailureCount: 0,
    warnings: [],
    error: null
  };
}
