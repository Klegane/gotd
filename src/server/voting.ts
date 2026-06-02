import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";
import {
  activeParticipantStatuses,
  canManageSession,
  ensureBallotParticipant,
  getSessionParticipants,
  inviteUsersToSession,
  notifyActiveParticipants
} from "@/server/participants";
import { addPreferencesToGames, type PreferenceState } from "@/server/preferences";
import { createNotification } from "@/server/notifications";
import { displayNameForUser } from "@/server/users";

export const sessionStatuses = ["draft", "open", "closed", "cancelled"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const UNPLAYED_PROPOSAL_POINTS = 2;
export const CLOSED_PROPOSAL_MISSING_OPTION_COST = 2;
export const VETO_PENALTY_POINTS = 2;

type DbClient = PrismaClient | Prisma.TransactionClient;

export class InvalidVoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVoteError";
  }
}

export class InvalidSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionError";
  }
}

export class InvalidCurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCurationError";
  }
}

export class ForbiddenCurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenCurationError";
  }
}

export class InvalidProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProposalError";
  }
}

export class InvalidPointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPointError";
  }
}

export type VoteResultRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  votes: number;
  normalVotes: number;
  bidPoints: number;
  vetoCount: number;
  vetoPenalty: number;
  score: number;
};

export type VoteResults = {
  totalVotes: number;
  totalNormalVotes: number;
  totalBidPoints: number;
  totalVetoPenalty: number;
  leaders: VoteResultRow[];
  items: VoteResultRow[];
};

export type BallotAllocationInput = {
  gameId: string;
  voteCount: number;
};

export type BallotLimits = {
  eligibleGameCount: number;
  maxTotalVotes: number;
  maxVotes: number;
  maxDistinctGames: number;
  allowRepeatedVotes: boolean;
  canMultiVote: boolean;
};

export type SessionMutationInput = {
  localDate?: string;
  localStartTime?: string | null;
  localEndTime?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: SessionStatus;
  locationId?: string | null;
  allowPlayerProposals?: boolean;
  creatorGameIds?: string[];
  invitedUserIds?: string[];
};

type VoteRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  voteCount?: number;
};

type BidRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  points: number;
};

type VetoRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  vetoCount?: number;
};

type SessionWithBallots = {
  id: string;
  localDate: string;
  defaultDailyKey: string | null;
  localStartTime: string | null;
  localEndTime: string | null;
  title: string | null;
  notes: string | null;
  status: string;
  allowPlayerProposals: boolean;
  proposalsLockedAt: Date | null;
  playedGameId: string | null;
  pointsSettledAt: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  location?: {
    id: string;
    name: string;
    address: string;
  } | null;
  voteBallots: Array<{
    userId: string;
    allocations: Array<{
      gameId: string;
      voteCount: number;
      game: {
        id: string;
        name: string;
        thumbnailUrl: string | null;
      };
    }>;
    pointBid: {
      gameId: string;
      points: number;
      game: {
        id: string;
        name: string;
        thumbnailUrl: string | null;
      };
    } | null;
  }>;
  vetoSnapshots?: Array<{
    gameId: string;
    game: {
      name: string;
      thumbnailUrl: string | null;
    };
  }>;
};

export function getLocalDateForTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive local date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === "string" && sessionStatuses.includes(value as SessionStatus);
}

export function isVotableStatus(status: string): boolean {
  return status === "open";
}

export function isSessionVisibleToUser(status: string, isAdmin: boolean): boolean {
  return isAdmin || status !== "draft";
}

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function shiftLocalDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getDefaultSessionTitle(session: { title: string | null; localDate: string; defaultDailyKey?: string | null }): string {
  return session.title?.trim() || formatSessionTitleDateSpanish(session.localDate);
}

