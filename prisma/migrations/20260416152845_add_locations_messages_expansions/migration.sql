-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessage_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bggId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "yearPublished" INTEGER,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "playingTime" INTEGER,
    "averageWeight" REAL,
    "metadataJson" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isExpansion" BOOLEAN NOT NULL DEFAULT false,
    "parentGameId" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_parentGameId_fkey" FOREIGN KEY ("parentGameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("active", "averageWeight", "bggId", "id", "imageUrl", "importedAt", "maxPlayers", "metadataJson", "minPlayers", "name", "playingTime", "thumbnailUrl", "updatedAt", "yearPublished") SELECT "active", "averageWeight", "bggId", "id", "imageUrl", "importedAt", "maxPlayers", "metadataJson", "minPlayers", "name", "playingTime", "thumbnailUrl", "updatedAt", "yearPublished" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_bggId_key" ON "Game"("bggId");
CREATE INDEX "Game_active_name_idx" ON "Game"("active", "name");
CREATE INDEX "Game_parentGameId_idx" ON "Game"("parentGameId");
CREATE TABLE "new_VotingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localDate" TEXT NOT NULL,
    "defaultDailyKey" TEXT,
    "localStartTime" TEXT,
    "localEndTime" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "locationId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VotingSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VotingSession" ("cancelledAt", "createdAt", "createdByUserId", "defaultDailyKey", "id", "localDate", "localEndTime", "localStartTime", "notes", "status", "title", "updatedAt", "updatedByUserId") SELECT "cancelledAt", "createdAt", "createdByUserId", "defaultDailyKey", "id", "localDate", "localEndTime", "localStartTime", "notes", "status", "title", "updatedAt", "updatedByUserId" FROM "VotingSession";
DROP TABLE "VotingSession";
ALTER TABLE "new_VotingSession" RENAME TO "VotingSession";
CREATE UNIQUE INDEX "VotingSession_defaultDailyKey_key" ON "VotingSession"("defaultDailyKey");
CREATE INDEX "VotingSession_localDate_localStartTime_idx" ON "VotingSession"("localDate", "localStartTime");
CREATE INDEX "VotingSession_status_idx" ON "VotingSession"("status");
CREATE INDEX "VotingSession_locationId_idx" ON "VotingSession"("locationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Location_name_idx" ON "Location"("name");

-- CreateIndex
CREATE INDEX "SessionMessage_votingSessionId_createdAt_idx" ON "SessionMessage"("votingSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionMessage_userId_idx" ON "SessionMessage"("userId");
