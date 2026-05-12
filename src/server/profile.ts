import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { getVetoCapacity } from "@/server/preferences";
import { getLocalDateForTimeZone, getPriorityPointBalance, toSessionDto } from "@/server/voting";
import { displayNameForUser, normalizeNickname } from "@/server/users";

const MAX_NICKNAME_LENGTH = 32;

export class InvalidProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProfileError";
  }
}

export async function getUserProfile(userId: string) {
  const env = getServerEnv();
  const today = getLocalDateForTimeZone(new Date(), env.APP_TIMEZONE);
  const [user, preferences, vetoCapacity, pointBalance, ledgerEntries, upcomingParticipants, attendedParticipants, ballotSessions] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true,
          image: true,
          role: true
        }
      }),
      prisma.userGamePreference.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true,
              imageUrl: true,
              yearPublished: true
            }
          }
        }
      }),
      getVetoCapacity(userId),
      getPriorityPointBalance(userId),
      prisma.priorityPointLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true
            }
          },
          votingSession: {
            select: {
              id: true,
              title: true,
              localDate: true,
              localStartTime: true,
              localEndTime: true,
              defaultDailyKey: true,
              notes: true,
              status: true,
              allowPlayerProposals: true,
              proposalsLockedAt: true,
              playedGameId: true,
              pointsSettledAt: true,
              createdByUserId: true,
              updatedByUserId: true,
              cancelledAt: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      }),
      prisma.votingSessionParticipant.findMany({
        where: {
          userId,
          status: { not: "declined" },
          votingSession: {
            localDate: { gte: today },
            NOT: { status: "cancelled" }
          }
        },
        orderBy: [{ votingSession: { localDate: "asc" } }, { votingSession: { localStartTime: "asc" } }],
        include: {
          votingSession: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true
                }
              }
            }
          }
        }
      }),
      prisma.votingSessionParticipant.findMany({
        where: {
          userId,
          status: "attended",
          votingSession: {
            localDate: { lt: today }
          }
        },
        orderBy: [{ votingSession: { localDate: "desc" } }, { votingSession: { localStartTime: "desc" } }],
        include: {
          votingSession: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true
                }
              },
              playedGame: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        }
      }),
      prisma.voteBallot.findMany({
        where: {
          userId,
          votingSession: {
            localDate: { lt: today }
          }
        },
        include: {
          votingSession: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true
                }
              },
              playedGame: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        },
        orderBy: [{ votingSession: { localDate: "desc" } }, { votingSession: { localStartTime: "desc" } }]
      })
    ]);

  if (!user) {
    throw new InvalidProfileError("Profile is not available");
  }

  const attendedSessionIds = new Set(attendedParticipants.map((participant) => participant.votingSessionId));
  const ballotFallbacks = ballotSessions.filter((ballot) => !attendedSessionIds.has(ballot.votingSessionId));

  return {
    user: {
      ...user,
      displayName: displayNameForUser(user)
    },
    favorites: preferences.filter((preference) => preference.preference === "favorite").map((preference) => preference.game),
    vetoes: preferences.filter((preference) => preference.preference === "vetoed").map((preference) => preference.game),
    vetoCapacity,
    pointBalance,
    pointLedger: ledgerEntries.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      reason: entry.reason,
      createdAt: entry.createdAt,
      game: entry.game,
      session: entry.votingSession ? toSessionDto(entry.votingSession) : null
    })),
    upcomingSessions: upcomingParticipants.map((participant) => ({
      participationStatus: participant.status,
      session: {
        ...toSessionDto(participant.votingSession),
        location: participant.votingSession.location
      }
    })),
    pastPlayedSessions: [
      ...attendedParticipants.map((participant) => ({
        participationStatus: participant.status,
        session: {
          ...toSessionDto(participant.votingSession),
          location: participant.votingSession.location,
          playedGame: participant.votingSession.playedGame
        }
      })),
      ...ballotFallbacks.map((ballot) => ({
        participationStatus: "ballot",
        session: {
          ...toSessionDto(ballot.votingSession),
          location: ballot.votingSession.location,
          playedGame: ballot.votingSession.playedGame
        }
      }))
    ]
  };
}

export async function updateUserProfile(userId: string, input: { nickname?: unknown }) {
  const nickname = normalizeOptionalNickname(input.nickname);
  const normalizedNickname = nickname ? normalizeNickname(nickname) : null;

  if (normalizedNickname) {
    const existing = await prisma.user.findFirst({
      where: {
        normalizedNickname,
        NOT: { id: userId }
      },
      select: { id: true }
    });

    if (existing) {
      throw new InvalidProfileError("Nickname is already in use");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      nickname,
      normalizedNickname
    },
    select: {
      id: true,
      nickname: true,
      name: true,
      email: true,
      image: true,
      role: true
    }
  });
}

function normalizeOptionalNickname(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new InvalidProfileError("Nickname must be text");
  }

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    throw new InvalidProfileError(`Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer`);
  }

  if (!/^[\p{L}\p{N} _.-]+$/u.test(trimmed)) {
    throw new InvalidProfileError("Nickname can contain letters, numbers, spaces, underscores, dots, and hyphens");
  }

  return trimmed;
}
