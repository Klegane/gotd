import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { addPreferencesToGames, type PreferenceState } from "@/server/preferences";

export const sessionStatuses = ["draft", "open", "closed", "cancelled"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

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

export type VoteResultRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  votes: number;
};

export type VoteResults = {
  totalVotes: number;
  leaders: VoteResultRow[];
  items: VoteResultRow[];
};

export type SessionMutationInput = {
  localDate?: string;
  localStartTime?: string | null;
  localEndTime?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: SessionStatus;
  locationId?: string | null;
};

type VoteRow = {
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
};

type SessionWithVotes = {
  id: string;
  localDate: string;
  defaultDailyKey: string | null;
  localStartTime: string | null;
  localEndTime: string | null;
  title: string | null;
  notes: string | null;
  status: string;
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
  votes: Array<{
    userId: string;
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

  return {
    ...input,
    title: normalizeOptionalText(input.title),
    notes: normalizeOptionalText(input.notes),
    localStartTime: normalizeOptionalText(input.localStartTime),
    localEndTime: normalizeOptionalText(input.localEndTime)
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
  await castVoteForSessionOnly(userId, votingSession.id, gameId);
  return getDailyVotingState(userId);
}

export async function castVoteForSession(userId: string, votingSessionId: string, gameId: string, isAdmin = false) {
  await castVoteForSessionOnly(userId, votingSessionId, gameId);
  return getVotingSessionState(userId, votingSessionId, isAdmin);
}

async function castVoteForSessionOnly(userId: string, votingSessionId: string, gameId: string) {
  const votingSession = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: {
      id: true,
      status: true
    }
  });

  if (!votingSession) {
    throw new InvalidVoteError("Voting session does not exist");
  }

  if (!isVotableStatus(votingSession.status)) {
    throw new InvalidVoteError("Voting session is not open for votes");
  }

  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      active: true
    },
    select: { id: true }
  });

  if (!game) {
    throw new InvalidVoteError("Selected game is not available for voting");
  }

  const curatedGameIds = await getCuratedGameIds(votingSession.id);

  if (curatedGameIds.length > 0 && !curatedGameIds.includes(game.id)) {
    throw new InvalidVoteError("Selected game is not available for this session");
  }

  await prisma.vote.upsert({
    where: {
      votingSessionId_userId: {
        votingSessionId: votingSession.id,
        userId
      }
    },
    update: {
      gameId: game.id
    },
    create: {
      votingSessionId: votingSession.id,
      userId,
      gameId: game.id
    }
  });
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

  const [games, currentVote, results, curatedGameIds, allVotes] = await Promise.all([
    getEligibleGamesForSession(votingSession.id, userId),
    prisma.vote.findUnique({
      where: {
        votingSessionId_userId: {
          votingSessionId: votingSession.id,
          userId
        }
      },
      include: {
        game: true
      }
    }),
    getResultsForSession(votingSession.id),
    getCuratedGameIds(votingSession.id),
    prisma.vote.findMany({
      where: { votingSessionId: votingSession.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
      }
    })
  ]);

  return {
    session: { ...toSessionDto(votingSession), location: votingSession.location },
    games,
    currentVote,
    results,
    curatedGameIds,
    canCurateGames: isAdmin || votingSession.createdByUserId === userId,
    allVotes: allVotes.map((vote) => ({
      userId: vote.user.id,
      userName: vote.user.name,
      userImage: vote.user.image,
      gameId: vote.game.id,
      gameName: vote.game.name,
      gameThumbnailUrl: vote.game.thumbnailUrl
    }))
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
      votes: {
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
  const votes = await prisma.vote.findMany({
    where: { votingSessionId },
    include: {
      game: true
    }
  });

  return summarizeVoteRows(
    votes.map((vote) => ({
      gameId: vote.gameId,
      gameName: vote.game.name,
      thumbnailUrl: vote.game.thumbnailUrl
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
      votes: {
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
    results: summarizeSessionVotes(session)
  }));
}

export async function createVotingSession(userId: string, input: SessionMutationInput) {
  const normalized = validateSessionMutationInput(input, true);

  return prisma.votingSession.create({
    data: {
      localDate: normalized.localDate ?? "",
      localStartTime: normalized.localStartTime,
      localEndTime: normalized.localEndTime,
      title: normalized.title,
      notes: normalized.notes,
      status: normalized.status ?? "open",
      locationId: normalized.locationId,
      createdByUserId: userId,
      updatedByUserId: userId
    }
  });
}

export async function updateVotingSession(adminUserId: string, votingSessionId: string, input: SessionMutationInput) {
  const normalized = validateSessionMutationInput(input, false);
  const existing = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { id: true }
  });

  if (!existing) {
    throw new InvalidSessionError("Voting session does not exist");
  }

  return prisma.votingSession.update({
    where: { id: votingSessionId },
    data: {
      localDate: normalized.localDate,
      localStartTime: normalized.localStartTime,
      localEndTime: normalized.localEndTime,
      title: normalized.title,
      notes: normalized.notes,
      status: normalized.status,
      locationId: normalized.locationId,
      cancelledAt: normalized.status === "cancelled" ? new Date() : undefined,
      updatedByUserId: adminUserId
    }
  });
}

export async function cancelVotingSession(adminUserId: string, votingSessionId: string) {
  return updateVotingSession(adminUserId, votingSessionId, {
    status: "cancelled"
  });
}

export async function setCuratedGameOptions(userId: string, votingSessionId: string, gameIds: string[], isAdmin = false) {
  const uniqueGameIds = [...new Set(gameIds)];
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

  const [activeGames, currentOptions, votes] = await Promise.all([
    uniqueGameIds.length === 0
      ? Promise.resolve([])
      : prisma.game.findMany({
          where: {
            id: { in: uniqueGameIds },
            active: true
          },
          select: { id: true, name: true }
        }),
    prisma.votingSessionGameOption.findMany({
      where: { votingSessionId },
      select: { gameId: true }
    }),
    prisma.vote.findMany({
      where: { votingSessionId },
      select: {
        gameId: true,
        game: {
          select: {
            name: true
          }
        }
      }
    })
  ]);

  if (activeGames.length !== uniqueGameIds.length) {
    throw new InvalidCurationError("Curated games must all be active catalog games");
  }

  const currentGameIds = currentOptions.map((option) => option.gameId);
  const votedGameIds = votes.map((vote) => vote.gameId);
  const blockedRemovals = getBlockedCuratedGameRemovals(currentGameIds, uniqueGameIds, votedGameIds);

  if (blockedRemovals.length > 0) {
    throw new InvalidCurationError("Cannot remove curated games that already have votes");
  }

  if (uniqueGameIds.length > 0) {
    const target = new Set(uniqueGameIds);
    const invalidExistingVotes = votes.filter((vote) => !target.has(vote.gameId));

    if (invalidExistingVotes.length > 0) {
      throw new InvalidCurationError("Cannot curate a session in a way that excludes existing votes");
    }
  }

  const target = new Set(uniqueGameIds);
  const current = new Set(currentGameIds);
  const toRemove = currentGameIds.filter((gameId) => !target.has(gameId));
  const toAdd = uniqueGameIds.filter((gameId) => !current.has(gameId));

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.votingSessionGameOption.deleteMany({
        where: {
          votingSessionId,
          gameId: { in: toRemove }
        }
      });
    }

    for (const gameId of toAdd) {
      await tx.votingSessionGameOption.create({
        data: {
          votingSessionId,
          gameId,
          addedByUserId: userId
        }
      });
    }

    await tx.votingSession.update({
      where: { id: votingSessionId },
      data: { updatedByUserId: userId }
    });
  });

  return getCuratedGameIds(votingSessionId);
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
  const curatedGameIds = await getCuratedGameIds(votingSessionId);
  const games = await prisma.game.findMany({
    where: {
      active: true,
      ...(curatedGameIds.length > 0 ? { id: { in: curatedGameIds } } : {})
    },
    orderBy: { name: "asc" }
  });

  return addPreferencesToGames(userId, games);
}

