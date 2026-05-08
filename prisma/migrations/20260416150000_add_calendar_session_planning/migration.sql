-- Add user roles.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Extend voting sessions with calendar and planning metadata.
ALTER TABLE "VotingSession" ADD COLUMN "defaultDailyKey" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "localStartTime" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "localEndTime" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "title" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "notes" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "updatedByUserId" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "cancelledAt" DATETIME;

-- Existing sessions were the old implicit daily sessions.
UPDATE "VotingSession" SET "defaultDailyKey" = "localDate" WHERE "defaultDailyKey" IS NULL;

-- The old unique date constraint is too restrictive now that several sessions can happen on one date.
DROP INDEX "VotingSession_localDate_key";
CREATE UNIQUE INDEX "VotingSession_defaultDailyKey_key" ON "VotingSession"("defaultDailyKey");
CREATE INDEX "VotingSession_localDate_localStartTime_idx" ON "VotingSession"("localDate", "localStartTime");
CREATE INDEX "VotingSession_status_idx" ON "VotingSession"("status");

-- Per-session curated game options.
CREATE TABLE "VotingSessionGameOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "votingSessionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "addedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VotingSessionGameOption_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VotingSessionGameOption_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VotingSessionGameOption_votingSessionId_gameId_key" ON "VotingSessionGameOption"("votingSessionId", "gameId");
CREATE INDEX "VotingSessionGameOption_gameId_idx" ON "VotingSessionGameOption"("gameId");
CREATE INDEX "VotingSessionGameOption_addedByUserId_idx" ON "VotingSessionGameOption"("addedByUserId");

-- Per-user favorites and vetoes.
CREATE TABLE "UserGamePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserGamePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGamePreference_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserGamePreference_userId_gameId_key" ON "UserGamePreference"("userId", "gameId");
CREATE INDEX "UserGamePreference_gameId_idx" ON "UserGamePreference"("gameId");
CREATE INDEX "UserGamePreference_preference_idx" ON "UserGamePreference"("preference");