function formatSessionTitleDateSpanish(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00`);
  const formatted = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const withoutComma = formatted.replace(",", "");
  return withoutComma.charAt(0).toUpperCase() + withoutComma.slice(1);
}

export function validateSessionMutationInput(input: SessionMutationInput, requireDate: boolean): SessionMutationInput {
  if (requireDate && !input.localDate) {
    throw new InvalidSessionError("localDate is required");
  }

  if (input.localDate && !isValidLocalDate(input.localDate)) {
    throw new InvalidSessionError("localDate must use YYYY-MM-DD");
  }

  if (input.localStartTime && !isValidLocalTime(input.localStartTime)) {
    throw new InvalidSessionError("localStartTime must use HH:mm");
  }

  if (input.localEndTime && !isValidLocalTime(input.localEndTime)) {
    throw new InvalidSessionError("localEndTime must use HH:mm");
  }

  if (input.status && !isSessionStatus(input.status)) {
    throw new InvalidSessionError("status must be draft, open, closed, or cancelled");
  }

  if (input.creatorGameIds !== undefined && !Array.isArray(input.creatorGameIds)) {
    throw new InvalidSessionError("creatorGameIds must be an array of game ids");
  }

  if (input.invitedUserIds !== undefined && !Array.isArray(input.invitedUserIds)) {
    throw new InvalidSessionError("invitedUserIds must be an array of user ids");
  }

  return {
    ...input,
    title: normalizeOptionalText(input.title),
    notes: normalizeOptionalText(input.notes),
    localStartTime: normalizeOptionalText(input.localStartTime),
    localEndTime: normalizeOptionalText(input.localEndTime),
    allowPlayerProposals: input.allowPlayerProposals,
    creatorGameIds: normalizeGameIds(input.creatorGameIds),
    invitedUserIds: normalizeIds(input.invitedUserIds)
  };
}

export function getBlockedCuratedGameRemovals(
  currentGameIds: string[],
  targetGameIds: string[],
  votedGameIds: string[]
): string[] {
  const target = new Set(targetGameIds);
  const voted = new Set(votedGameIds);
  return currentGameIds.filter((gameId) => !target.has(gameId) && voted.has(gameId));
}

export function getBallotLimits(eligibleGameCount: number): BallotLimits {
  const maxTotalVotes = eligibleGameCount <= 3 ? 1 : Math.max(1, eligibleGameCount - 1);

  return {
    eligibleGameCount,
    maxTotalVotes,
    maxVotes: maxTotalVotes,
    maxDistinctGames: maxTotalVotes,
    allowRepeatedVotes: eligibleGameCount > 3,
    canMultiVote: eligibleGameCount > 3
  };
}

export function getClosedProposalControlCost(allowPlayerProposals: boolean, creatorOptionCount: number): number {
  if (allowPlayerProposals || creatorOptionCount >= 3) {
    return 0;
  }

  return (3 - creatorOptionCount) * CLOSED_PROPOSAL_MISSING_OPTION_COST;
}

export function getPartialBidLoss(points: number): number {
  return Math.ceil(points / 2);
}

export async function getPriorityPointBalance(userId: string, db: DbClient = prisma): Promise<number> {
  const aggregate = await db.priorityPointLedger.aggregate({
    where: { userId },
    _sum: { amount: true }
  });

  return aggregate._sum.amount ?? 0;
}

export async function getAvailablePriorityPoints(userId: string, excludeBallotId?: string, db: DbClient = prisma): Promise<number> {
  const [balance, reserved] = await Promise.all([
    getPriorityPointBalance(userId, db),
    db.pointBid.aggregate({
      where: {
        userId,
        ...(excludeBallotId ? { NOT: { ballotId: excludeBallotId } } : {}),
        votingSession: {
          pointsSettledAt: null,
          NOT: { status: "cancelled" }
        }
      },
      _sum: { points: true }
    })
  ]);

  return balance - (reserved._sum.points ?? 0);
}

export async function getOrCreateTodayVotingSession(now = new Date()) {
  const env = getServerEnv();
  const localDate = getLocalDateForTimeZone(now, env.APP_TIMEZONE);

  return prisma.votingSession.upsert({
    where: { defaultDailyKey: localDate },
    update: {},
    create: {
      localDate,
      defaultDailyKey: localDate,
      status: "open"
    }
  });
}

export async function castVote(userId: string, gameId: string) {
  const votingSession = await getOrCreateTodayVotingSession();
  await submitBallotForSessionOnly(userId, votingSession.id, [{ gameId, voteCount: 1 }]);
  return getDailyVotingState(userId);
}

export async function castVoteForSession(userId: string, votingSessionId: string, gameId: string, isAdmin = false) {
  await submitBallotForSessionOnly(userId, votingSessionId, [{ gameId, voteCount: 1 }]);
  return getVotingSessionState(userId, votingSessionId, isAdmin);
}

export async function submitBallotForSession(
  userId: string,
  votingSessionId: string,
  allocations: BallotAllocationInput[],
  isAdmin = false
) {
  await submitBallotForSessionOnly(userId, votingSessionId, allocations);
  return getVotingSessionState(userId, votingSessionId, isAdmin);
}

async function submitBallotForSessionOnly(userId: string, votingSessionId: string, allocations: BallotAllocationInput[]) {
  const votingSession = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { id: true, status: true }
  });

  if (!votingSession) {
    throw new InvalidVoteError("Voting session does not exist");
  }

  if (!isVotableStatus(votingSession.status)) {
    throw new InvalidVoteError("Voting session is not open for votes");
  }

  const eligibleGameIds = await getEligibleGameIdsForSession(votingSession.id);
  const normalized = validateBallotAllocations(allocations, eligibleGameIds);

  await prisma.$transaction(async (tx) => {
    const ballot = await tx.voteBallot.upsert({
      where: {
        votingSessionId_userId: {
          votingSessionId: votingSession.id,
          userId
        }
      },
      update: {},
      create: {
        votingSessionId: votingSession.id,
        userId
      }
    });

    await ensureBallotParticipant(userId, votingSession.id, tx);
    await freezeUserVetoesForSession(userId, votingSession.id, "first_ballot", tx);

    await tx.voteAllocation.deleteMany({ where: { ballotId: ballot.id } });

    for (const allocation of normalized) {
      await tx.voteAllocation.create({
        data: {
          ballotId: ballot.id,
          gameId: allocation.gameId,
          voteCount: allocation.voteCount
        }
      });
    }

    if (normalized.length === 1 && normalized[0].voteCount === 1) {
      await tx.vote.upsert({
        where: {
          votingSessionId_userId: {
            votingSessionId: votingSession.id,
            userId
          }
        },
        update: { gameId: normalized[0].gameId },
        create: {
          votingSessionId: votingSession.id,
          userId,
          gameId: normalized[0].gameId
        }
      });
    } else {
      await tx.vote.deleteMany({
        where: {
          votingSessionId: votingSession.id,
          userId
        }
      });
    }
  });
}

export function validateBallotAllocations(
  allocations: BallotAllocationInput[],
  eligibleGameIds: string[]
): BallotAllocationInput[] {
  if (eligibleGameIds.length === 0) {
    throw new InvalidVoteError("No games are available for this session");
  }

  const eligible = new Set(eligibleGameIds);
  const grouped = new Map<string, number>();

  for (const allocation of allocations) {
    if (!eligible.has(allocation.gameId)) {
      throw new InvalidVoteError("Selected game is not available for this session");
    }

    if (!Number.isInteger(allocation.voteCount) || allocation.voteCount < 1) {
      throw new InvalidVoteError("voteCount must be a positive integer");
    }

    grouped.set(allocation.gameId, (grouped.get(allocation.gameId) ?? 0) + allocation.voteCount);
  }

  if (grouped.size === 0) {
    throw new InvalidVoteError("At least one vote allocation is required");
  }

  const limits = getBallotLimits(eligibleGameIds.length);
  const totalVotes = [...grouped.values()].reduce((sum, count) => sum + count, 0);

  if (totalVotes > limits.maxTotalVotes) {
    throw new InvalidVoteError(`A ballot can include at most ${limits.maxTotalVotes} votes`);
  }

  if (grouped.size > limits.maxDistinctGames) {
    throw new InvalidVoteError(`A ballot can include at most ${limits.maxDistinctGames} different games`);
  }

  if (grouped.size >= eligibleGameIds.length) {
    throw new InvalidVoteError("A ballot cannot vote for every available game");
  }

  return [...grouped.entries()].map(([gameId, voteCount]) => ({ gameId, voteCount }));
}

export async function getDailyVotingState(userId: string) {
  const votingSession = await getOrCreateTodayVotingSession();
  return getVotingSessionState(userId, votingSession.id);
}

export async function getVotingSessionState(userId: string, votingSessionId: string, isAdmin = false) {
  const votingSession = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    include: {
      location: {
        select: {
          id: true,
          name: true,
          address: true
        }
      }
    }
  });

  if (!votingSession || !isSessionVisibleToUser(votingSession.status, isAdmin)) {
    throw new InvalidSessionError("Voting session is not available");
  }

  const [games, currentBallot, results, curatedGameIds, allVotes, proposals, priorityPointBalance, participants] =
    await Promise.all([
      getEligibleGamesForSession(votingSession.id, userId),
      getCurrentBallot(votingSession.id, userId),
      getResultsForSession(votingSession.id),
      getCuratedGameIds(votingSession.id),
      getAllVotesForSession(votingSession.id),
      getSessionProposals(votingSession.id),
      getPriorityPointBalance(userId),
      getSessionParticipants(votingSession.id)
    ]);
  const availablePriorityPoints = await getAvailablePriorityPoints(userId, currentBallot?.id);

  const currentVote = currentBallot?.allocations[0]
    ? {
        gameId: currentBallot.allocations[0].gameId,
        game: currentBallot.allocations[0].game
      }
    : null;

  return {
    session: { ...toSessionDto(votingSession), location: votingSession.location },
    games,
    currentVote,
    currentBallot,
    ballotLimits: getBallotLimits(games.length),
    results,
    curatedGameIds,
    proposals,
    priorityProposal: proposals.find((proposal) => proposal.userId === userId && proposal.isPriority) ?? null,
    priorityPointBalance,
    availablePriorityPoints,
    canProposeGames: isVotableStatus(votingSession.status) && (votingSession.allowPlayerProposals || isAdmin),
    canCurateGames: isAdmin || votingSession.createdByUserId === userId,
    canSettlePoints: isAdmin || votingSession.createdByUserId === userId,
    closedProposalControlCost: getClosedProposalControlCost(votingSession.allowPlayerProposals, getCreatorOptionCount(games)),
    allVotes,
    participants,
    currentParticipant: participants.find((participant) => participant.userId === userId) ?? null
  };
}

export async function getCalendarSessions(userId: string, from: string, to: string, isAdmin = false) {
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    throw new InvalidSessionError("from and to must use YYYY-MM-DD");
  }

  const sessions = await prisma.votingSession.findMany({
    where: {
      localDate: {
        gte: from,
        lte: to
      },
      ...(isAdmin ? {} : { NOT: { status: "draft" } })
    },
    orderBy: [{ localDate: "asc" }, { localStartTime: "asc" }, { createdAt: "asc" }],
    include: {
      location: {
        select: {
          id: true,
          name: true,
          address: true
        }
      },
      voteBallots: {
        include: {
          allocations: {
            include: {
              game: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          },
          pointBid: {
            include: {
              game: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        }
      },
      vetoSnapshots: {
        include: {
          game: {
            select: {
              name: true,
              thumbnailUrl: true
            }
          }
        }
      }
    }
  });

  return {
    sessions: sessions.map((session) => toCalendarSessionDto(session, userId))
  };
}

export async function getResultsForSession(votingSessionId: string): Promise<VoteResults> {
  const [allocations, bids, vetoSnapshots] = await Promise.all([
    prisma.voteAllocation.findMany({
      where: {
        ballot: { votingSessionId }
      },
      include: {
        game: {
          select: {
            name: true,
            thumbnailUrl: true
          }
        }
      }
    }),
    prisma.pointBid.findMany({
      where: { votingSessionId },
      include: {
        game: {
          select: {
            name: true,
            thumbnailUrl: true
          }
        }
      }
    }),
    prisma.votingSessionVetoSnapshot.findMany({
      where: { votingSessionId },
      include: {
        game: {
          select: {
            name: true,
            thumbnailUrl: true
          }
        }
      }
    })
  ]);

  return summarizeScoredVoteRows(
    allocations.map((allocation) => ({
      gameId: allocation.gameId,
      gameName: allocation.game.name,
      thumbnailUrl: allocation.game.thumbnailUrl,
      voteCount: allocation.voteCount
    })),
    bids.map((bid) => ({
      gameId: bid.gameId,
      gameName: bid.game.name,
      thumbnailUrl: bid.game.thumbnailUrl,
      points: bid.points
    })),
    vetoSnapshots.map((snapshot) => ({
      gameId: snapshot.gameId,
      gameName: snapshot.game.name,
      thumbnailUrl: snapshot.game.thumbnailUrl
    }))
  );
}

export async function getVotingHistory(limit = 30) {
  const env = getServerEnv();
  const today = getLocalDateForTimeZone(new Date(), env.APP_TIMEZONE);
  const sessions = await prisma.votingSession.findMany({
    where: {
      localDate: {
        lt: today
      },
      NOT: { status: "draft" }
    },
    orderBy: [{ localDate: "desc" }, { localStartTime: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      voteBallots: {
        include: {
          allocations: {
            include: {
              game: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          },
          pointBid: {
            include: {
              game: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        }
      },
      vetoSnapshots: {
        include: {
          game: {
            select: {
              name: true,
              thumbnailUrl: true
            }
          }
        }
      }
    }
  });

  return sessions.map((session) => ({
    ...toSessionDto(session),
    results: summarizeSessionBallots(session)
  }));
}

export async function createVotingSession(userId: string, input: SessionMutationInput, isAdmin = false) {
  const normalized = validateSessionMutationInput(input, true);
  const creatorGameIds = normalized.creatorGameIds ?? [];
  const allowPlayerProposals = normalized.allowPlayerProposals ?? true;
  const controlCost = getClosedProposalControlCost(allowPlayerProposals, creatorGameIds.length);

  if (controlCost > 0 && !isAdmin) {
    const availablePoints = await getAvailablePriorityPoints(userId);

    if (availablePoints < controlCost) {
      throw new InvalidSessionError(`Not enough priority points for closed proposals. Required: ${controlCost}`);
    }
  }

  await validateActiveGameIds(creatorGameIds);

  const session = await prisma.$transaction(async (tx) => {
    const session = await tx.votingSession.create({
      data: {
        localDate: normalized.localDate ?? "",
        localStartTime: normalized.localStartTime,
        localEndTime: normalized.localEndTime,
        title: normalized.title,
        notes: normalized.notes,
        status: normalized.status ?? "open",
        allowPlayerProposals,
        proposalsLockedAt: allowPlayerProposals ? null : new Date(),
        locationId: normalized.locationId,
        createdByUserId: userId,
        updatedByUserId: userId
      }
    });

    await replaceCreatorGameOptions(tx, userId, session.id, creatorGameIds);

    if (controlCost > 0) {
      await createLedgerEntry(tx, {
        userId,
        votingSessionId: session.id,
        amount: -controlCost,
        reason: "closed_proposal_control_cost",
        idempotencyKey: `closed-control:${session.id}:${userId}`,
        createdByUserId: userId
      });
    }

    return session;
  });

  if (normalized.invitedUserIds?.length) {
    await inviteUsersToSession(userId, session.id, normalized.invitedUserIds, isAdmin);
  }

  return session;
}

export async function updateVotingSession(adminUserId: string, votingSessionId: string, input: SessionMutationInput, isAdmin = true) {
  const normalized = validateSessionMutationInput(input, false);
  const existing = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: {
      id: true,
      createdByUserId: true,
      allowPlayerProposals: true
    }
  });

  if (!existing) {
    throw new InvalidSessionError("Voting session does not exist");
  }

  const creatorGameIds = normalized.creatorGameIds;
  const allowPlayerProposals = normalized.allowPlayerProposals ?? existing.allowPlayerProposals;
  const controlCost =
    creatorGameIds === undefined ? 0 : getClosedProposalControlCost(allowPlayerProposals, creatorGameIds.length);
  const payerUserId = existing.createdByUserId ?? adminUserId;

  if (controlCost > 0 && !isAdmin) {
    const availablePoints = await getAvailablePriorityPoints(payerUserId);

    if (availablePoints < controlCost) {
      throw new InvalidSessionError(`Not enough priority points for closed proposals. Required: ${controlCost}`);
    }
  }

  if (creatorGameIds) {
    await validateActiveGameIds(creatorGameIds);
  }

  const session = await prisma.$transaction(async (tx) => {
    const session = await tx.votingSession.update({
      where: { id: votingSessionId },
      data: {
        localDate: normalized.localDate,
        localStartTime: normalized.localStartTime,
        localEndTime: normalized.localEndTime,
        title: normalized.title,
        notes: normalized.notes,
        status: normalized.status,
        allowPlayerProposals: normalized.allowPlayerProposals,
        proposalsLockedAt:
          normalized.allowPlayerProposals === undefined ? undefined : normalized.allowPlayerProposals ? null : new Date(),
        locationId: normalized.locationId,
        cancelledAt: normalized.status === "cancelled" ? new Date() : undefined,
        updatedByUserId: adminUserId
      }
    });

    if (creatorGameIds !== undefined) {
      await replaceCreatorGameOptions(tx, adminUserId, votingSessionId, creatorGameIds);
    }

    if (controlCost > 0) {
      await createLedgerEntry(tx, {
        userId: payerUserId,
        votingSessionId,
        amount: -controlCost,
        reason: "closed_proposal_control_cost",
        idempotencyKey: `closed-control:${votingSessionId}:${payerUserId}`,
        createdByUserId: adminUserId
      });
    }

    return session;
  });

  if (normalized.invitedUserIds?.length) {
    await inviteUsersToSession(adminUserId, votingSessionId, normalized.invitedUserIds, isAdmin);
  }

  if (normalized.status === "closed") {
    await freezeMissingParticipantVetoesForSession(votingSessionId, "participant_freeze");
  }

  if (normalized.status === "cancelled") {
    await notifyActiveParticipants(votingSessionId, {
      actorUserId: adminUserId,
      type: "session_cancelled",
      title: "Sesion cancelada",
      body: session.title || session.localDate,
      href: `/sessions/${votingSessionId}`,
      dedupeKeyPrefix: "session-cancelled"
    });
  } else {
    await notifyActiveParticipants(votingSessionId, {
      actorUserId: adminUserId,
      type: "session_updated",
      title: "Sesion actualizada",
      body: session.title || session.localDate,
      href: `/sessions/${votingSessionId}`,
      dedupeKeyPrefix: "session-updated"
    });
  }

  return session;
}

export async function cancelVotingSession(adminUserId: string, votingSessionId: string) {
  return updateVotingSession(adminUserId, votingSessionId, {
    status: "cancelled"
  });
}

export async function deleteVotingSession(votingSessionId: string) {
  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { id: true }
  });

  if (!session) {
    throw new InvalidSessionError("Voting session does not exist");
  }

  return prisma.votingSession.delete({
    where: { id: votingSessionId }
  });
}

export async function setCuratedGameOptions(userId: string, votingSessionId: string, gameIds: string[], isAdmin = false) {
  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: {
      id: true,
      createdByUserId: true
    }
  });

  if (!session) {
    throw new InvalidCurationError("Voting session does not exist");
  }

  if (!isAdmin && session.createdByUserId !== userId) {
    throw new ForbiddenCurationError("Only admins and the session creator can curate games");
  }

  await validateCreatorOptionChange(votingSessionId, gameIds);

  await prisma.$transaction(async (tx) => {
    await replaceCreatorGameOptions(tx, userId, votingSessionId, gameIds);
    await tx.votingSession.update({
      where: { id: votingSessionId },
      data: { updatedByUserId: userId }
    });
  });

  return getCuratedGameIds(votingSessionId);
}

export async function proposeGameForSession(
  userId: string,
  votingSessionId: string,
  gameId: string,
  isPriority = false,
  isAdmin = false
) {
  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: {
      id: true,
      status: true,
      allowPlayerProposals: true
    }
  });

  if (!session) {
    throw new InvalidProposalError("Voting session does not exist");
  }

  if (!isVotableStatus(session.status)) {
    throw new InvalidProposalError("Voting session is not open for proposals");
  }

  if (!session.allowPlayerProposals && !isAdmin) {
    throw new InvalidProposalError("This session is closed to player proposals");
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, active: true },
    select: { id: true }
  });

  if (!game) {
    throw new InvalidProposalError("Selected game is not available in the catalog");
  }

  await prisma.$transaction(async (tx) => {
    await tx.votingSessionGameOption.upsert({
      where: {
        votingSessionId_gameId: {
          votingSessionId,
          gameId
        }
      },
      update: {},
      create: {
        votingSessionId,
        gameId,
        addedByUserId: userId,
        source: "proposal"
      }
    });

    if (isPriority) {
      await tx.sessionGameProposal.updateMany({
        where: { votingSessionId, userId },
        data: { isPriority: false }
      });
    }

    await tx.sessionGameProposal.upsert({
      where: {
        votingSessionId_userId_gameId: {
          votingSessionId,
          userId,
          gameId
        }
      },
      update: { isPriority },
      create: {
        votingSessionId,
        userId,
        gameId,
        isPriority
      }
    });
  });

  return getSessionProposals(votingSessionId);
}

export async function setPriorityProposal(userId: string, votingSessionId: string, gameId: string) {
  const [proposal, bid] = await Promise.all([
    prisma.sessionGameProposal.findUnique({
      where: {
        votingSessionId_userId_gameId: {
          votingSessionId,
          userId,
          gameId
        }
      }
    }),
    prisma.pointBid.findFirst({
      where: { votingSessionId, userId }
    })
  ]);

  if (!proposal) {
    throw new InvalidProposalError("Priority proposal must be one of your proposed games");
  }

  if (bid && bid.gameId !== gameId) {
    throw new InvalidProposalError("Cannot change priority proposal while a point bid exists");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionGameProposal.updateMany({
      where: { votingSessionId, userId },
      data: { isPriority: false }
    });
    await tx.sessionGameProposal.update({
      where: {
        votingSessionId_userId_gameId: {
          votingSessionId,
          userId,
          gameId
        }
      },
      data: { isPriority: true }
    });
  });

  return getSessionProposals(votingSessionId);
}

export async function setPointBidForSession(
  userId: string,
  votingSessionId: string,
  gameId: string,
  points: number,
  isAdmin = false
) {
  if (!Number.isInteger(points) || points < 0) {
    throw new InvalidPointError("points must be a non-negative integer");
  }

  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { id: true, status: true }
  });

  if (!session) {
    throw new InvalidPointError("Voting session does not exist");
  }

  if (!isVotableStatus(session.status)) {
    throw new InvalidPointError("Voting session is not open for point bids");
  }

  const priorityProposal = await prisma.sessionGameProposal.findFirst({
    where: {
      votingSessionId,
      userId,
      gameId,
      isPriority: true
    }
  });

  if (!priorityProposal) {
    throw new InvalidPointError("Point bids must target your priority proposal");
  }

  const ballot = await prisma.voteBallot.upsert({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    update: {},
    create: {
      votingSessionId,
      userId
    }
  });

  const availablePoints = await getAvailablePriorityPoints(userId, ballot.id);

  if (!isAdmin && points > availablePoints) {
    throw new InvalidPointError("Not enough available priority points");
  }

  if (points === 0) {
    await prisma.pointBid.deleteMany({ where: { ballotId: ballot.id } });
  } else {
    await prisma.pointBid.upsert({
      where: { ballotId: ballot.id },
      update: {
        gameId,
        points
      },
      create: {
        ballotId: ballot.id,
        votingSessionId,
        userId,
        gameId,
        points
      }
    });
  }

  return getVotingSessionState(userId, votingSessionId, isAdmin);
}

export async function recordPlayedGameAndSettlePoints(
  actorUserId: string,
  votingSessionId: string,
  playedGameId: string,
  isAdmin = false
) {
  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: {
      id: true,
      createdByUserId: true,
      pointsSettledAt: true
    }
  });

  if (!session) {
    throw new InvalidSessionError("Voting session does not exist");
  }

  if (!isAdmin && session.createdByUserId !== actorUserId) {
    throw new InvalidSessionError("Only admins and the session creator can settle points");
  }

  const eligibleGameIds = await getEligibleGameIdsForSession(votingSessionId);

  if (!eligibleGameIds.includes(playedGameId)) {
    throw new InvalidSessionError("Played game must be eligible for the session");
  }

  if (session.pointsSettledAt) {
    return prisma.votingSession.update({
      where: { id: votingSessionId },
      data: { playedGameId }
    });
  }

  const updatedSession = await prisma.$transaction(async (tx) => {
    await freezeMissingParticipantVetoesForSession(votingSessionId, "participant_freeze", tx);

    const [priorityProposals, bids] = await Promise.all([
      tx.sessionGameProposal.findMany({
        where: { votingSessionId, isPriority: true }
      }),
      tx.pointBid.findMany({
        where: { votingSessionId }
      })
    ]);

    for (const proposal of priorityProposals) {
      if (proposal.gameId !== playedGameId) {
        await createLedgerEntry(tx, {
          userId: proposal.userId,
          votingSessionId,
          gameId: proposal.gameId,
          amount: UNPLAYED_PROPOSAL_POINTS,
          reason: "proposal_not_played",
          idempotencyKey: `settlement:${votingSessionId}:proposal:${proposal.id}`,
          createdByUserId: actorUserId
        });
      }
    }

    for (const bid of bids) {
      const amount = bid.gameId === playedGameId ? -bid.points : -getPartialBidLoss(bid.points);

      if (amount !== 0) {
        await createLedgerEntry(tx, {
          userId: bid.userId,
          votingSessionId,
          gameId: bid.gameId,
          amount,
          reason: bid.gameId === playedGameId ? "bid_spent_played" : "bid_partial_loss_not_played",
          idempotencyKey: `settlement:${votingSessionId}:bid:${bid.id}`,
          createdByUserId: actorUserId
        });
      }
    }

    return tx.votingSession.update({
      where: { id: votingSessionId },
      data: {
        playedGameId,
        pointsSettledAt: new Date(),
        status: "closed",
        updatedByUserId: actorUserId
      }
    });
  });

  await notifyActiveParticipants(votingSessionId, {
    actorUserId,
    type: "session_settled",
    title: "Sesion cerrada",
    body: "Ya se registro el juego jugado y los puntos.",
    href: `/sessions/${votingSessionId}`,
    dedupeKeyPrefix: "session-settled"
  });

  return updatedSession;
}

export async function getCuratedGameIds(votingSessionId: string): Promise<string[]> {
  const options = await prisma.votingSessionGameOption.findMany({
    where: { votingSessionId },
    select: { gameId: true },
    orderBy: { createdAt: "asc" }
  });

  return options.map((option) => option.gameId);
}

export async function getEligibleGamesForSession(votingSessionId: string, userId: string) {
  const [optionRecords, proposals] = await Promise.all([
    prisma.votingSessionGameOption.findMany({
      where: { votingSessionId },
      select: {
        gameId: true,
        source: true
      }
    }),
    getSessionProposals(votingSessionId)
  ]);
  const optionIds = optionRecords.map((option) => option.gameId);
  const games = await prisma.game.findMany({
    where: {
      active: true,
      ...(optionIds.length > 0 ? { id: { in: optionIds } } : {})
    },
    orderBy: { name: "asc" }
  });
  const optionMap = new Map(optionRecords.map((option) => [option.gameId, option.source]));
  const proposalsByGame = new Map<string, typeof proposals>();

  for (const proposal of proposals) {
    const existing = proposalsByGame.get(proposal.gameId) ?? [];
    existing.push(proposal);
    proposalsByGame.set(proposal.gameId, existing);
  }

  const withPreferences = await addPreferencesToGames(userId, games);

  return withPreferences.map((game) => {
    const gameProposals = proposalsByGame.get(game.id) ?? [];

    return {
      ...game,
      optionSource: optionMap.get(game.id) ?? "catalog",
      isCreatorOption: optionMap.get(game.id) === "creator",
      proposalCount: gameProposals.length,
      proposedByCurrentUser: gameProposals.some((proposal) => proposal.userId === userId),
      priorityProposalByCurrentUser: gameProposals.some((proposal) => proposal.userId === userId && proposal.isPriority),
      proposers: gameProposals.map((proposal) => ({
        userId: proposal.userId,
        userName: proposal.userName,
        isPriority: proposal.isPriority
      }))
    };
  });
}

export function summarizeVoteRows(rows: VoteRow[]): VoteResults {
  return summarizeScoredVoteRows(rows, []);
}

export function summarizeScoredVoteRows(rows: VoteRow[], bids: BidRow[] = [], vetoes: VetoRow[] = []): VoteResults {
  const grouped = new Map<string, VoteResultRow>();

  function ensureRow(gameId: string, gameName: string, thumbnailUrl: string | null): VoteResultRow {
    const existing = grouped.get(gameId);

    if (existing) {
      return existing;
    }

    const next = {
      gameId,
      gameName,
      thumbnailUrl,
      votes: 0,
      normalVotes: 0,
      bidPoints: 0,
      vetoCount: 0,
      vetoPenalty: 0,
      score: 0
    };
    grouped.set(gameId, next);
    return next;
  }

  for (const row of rows) {
    const item = ensureRow(row.gameId, row.gameName, row.thumbnailUrl);
    item.normalVotes += row.voteCount ?? 1;
  }

  for (const bid of bids) {
    const item = ensureRow(bid.gameId, bid.gameName, bid.thumbnailUrl);
    item.bidPoints += bid.points;
  }

  for (const veto of vetoes) {
    const item = ensureRow(veto.gameId, veto.gameName, veto.thumbnailUrl);
    item.vetoCount += veto.vetoCount ?? 1;
  }

  for (const item of grouped.values()) {
    item.vetoPenalty = item.vetoCount * VETO_PENALTY_POINTS;
    item.score = item.normalVotes + item.bidPoints - item.vetoPenalty;
    item.votes = item.score;
  }

  const items = [...grouped.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.vetoCount !== right.vetoCount) {
      return left.vetoCount - right.vetoCount;
    }

    return left.gameName.localeCompare(right.gameName);
  });

  const totalNormalVotes = rows.reduce((sum, row) => sum + (row.voteCount ?? 1), 0);
  const totalBidPoints = bids.reduce((sum, bid) => sum + bid.points, 0);
  const totalVetoPenalty = [...grouped.values()].reduce((sum, item) => sum + item.vetoPenalty, 0);
  const highest = items[0]?.score ?? 0;
  const lowestLeaderVetoCount = items.find((item) => item.score === highest)?.vetoCount ?? 0;
  const leaders = highest > 0 ? items.filter((item) => item.score === highest && item.vetoCount === lowestLeaderVetoCount) : [];

  return {
    totalVotes: totalNormalVotes + totalBidPoints,
    totalNormalVotes,
    totalBidPoints,
    totalVetoPenalty,
    leaders,
    items
  };
}

export function toSessionDto(session: {
  id: string;
  localDate: string;
  defaultDailyKey: string | null;
  localStartTime: string | null;
  localEndTime: string | null;
  title: string | null;
  notes: string | null;
  status: string;
  allowPlayerProposals: boolean;
  proposalsLockedAt: Date | null;
  playedGameId: string | null;
  pointsSettledAt: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    localDate: session.localDate,
    defaultDailyKey: session.defaultDailyKey,
    localStartTime: session.localStartTime,
    localEndTime: session.localEndTime,
    title: getDefaultSessionTitle(session),
    customTitle: session.title,
    notes: session.notes,
    status: session.status,
    allowPlayerProposals: session.allowPlayerProposals,
    proposalsLockedAt: session.proposalsLockedAt,
    playedGameId: session.playedGameId,
    pointsSettledAt: session.pointsSettledAt,
    createdByUserId: session.createdByUserId,
    updatedByUserId: session.updatedByUserId,
    cancelledAt: session.cancelledAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function toCalendarSessionDto(session: SessionWithBallots, userId: string) {
  const currentBallot = session.voteBallots.find((ballot) => ballot.userId === userId) ?? null;
  const firstAllocation = currentBallot?.allocations[0] ?? null;

  return {
    ...toSessionDto(session),
    location: session.location ?? null,
    currentVote: firstAllocation
      ? {
          gameId: firstAllocation.gameId,
          gameName: firstAllocation.game.name
        }
      : null,
    currentBallot: currentBallot
      ? {
          allocations: currentBallot.allocations.map((allocation) => ({
            gameId: allocation.gameId,
            gameName: allocation.game.name,
            voteCount: allocation.voteCount
          })),
          pointBid: currentBallot.pointBid
            ? {
                gameId: currentBallot.pointBid.gameId,
                gameName: currentBallot.pointBid.game.name,
                points: currentBallot.pointBid.points
              }
            : null
        }
      : null,
    results: summarizeSessionBallots(session)
  };
}

function summarizeSessionBallots(session: SessionWithBallots): VoteResults {
  return summarizeScoredVoteRows(
    session.voteBallots.flatMap((ballot) =>
      ballot.allocations.map((allocation) => ({
        gameId: allocation.gameId,
        gameName: allocation.game.name,
        thumbnailUrl: allocation.game.thumbnailUrl,
        voteCount: allocation.voteCount
      }))
    ),
    session.voteBallots.flatMap((ballot) =>
      ballot.pointBid
        ? [
            {
              gameId: ballot.pointBid.gameId,
              gameName: ballot.pointBid.game.name,
              thumbnailUrl: ballot.pointBid.game.thumbnailUrl,
              points: ballot.pointBid.points
            }
          ]
        : []
    ),
    (session.vetoSnapshots ?? []).map((snapshot) => ({
      gameId: snapshot.gameId,
      gameName: snapshot.game.name,
      thumbnailUrl: snapshot.game.thumbnailUrl
    }))
  );
}

async function getCurrentBallot(votingSessionId: string, userId: string) {
  const ballot = await prisma.voteBallot.findUnique({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    include: {
      allocations: {
        include: {
          game: true
        },
        orderBy: { createdAt: "asc" }
      },
      pointBid: {
        include: {
          game: true
        }
      }
    }
  });

  if (!ballot) {
    return null;
  }

  return {
    id: ballot.id,
    allocations: ballot.allocations.map((allocation) => ({
      gameId: allocation.gameId,
      voteCount: allocation.voteCount,
      game: allocation.game
    })),
    pointBid: ballot.pointBid
      ? {
          gameId: ballot.pointBid.gameId,
          points: ballot.pointBid.points,
          game: ballot.pointBid.game
        }
      : null
  };
}

async function getAllVotesForSession(votingSessionId: string) {
  const ballots = await prisma.voteBallot.findMany({
    where: { votingSessionId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true,
          image: true
        }
      },
      allocations: {
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true
            }
          }
        }
      }
    }
  });

  return ballots.flatMap((ballot) =>
    ballot.allocations.map((allocation) => ({
      userId: ballot.user.id,
      userName: displayNameForUser(ballot.user),
      userImage: ballot.user.image,
      gameId: allocation.game.id,
      gameName: allocation.game.name,
      gameThumbnailUrl: allocation.game.thumbnailUrl,
      voteCount: allocation.voteCount
    }))
  );
}

async function getSessionProposals(votingSessionId: string) {
  const proposals = await prisma.sessionGameProposal.findMany({
    where: { votingSessionId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true,
          image: true
        }
      },
      game: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return proposals.map((proposal) => ({
    id: proposal.id,
    votingSessionId: proposal.votingSessionId,
    userId: proposal.userId,
    userName: displayNameForUser(proposal.user),
    userImage: proposal.user.image,
    gameId: proposal.gameId,
    gameName: proposal.game.name,
    gameThumbnailUrl: proposal.game.thumbnailUrl,
    isPriority: proposal.isPriority,
    createdAt: proposal.createdAt
  }));
}

async function getEligibleGameIdsForSession(votingSessionId: string): Promise<string[]> {
  const curatedGameIds = await getCuratedGameIds(votingSessionId);

  if (curatedGameIds.length > 0) {
    return curatedGameIds;
  }

  const games = await prisma.game.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { name: "asc" }
  });

  return games.map((game) => game.id);
}

async function validateActiveGameIds(gameIds: string[]) {
  if (gameIds.length === 0) {
    return;
  }

  const activeGames = await prisma.game.findMany({
    where: {
      id: { in: gameIds },
      active: true
    },
    select: { id: true }
  });

  if (activeGames.length !== gameIds.length) {
    throw new InvalidCurationError("Curated games must all be active catalog games");
  }
}

async function validateCreatorOptionChange(votingSessionId: string, gameIds: string[]) {
  const uniqueGameIds = normalizeGameIds(gameIds);
  await validateActiveGameIds(uniqueGameIds);

  const [currentCreatorOptions, proposalOptions, allocations] = await Promise.all([
    prisma.votingSessionGameOption.findMany({
      where: { votingSessionId, source: "creator" },
      select: { gameId: true }
    }),
    prisma.sessionGameProposal.findMany({
      where: { votingSessionId },
      select: { gameId: true }
    }),
    prisma.voteAllocation.findMany({
      where: {
        ballot: { votingSessionId }
      },
      select: { gameId: true }
    })
  ]);
  const proposedGameIds = new Set(proposalOptions.map((proposal) => proposal.gameId));
  const target = new Set(uniqueGameIds);
  const removedWithoutProposal = currentCreatorOptions
    .map((option) => option.gameId)
    .filter((gameId) => !target.has(gameId) && !proposedGameIds.has(gameId));
  const blockedRemovals = getBlockedCuratedGameRemovals(
    removedWithoutProposal,
    [],
    allocations.map((allocation) => allocation.gameId)
  );

  if (blockedRemovals.length > 0) {
    throw new InvalidCurationError("Cannot remove curated games that already have votes");
  }
}

async function replaceCreatorGameOptions(tx: DbClient, userId: string, votingSessionId: string, gameIds: string[]) {
  const uniqueGameIds = normalizeGameIds(gameIds);
  const [currentCreatorOptions, proposals] = await Promise.all([
    tx.votingSessionGameOption.findMany({
      where: { votingSessionId, source: "creator" },
      select: { gameId: true }
    }),
    tx.sessionGameProposal.findMany({
      where: { votingSessionId },
      select: { gameId: true }
    })
  ]);
  const current = new Set(currentCreatorOptions.map((option) => option.gameId));
  const target = new Set(uniqueGameIds);
  const proposed = new Set(proposals.map((proposal) => proposal.gameId));

  for (const gameId of current) {
    if (target.has(gameId)) continue;

    if (proposed.has(gameId)) {
      await tx.votingSessionGameOption.update({
        where: {
          votingSessionId_gameId: {
            votingSessionId,
            gameId
          }
        },
        data: { source: "proposal" }
      });
    } else {
      await tx.votingSessionGameOption.delete({
        where: {
          votingSessionId_gameId: {
            votingSessionId,
            gameId
          }
        }
      });
    }
  }

  for (const gameId of uniqueGameIds) {
    await tx.votingSessionGameOption.upsert({
      where: {
        votingSessionId_gameId: {
          votingSessionId,
          gameId
        }
      },
      update: {
        source: "creator",
        addedByUserId: userId
      },
      create: {
        votingSessionId,
        gameId,
        addedByUserId: userId,
        source: "creator"
      }
    });
  }
}

export async function freezeUserVetoesForSession(
  userId: string,
  votingSessionId: string,
  source: "first_ballot" | "participant_freeze" | "admin_rebuild" = "first_ballot",
  db: DbClient = prisma
) {
  if (!("votingSessionVetoSnapshot" in db)) {
    return;
  }

  const existing = await db.votingSessionVetoSnapshot.findFirst({
    where: {
      votingSessionId,
      userId
    },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  const vetoes = await db.userGamePreference.findMany({
    where: {
      userId,
      preference: "vetoed"
    },
    select: { gameId: true }
  });

  if (vetoes.length === 0) {
    return;
  }

  await db.votingSessionVetoSnapshot.createMany({
    data: vetoes.map((veto) => ({
      votingSessionId,
      userId,
      gameId: veto.gameId,
      source
    })),
    skipDuplicates: true
  });
}

export async function freezeMissingParticipantVetoesForSession(
  votingSessionId: string,
  source: "participant_freeze" | "admin_rebuild" = "participant_freeze",
  db: DbClient = prisma
) {
  if (!("votingSessionParticipant" in db)) {
    return;
  }

  const participants = await db.votingSessionParticipant.findMany({
    where: {
      votingSessionId,
      status: { in: activeParticipantStatuses }
    },
    select: { userId: true }
  });

  for (const participant of participants) {
    await freezeUserVetoesForSession(participant.userId, votingSessionId, source, db);
  }
}

async function createLedgerEntry(
  db: DbClient,
  input: {
    userId: string;
    votingSessionId?: string;
    gameId?: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    createdByUserId?: string;
  }
) {
  const entry = await db.priorityPointLedger.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      userId: input.userId,
      votingSessionId: input.votingSessionId,
      gameId: input.gameId,
      amount: input.amount,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      createdByUserId: input.createdByUserId
    }
  });

  if (entry?.id) {
    await createNotification(
      {
        userId: input.userId,
        actorUserId: input.createdByUserId,
        type: "points_changed",
        title: input.amount >= 0 ? "Puntos ganados" : "Puntos gastados",
        body: `${input.amount > 0 ? "+" : ""}${input.amount} puntos: ${input.reason}`,
        href: input.votingSessionId ? `/sessions/${input.votingSessionId}` : "/profile",
        votingSessionId: input.votingSessionId,
        ledgerEntryId: entry.id,
        dedupeKey: `ledger:${entry.id}`
      },
      db
    );
  }
}

function normalizeGameIds(gameIds: string[] | undefined): string[] {
  return normalizeIds(gameIds);
}

function normalizeIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

function getCreatorOptionCount(games: Array<{ isCreatorOption?: boolean }>): number {
  return games.filter((game) => game.isCreatorOption).length;
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function preferenceLabel(preference: PreferenceState | null): string {
  if (preference === "favorite") {
    return "Favorite";
  }

  if (preference === "vetoed") {
    return "Vetoed";
  }

  return "No preference";
}
