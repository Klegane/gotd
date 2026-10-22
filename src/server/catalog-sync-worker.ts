import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import {
  claimNextCatalogSyncRun,
  executeCatalogSyncRun,
  heartbeatCatalogSyncRun
} from "@/server/bgg";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

type CatalogWorkerState = {
  workerId: string;
  timer: ReturnType<typeof setInterval> | null;
  running: Promise<void> | null;
};

const workerGlobal = globalThis as typeof globalThis & {
  __catalogSyncWorkerState?: CatalogWorkerState;
};

function getWorkerState(): CatalogWorkerState {
  workerGlobal.__catalogSyncWorkerState ??= {
    workerId: [hostname(), process.pid, randomUUID()].join(":"),
    timer: null,
    running: null
  };

  return workerGlobal.__catalogSyncWorkerState;
}

export function startCatalogSyncWorker(): void {
  if (process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const state = getWorkerState();

  if (!state.timer) {
    state.timer = setInterval(() => {
      triggerCatalogSyncWorker();
    }, POLL_INTERVAL_MS);
    state.timer.unref();
  }

  triggerCatalogSyncWorker();
}

export function wakeCatalogSyncWorker(): void {
  startCatalogSyncWorker();
}

export async function runCatalogSyncWorkerOnce(workerId = getWorkerState().workerId): Promise<boolean> {
  const runId = await claimNextCatalogSyncRun(workerId);

  if (!runId) {
    return false;
  }

  let heartbeatInFlight = false;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight) {
      return;
    }

    heartbeatInFlight = true;
    void heartbeatCatalogSyncRun(runId, workerId)
      .catch((error) => {
        console.error("Catalog sync heartbeat failed", error);
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  try {
    await executeCatalogSyncRun(runId, workerId);
  } finally {
    clearInterval(heartbeatTimer);
  }

  return true;
}

function triggerCatalogSyncWorker(): void {
  const state = getWorkerState();

  if (state.running) {
    return;
  }

  state.running = drainCatalogSyncQueue(state.workerId)
    .catch((error) => {
      console.error("Catalog sync worker failed", error);
    })
    .finally(() => {
      state.running = null;
    });
}

async function drainCatalogSyncQueue(workerId: string): Promise<void> {
  while (await runCatalogSyncWorkerOnce(workerId)) {
    // Drain every available job before returning to the polling interval.
  }
}
