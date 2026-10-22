import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("durable catalog sync migration", () => {
  it("adds leases and a cross-instance active-job constraint", () => {
    const migration = readFileSync(
      join(process.cwd(), "prisma/migrations/20261022000100_add_durable_catalog_sync_queue/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('"heartbeatAt"');
    expect(migration).toContain('"workerId"');
    expect(migration).toContain('"attemptCount"');
    expect(migration).toContain('"CatalogSyncRun_one_active_idx"');
    expect(migration).toContain('WHERE "status" IN');
  });
});
