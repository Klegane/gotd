import { prisma } from "@/server/db";

export const preferenceStates = ["favorite", "vetoed"] as const;
export type PreferenceState = (typeof preferenceStates)[number];

export class InvalidPreferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPreferenceError";
  }
}

export type GameWithPreference<TGame> = TGame & {
  preference: PreferenceState | null;
};

export function isPreferenceState(value: unknown): value is PreferenceState {
  return typeof value === "string" && preferenceStates.includes(value as PreferenceState);
}

export async function setGamePreference(userId: string, gameId: string, preference: PreferenceState) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      active: true
    },
    select: { id: true }
  });

  if (!game) {
    throw new InvalidPreferenceError("Selected game is not available in the catalog");
  }

  return prisma.userGamePreference.upsert({
    where: {
      userId_gameId: {
        userId,
        gameId
      }
    },
    update: { preference },
    create: {
      userId,
      gameId,
      preference
    }
  });
}

export async function clearGamePreference(userId: string, gameId: string) {
  await prisma.userGamePreference.deleteMany({
    where: {
      userId,
      gameId
    }
  });
}

export async function getUserGamePreferenceMap(userId: string): Promise<Map<string, PreferenceState>> {
  const preferences = await prisma.userGamePreference.findMany({
    where: { userId },
    select: {
      gameId: true,
      preference: true
    }
  });

  return new Map(
    preferences
      .filter((preference): preference is { gameId: string; preference: PreferenceState } =>
        isPreferenceState(preference.preference)
      )
      .map((preference) => [preference.gameId, preference.preference])
  );
}

export async function addPreferencesToGames<TGame extends { id: string }>(
  userId: string,
  games: TGame[]
): Promise<Array<GameWithPreference<TGame>>> {
  const preferenceMap = await getUserGamePreferenceMap(userId);
  return applyPreferenceMap(games, preferenceMap);
}

export function applyPreferenceMap<TGame extends { id: string }>(
  games: TGame[],
  preferenceMap: Map<string, PreferenceState>
): Array<GameWithPreference<TGame>> {
  return games.map((game) => ({
    ...game,
    preference: preferenceMap.get(game.id) ?? null
  }));
}
