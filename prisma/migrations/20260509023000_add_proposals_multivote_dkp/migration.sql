-- AlterTable
ALTER TABLE "VotingSession" ADD COLUMN "allowPlayerProposals" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VotingSession" ADD COLUMN "proposalsLockedAt" TIMESTAMP(3);
ALTER TABLE "VotingSession" ADD COLUMN "playedGameId" TEXT;
ALTER TABLE "VotingSession" ADD COLUMN "pointsSettledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VotingSessionGameOption" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'creator';

-- CreateTable
CREATE TABLE "VoteBallot" (
    "id" TEXT NOT NULL,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteAllocation" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoteAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionGameProposal" (
    "id" TEXT NOT NULL,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionGameProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointBid" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "votingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityPointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "votingSessionId" TEXT,
    "gameId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorityPointLedger_pkey" PRIMARY KEY ("id")
);

-- Backfill one ballot and one allocation for each legacy single vote.
INSERT INTO "VoteBallot" ("id", "votingSessionId", "userId", "createdAt", "updatedAt")
SELECT 'ballot_' || "id", "votingSessionId", "userId", "createdAt", "updatedAt"
FROM "Vote"
ON CONFLICT DO NOTHING;

INSERT INTO "VoteAllocation" ("id", "ballotId", "gameId", "voteCount", "createdAt", "updatedAt")
SELECT 'allocation_' || "id", 'ballot_' || "id", "gameId", 1, "createdAt", "updatedAt"
FROM "Vote"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "VoteBallot_votingSessionId_userId_key" ON "VoteBallot"("votingSessionId", "userId");
CREATE INDEX "VoteBallot_userId_idx" ON "VoteBallot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteAllocation_ballotId_gameId_key" ON "VoteAllocation"("ballotId", "gameId");
CREATE INDEX "VoteAllocation_gameId_idx" ON "VoteAllocation"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionGameProposal_votingSessionId_userId_gameId_key" ON "SessionGameProposal"("votingSessionId", "userId", "gameId");
CREATE INDEX "SessionGameProposal_votingSessionId_userId_isPriority_idx" ON "SessionGameProposal"("votingSessionId", "userId", "isPriority");
CREATE INDEX "SessionGameProposal_gameId_idx" ON "SessionGameProposal"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "PointBid_ballotId_key" ON "PointBid"("ballotId");
CREATE INDEX "PointBid_votingSessionId_idx" ON "PointBid"("votingSessionId");
CREATE INDEX "PointBid_userId_idx" ON "PointBid"("userId");
CREATE INDEX "PointBid_gameId_idx" ON "PointBid"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "PriorityPointLedger_idempotencyKey_key" ON "PriorityPointLedger"("idempotencyKey");
CREATE INDEX "PriorityPointLedger_userId_createdAt_idx" ON "PriorityPointLedger"("userId", "createdAt");
CREATE INDEX "PriorityPointLedger_votingSessionId_idx" ON "PriorityPointLedger"("votingSessionId");
CREATE INDEX "PriorityPointLedger_gameId_idx" ON "PriorityPointLedger"("gameId");
CREATE INDEX "PriorityPointLedger_reason_idx" ON "PriorityPointLedger"("reason");

-- CreateIndex
CREATE INDEX "VotingSession_playedGameId_idx" ON "VotingSession"("playedGameId");
CREATE INDEX "VotingSessionGameOption_source_idx" ON "VotingSessionGameOption"("source");

-- AddForeignKey
ALTER TABLE "VotingSession" ADD CONSTRAINT "VotingSession_playedGameId_fkey" FOREIGN KEY ("playedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAllocation" ADD CONSTRAINT "VoteAllocation_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "VoteBallot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoteAllocation" ADD CONSTRAINT "VoteAllocation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionGameProposal" ADD CONSTRAINT "SessionGameProposal_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionGameProposal" ADD CONSTRAINT "SessionGameProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionGameProposal" ADD CONSTRAINT "SessionGameProposal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointBid" ADD CONSTRAINT "PointBid_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "VoteBallot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointBid" ADD CONSTRAINT "PointBid_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointBid" ADD CONSTRAINT "PointBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointBid" ADD CONSTRAINT "PointBid_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityPointLedger" ADD CONSTRAINT "PriorityPointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriorityPointLedger" ADD CONSTRAINT "PriorityPointLedger_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "VotingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriorityPointLedger" ADD CONSTRAINT "PriorityPointLedger_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
