import { prisma } from "@/server/db";

export async function getSessionMessages(votingSessionId: string) {
  return prisma.sessionMessage.findMany({
    where: { votingSessionId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    }
  });
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

  return prisma.sessionMessage.create({
    data: {
      votingSessionId,
      userId,
      content: trimmed
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    }
  });
}

export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}
