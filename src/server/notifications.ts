import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type NotificationType =
  | "session_invitation"
  | "session_updated"
  | "session_cancelled"
  | "session_message"
  | "session_settled"
  | "points_changed"
  | "invitation_response";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  actorUserId?: string | null;
  votingSessionId?: string | null;
  sessionMessageId?: string | null;
  ledgerEntryId?: string | null;
  dedupeKey?: string | null;
};

export async function createNotification(input: NotificationInput, db: DbClient = prisma) {
  if (input.actorUserId && input.actorUserId === input.userId) {
    return null;
  }

  if (!("userNotification" in db)) {
    return null;
  }

  if (input.dedupeKey) {
    const existing = await db.userNotification.findFirst({
      where: {
        userId: input.userId,
        dedupeKey: input.dedupeKey,
        readAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (existing) {
      return db.userNotification.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          body: input.body,
          href: input.href,
          actorUserId: input.actorUserId,
          votingSessionId: input.votingSessionId,
          sessionMessageId: input.sessionMessageId,
          ledgerEntryId: input.ledgerEntryId,
          createdAt: new Date()
        }
      });
    }
  }

  return db.userNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      actorUserId: input.actorUserId,
      votingSessionId: input.votingSessionId,
      sessionMessageId: input.sessionMessageId,
      ledgerEntryId: input.ledgerEntryId,
      dedupeKey: input.dedupeKey
    }
  });
}

export async function createNotifications(inputs: NotificationInput[], db: DbClient = prisma) {
  const results = [];

  for (const input of inputs) {
    results.push(await createNotification(input, db));
  }

  return results;
}

export async function getUserNotifications(userId: string, limit = 30) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actorUser: {
          select: {
            id: true,
            nickname: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    }),
    prisma.userNotification.count({
      where: {
        userId,
        readAt: null
      }
    })
  ]);

  return {
    unreadCount,
    notifications
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.userNotification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      readAt: new Date()
    }
  });

  if (result.count === 0) {
    throw new InvalidNotificationError("Notification is not available");
  }
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.userNotification.updateMany({
    where: {
      userId,
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });
}

export class InvalidNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNotificationError";
  }
}
