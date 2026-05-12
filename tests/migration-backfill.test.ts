import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("add proposals multivote dkp migration", () => {
  it("backfills legacy single votes into ballots and allocations", () => {
    const migration = readFileSync(
      join(process.cwd(), "prisma/migrations/20260509023000_add_proposals_multivote_dkp/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('INSERT INTO "VoteBallot"');
    expect(migration).toContain('INSERT INTO "VoteAllocation"');
    expect(migration).toContain('FROM "Vote"');
    expect(migration).toContain('"voteCount"');
  });
});
