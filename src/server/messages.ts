import { prisma } from "@/server/db";
import { notifyActiveParticipants } from "@/server/participants";
import { displayNameForUser } from "@/server/users";

export async function getSessionMessages(votingSessionId: string) {
  const messages = await prisma.sessionMessage.findMany({
    where: { votingSessionId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true,
          image: true
        }
      }
    }
  });

  return messages.map((message) => ({
    ...message,
    user: {
      ...message.user,
      name: displayNameForUser(message.user)
    }
  }));
}

export async function createSessionMessage(userId: string, votingSessionId: string, content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new InvalidMessageError("Message content is required");
  }

  const session = await prisma.votingSession.findUnique({
    where: { id: votingSessionId },
    select: { id: true }
  });

  if (!session) {
    throw new InvalidMessageError("Voting session does not exist");
  }

  const message = await prisma.sessionMessage.create({
    data: {
      votingSessionId,
      userId,
      content: trimmed
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          name: true,
          email: true,
          image: true
        }
      }
    }
  });

  await notifyActiveParticipants(votingSessionId, {
    actorUserId: userId,
    type: "session_message",
    title: "Nuevo mensaje de sesion",
    body: message.content,
    href: `/sessions/${votingSessionId}`,
    sessionMessageId: message.id,
    dedupeKeyPrefix: "session-message"
  });

  return {
    ...message,
    user: {
      ...message.user,
      name: displayNameForUser(message.user)
    }
  };
}

export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}
