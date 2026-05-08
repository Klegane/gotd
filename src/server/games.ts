import { prisma } from "@/server/db";
import { addPreferencesToGames } from "@/server/preferences";
import { summarizeVoteRows } from "@/server/voting";

export async function getGameDetail(gameId: string, userId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      expansions: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          bggId: true,
          name: true,
          yearPublished: true,
          thumbnailUrl: true
        }
      },
      parentGame: {
        select: {
          id: true,
          bggId: true,
          name: true,
          thumbnailUrl: true
        }
      }
    }
  });

  if (!game) {
    return null;
  }

  const history = await getGameSessionHistory(gameId);
  const [gameWithPreference] = await addPreferencesToGames(userId, [game]);

  return {
    game: gameWithPreference,
    history
  };
}

async function getGameSessionHistory(gameId: string) {
  const sessions = await prisma.votingSession.findMany({
    where: {
      status: "closed",
      votes: {
        some: { gameId }
      }
    },
    orderBy: [{ localDate: "desc" }, { localStartTime: "desc" }],
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
      },
      location: {
        select: {
          name: true
        }
      }
    }
  });

  return sessions.map((session) => {
    const results = summarizeVoteRows(
      session.votes.map((vote) => ({
        gameId: vote.gameId,
        gameName: vote.game.name,
        thumbnailUrl: vote.game.thumbnailUrl
      }))
    );

    const wasWinner = results.leaders.some((leader) => leader.gameId === gameId);

    return {
      id: session.id,
      localDate: session.localDate,
      title: session.title,
      locationName: session.location?.name ?? null,
      wasWinner,
      totalVotes: results.totalVotes,
      gameVotes: results.items.find((item) => item.gameId === gameId)?.votes ?? 0
    };
  });
}
