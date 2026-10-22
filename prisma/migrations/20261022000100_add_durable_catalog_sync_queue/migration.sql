-- Existing pending runs belonged to request-scoped synchronization and cannot
-- be resumed safely. Mark them as failed before enabling the durable queue.
UPDATE "CatalogSyncRun"
SET
    "status" = 'failed',
    "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
    "error" = COALESCE("error", 'Interrupted before durable catalog queue migration')
WHERE "status" = 'pending';

ALTER TABLE "CatalogSyncRun"
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "workerId" TEXT,
ADD COLUMN "requestedByUserId" TEXT,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "detailsRefreshedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "detailFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "warningsJson" TEXT;

CREATE INDEX "CatalogSyncRun_status_heartbeatAt_idx"
ON "CatalogSyncRun"("status", "heartbeatAt");

-- Only one queued/running refresh may exist, even with multiple app instances.
CREATE UNIQUE INDEX "CatalogSyncRun_one_active_idx"
ON "CatalogSyncRun" ((1))
WHERE "status" IN ('queued', 'running');
