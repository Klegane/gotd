import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import { createNotification, createNotifications } from "@/server/notifications";
import { displayNameForUser } from "@/server/users";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const participantStatuses = ["invited", "accepted", "declined", "maybe", "attended", "absent"] as const;
export type ParticipantStatus = (typeof participantStatuses)[number];

export const activeParticipantStatuses: ParticipantStatus[] = ["invited", "accepted", "maybe", "attended"];

export class InvalidParticipantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParticipantError";
  }
}

export function isParticipantStatus(value: unknown): value is ParticipantStatus {
  return typeof value === "string" && participantStatuses.includes(value as ParticipantStatus);
}

export function isActiveParticipantStatus(status: string): boolean {
  return activeParticipantStatuses.includes(status as ParticipantStatus);
}

export async function canManageSession(userId: string, votingSessionId: string, isAdmin = false, db: DbClient = prisma): Promise<boolean> {
  if (isAdmin) {
    return true;
  }

  const session = await db.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { createdByUserId: true }
  });

  return session?.createdByUserId === userId;
}

export async function inviteUsersToSession(
  actorUserId: string,
  votingSessionId: string,
  userIds: string[],
  isAdmin = false
) {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => typeof userId === "string" && userId.trim()))];

  if (uniqueUserIds.length === 0) {
    return getSessionParticipants(votingSessionId);
  }

  if (!(await canManageSession(actorUserId, votingSessionId, isAdmin))) {
    throw new InvalidParticipantError("Only admins and the session creator can invite users");
  }

  const [session, users] = await Promise.all([
    prisma.votingSession.findUnique({
      where: { id: votingSessionId },
      select: {
        id: true,
        title: true,
        localDate: true
      }
    }),
    prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        nickname: true,
        name: true,
        email: true
      }
    })
  ]);

  if (!session) {
    throw new InvalidParticipantError("Voting session does not exist");
  }

  if (users.length !== uniqueUserIds.length) {
    throw new InvalidParticipantError("All invited users must be registered users");
  }

  await prisma.$transaction(async (tx) => {
    for (const invitedUserId of uniqueUserIds) {
      await tx.votingSessionParticipant.upsert({
        where: {
          votingSessionId_userId: {
            votingSessionId,
            userId: invitedUserId
          }
        },
        update: {
          invitedByUserId: actorUserId,
          invitedAt: new Date()
        },
        create: {
          votingSessionId,
          userId: invitedUserId,
          invitedByUserId: actorUserId,
          status: "invited"
        }
      });

      await createNotification(
        {
          userId: invitedUserId,
          actorUserId,
          type: "session_invitation",
          title: "Nueva invitacion a sesion",
          body: session.title || session.localDate,
          href: `/sessions/${votingSessionId}`,
          votingSessionId,
          dedupeKey: `session-invitation:${votingSessionId}:${invitedUserId}`
        },
        tx
      );
    }
  });

  return getSessionParticipants(votingSessionId);
}

export async function respondToSessionInvitation(userId: string, votingSessionId: string, status: ParticipantStatus) {
  if (!["accepted", "declined", "maybe"].includes(status)) {
    throw new InvalidParticipantError("Invitation response must be accepted, declined, or maybe");
  }

  const participant = await prisma.votingSessionParticipant.findUnique({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    include: {
      votingSession: {
        select: {
          createdByUserId: true,
          title: true,
          localDate: true
        }
      },
      user: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (!participant) {
    throw new InvalidParticipantError("Invitation is not available");
  }

  await prisma.votingSessionParticipant.update({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    data: {
      status,
      respondedAt: new Date()
    }
  });

  if (participant.votingSession.createdByUserId && participant.votingSession.createdByUserId !== userId) {
    await createNotification({
      userId: participant.votingSession.createdByUserId,
      actorUserId: userId,
      type: "invitation_response",
      title: "Respuesta a invitacion",
      body: `${displayNameForUser(participant.user)}: ${status}`,
      href: `/sessions/${votingSessionId}`,
      votingSessionId,
      dedupeKey: `invitation-response:${votingSessionId}:${userId}`
    });
  }

  return getSessionParticipants(votingSessionId);
}

export async function markSessionAttendance(
  actorUserId: string,
  votingSessionId: string,
  userId: string,
  status: "attended" | "absent",
  isAdmin = false
) {
  if (!(await canManageSession(actorUserId, votingSessionId, isAdmin))) {
    throw new InvalidParticipantError("Only admins and the session creator can mark attendance");
  }

  await prisma.votingSessionParticipant.upsert({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    update: {
      status,
      attendanceUpdatedAt: new Date()
    },
    create: {
      votingSessionId,
      userId,
      invitedByUserId: actorUserId,
      status,
      respondedAt: new Date(),
      attendanceUpdatedAt: new Date()
    }
  });

  return getSessionParticipants(votingSessionId);
}

export async function getSessionParticipants(votingSessionId: string) {
  const participants = await prisma.votingSessionParticipant.findMany({
    where: { votingSessionId },
    orderBy: [{ status: "asc" }, { invitedAt: "asc" }],
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
      invitedBy: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true
        }
      }
    }
  });

  return participants.map((participant) => ({
    id: participant.id,
    votingSessionId: participant.votingSessionId,
    userId: participant.userId,
    userName: displayNameForUser(participant.user),
    userImage: participant.user.image,
    invitedByUserId: participant.invitedByUserId,
    invitedByName: participant.invitedBy ? displayNameForUser(participant.invitedBy) : null,
    status: participant.status,
    invitedAt: participant.invitedAt,
    respondedAt: participant.respondedAt,
    attendanceUpdatedAt: participant.attendanceUpdatedAt
  }));
}

export async function getActiveParticipantUserIds(votingSessionId: string, db: DbClient = prisma): Promise<string[]> {
  const participants = await db.votingSessionParticipant.findMany({
    where: {
      votingSessionId,
      status: { in: activeParticipantStatuses }
    },
    select: { userId: true }
  });

  return participants.map((participant) => participant.userId);
}

export async function ensureBallotParticipant(userId: string, votingSessionId: string, db: DbClient = prisma) {
  await db.votingSessionParticipant.upsert({
    where: {
      votingSessionId_userId: {
        votingSessionId,
        userId
      }
    },
    update: {
      status: "accepted",
      respondedAt: new Date()
    },
    create: {
      votingSessionId,
      userId,
      status: "accepted",
      respondedAt: new Date()
    }
  });
}

export async function notifyActiveParticipants(
  votingSessionId: string,
  input: {
    actorUserId?: string | null;
    type: "session_updated" | "session_cancelled" | "session_message" | "session_settled";
    title: string;
    body?: string | null;
    href?: string | null;
    sessionMessageId?: string | null;
    dedupeKeyPrefix?: string | null;
  },
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

  await createNotifications(
    participants.map((participant) => ({
      userId: participant.userId,
      actorUserId: input.actorUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? `/sessions/${votingSessionId}`,
      votingSessionId,
      sessionMessageId: input.sessionMessageId,
      dedupeKey: input.dedupeKeyPrefix ? `${input.dedupeKeyPrefix}:${votingSessionId}:${participant.userId}` : null
    })),
    db
  );
}
