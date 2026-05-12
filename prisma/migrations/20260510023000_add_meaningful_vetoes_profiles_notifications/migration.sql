-- AlterTable
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "normalizedNickname" TEXT;

-- CreateTable
CREATE TABLE "VotingSessionParticipant" (
    "id" TEXT NOT NULL,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "attendanceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VotingSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingSessionVetoSnapshot" (
    "id" TEXT NOT NULL,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingSessionVetoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "actorUserId" TEXT,
    "votingSessionId" TEXT,
    "sessionMessageId" TEXT,
    "ledgerEntryId" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- Backfill historical participation from existing ballots.
INSERT INTO "VotingSessionParticipant" ("id", "votingSessionId", "userId", "status", "invitedAt", "respondedAt", "attendanceUpdatedAt", "createdAt", "updatedAt")
SELECT 'participant_' || "id", "votingSessionId", "userId", 'attended', "createdAt", "createdAt", "updatedAt", "createdAt", "updatedAt"
FROM "VoteBallot"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "User_normalizedNickname_key" ON "User"("normalizedNickname");

-- CreateIndex
CREATE UNIQUE INDEX "VotingSessionParticipant_votingSessionId_userId_key" ON "VotingSessionParticipant"("votingSessionId", "userId");
CREATE INDEX "VotingSessionParticipant_userId_status_idx" ON "VotingSessionParticipant"("userId", "status");
CREATE INDEX "VotingSessionParticipant_votingSessionId_status_idx" ON "VotingSessionParticipant"("votingSessionId", "status");
CREATE INDEX "VotingSessionParticipant_invitedByUserId_idx" ON "VotingSessionParticipant"("invitedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VotingSessionVetoSnapshot_votingSessionId_userId_gameId_key" ON "VotingSessionVetoSnapshot"("votingSessionId", "userId", "gameId");
CREATE INDEX "VotingSessionVetoSnapshot_votingSessionId_gameId_idx" ON "VotingSessionVetoSnapshot"("votingSessionId", "gameId");
CREATE INDEX "VotingSessionVetoSnapshot_userId_idx" ON "VotingSessionVetoSnapshot"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_createdAt_idx" ON "UserNotification"("userId", "readAt", "createdAt");
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");
CREATE INDEX "UserNotification_votingSessionId_idx" ON "UserNotification"("votingSessionId");
CREATE INDEX "UserNotification_sessionMessageId_idx" ON "UserNotification"("sessionMessageId");
CREATE INDEX "UserNotification_ledgerEntryId_idx" ON "UserNotification"("ledgerEntryId");
CREATE INDEX "UserNotification_dedupeKey_idx" ON "UserNotification"("dedupeKey");

-- AddForeignKey
ALTER TABLE "VotingSessionParticipant" ADD CONSTRAINT "VotingSessionParticipant_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotingSessionParticipant" ADD CONSTRAINT "VotingSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotingSessionParticipant" ADD CONSTRAINT "VotingSessionParticipant_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingSessionVetoSnapshot" ADD CONSTRAINT "VotingSessionVetoSnapshot_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotingSessionVetoSnapshot" ADD CONSTRAINT "VotingSessionVetoSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotingSessionVetoSnapshot" ADD CONSTRAINT "VotingSessionVetoSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_sessionMessageId_fkey" FOREIGN KEY ("sessionMessageId") REFERENCES "SessionMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "PriorityPointLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
