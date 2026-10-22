import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/bgg", () => ({
  claimNextCatalogSyncRun: vi.fn(),
  executeCatalogSyncRun: vi.fn(),
  heartbeatCatalogSyncRun: vi.fn()
}));

import {
  claimNextCatalogSyncRun,
  executeCatalogSyncRun,
  heartbeatCatalogSyncRun
} from "@/server/bgg";
import { runCatalogSyncWorkerOnce } from "@/server/catalog-sync-worker";

const mockedClaim = vi.mocked(claimNextCatalogSyncRun);
const mockedExecute = vi.mocked(executeCatalogSyncRun);
const mockedHeartbeat = vi.mocked(heartbeatCatalogSyncRun);

describe("durable catalog sync worker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("stays idle when no queued or expired job can be claimed", async () => {
    mockedClaim.mockResolvedValue(null);

    await expect(runCatalogSyncWorkerOnce("worker_1")).resolves.toBe(false);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("executes a claimed job with the same worker lease", async () => {
    mockedClaim.mockResolvedValue("run_1");
    mockedExecute.mockResolvedValue({} as never);

    await expect(runCatalogSyncWorkerOnce("worker_1")).resolves.toBe(true);
    expect(mockedExecute).toHaveBeenCalledWith("run_1", "worker_1");
  });

  it("renews the lease while a long-running job is active", async () => {
    vi.useFakeTimers();
    mockedClaim.mockResolvedValue("run_1");
    mockedHeartbeat.mockResolvedValue(true);
    let finish: (() => void) | undefined;
    mockedExecute.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({} as never);
        })
    );

    const running = runCatalogSyncWorkerOnce("worker_1");
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockedHeartbeat).toHaveBeenCalledWith("run_1", "worker_1");
    finish?.();
    await expect(running).resolves.toBe(true);
  });
});