export function summarizeVoteRows(rows: VoteRow[]): VoteResults {
  const grouped = new Map<string, VoteResultRow>();

  for (const row of rows) {
    const existing = grouped.get(row.gameId);

    if (existing) {
      existing.votes += 1;
    } else {
      grouped.set(row.gameId, {
        gameId: row.gameId,
        gameName: row.gameName,
        thumbnailUrl: row.thumbnailUrl,
        votes: 1
      });
    }
  }

  const items = [...grouped.values()].sort((left, right) => {
    if (right.votes !== left.votes) {
      return right.votes - left.votes;
    }

    return left.gameName.localeCompare(right.gameName);
  });

  const totalVotes = rows.length;
  const highest = items[0]?.votes ?? 0;
  const leaders = highest > 0 ? items.filter((item) => item.votes === highest) : [];

  return {
    totalVotes,
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
    createdByUserId: session.createdByUserId,
    updatedByUserId: session.updatedByUserId,
    cancelledAt: session.cancelledAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function toCalendarSessionDto(session: SessionWithVotes, userId: string) {
  const currentVote = session.votes.find((vote) => vote.userId === userId) ?? null;

  return {
    ...toSessionDto(session),
    location: session.location ?? null,
    currentVote: currentVote
      ? {
          gameId: currentVote.gameId,
          gameName: currentVote.game.name
        }
      : null,
    results: summarizeSessionVotes(session)
  };
}

function summarizeSessionVotes(session: SessionWithVotes): VoteResults {
  return summarizeVoteRows(
    session.votes.map((vote) => ({
      gameId: vote.gameId,
      gameName: vote.game.name,
      thumbnailUrl: vote.game.thumbnailUrl
    }))
  );
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
