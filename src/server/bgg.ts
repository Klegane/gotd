import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";
import {
  BggXmlApiClient,
  type BggApiClientOptions,
  type BggCollectionGame,
  type BggThingDetails
} from "@/server/bgg-api";

export {
  BggApiError,
  BggXmlApiClient,
  buildCollectionUrl,
  buildThingDetailsUrl,
  parseCollectionSnapshotXml,
  parseCollectionXml,
  parseThingDetailsXml
} from "@/server/bgg-api";
export type { BggCollectionGame, BggThingDetails } from "@/server/bgg-api";

const DEFAULT_DETAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRANSACTION_MAX_WAIT_MS = 10_000;
const TRANSACTION_TIMEOUT_MS = 60_000;

export type BggSyncResult = {
  status: "success" | "partial";
  importedCount: number;
  activeCount: number;
  runId: string;
  detailsRefreshedCount: number;
  detailFailureCount: number;
  warnings: string[];
};

export type BggSyncOptions = Omit<BggApiClientOptions, "apiToken" | "sleep" | "batchDelayMs" | "retryDelayMs"> & {
  apiToken?: string;
  delay?: (ms: number) => Promise<void>;
  delayMs?: number;
  detailCacheTtlMs?: number;
  now?: () => Date;
};

export type CatalogFetchResult = {
  games: BggCollectionGame[];
  detailsRefreshedCount: number;
  detailFailureCount: number;
  warnings: string[];
};

export type CachedBggGame = {
  bggId: number;
  name: string;
  yearPublished: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  averageWeight: number | null;
  categories: string[];
  mechanisms: string[];
  families: string[];
  designers: string[];
  artists: string[];
  isExpansion: boolean;
  metadataJson: string | null;
  parentGame: { bggId: number } | null;
};

let activeCatalogSync: Promise<BggSyncResult> | null = null;

export async function syncBoardGameGeekCatalog(options: BggSyncOptions = {}): Promise<BggSyncResult> {
  if (activeCatalogSync) {
    return activeCatalogSync;
  }

  const sync = performCatalogSync(options);
  activeCatalogSync = sync;

  try {
    return await sync;
  } finally {
    if (activeCatalogSync === sync) {
      activeCatalogSync = null;
    }
  }
}

async function performCatalogSync(options: BggSyncOptions): Promise<BggSyncResult> {
  const env = getServerEnv();
  const run = await prisma.catalogSyncRun.create({
    data: {
      sourceUsername: env.BGG_USERNAME,
      status: "pending"
    }
  });

  try {
    const fetched = await fetchBoardGameGeekCatalog(options);
    const status = fetched.warnings.length > 0 ? "partial" : "success";

    const activeCount = await prisma.$transaction(
      async (tx) => {
        const importedIds = fetched.games.map((game) => game.bggId);

        for (const game of fetched.games) {
          const data = persistedGameData(game);

          await tx.game.upsert({
            where: { bggId: game.bggId },
            update: data,
            create: {
              bggId: game.bggId,
              ...data
            }
          });
        }

        const referencedIds = uniqueIds([
          ...importedIds,
          ...fetched.games.flatMap((game) => game.parentBggIds ?? [])
        ]);
        const storedGames =
          referencedIds.length > 0
            ? await tx.game.findMany({
                where: { bggId: { in: referencedIds } },
                select: { id: true, bggId: true }
              })
            : [];
        const idByBggId = new Map(storedGames.map((game) => [game.bggId, game.id]));

        for (const game of fetched.games) {
          const parentGameId = (game.parentBggIds ?? [])
            .map((parentBggId) => idByBggId.get(parentBggId))
            .find((id): id is string => Boolean(id));

          await tx.game.update({
            where: { bggId: game.bggId },
            data: { parentGameId: parentGameId ?? null }
          });
        }

        await tx.game.updateMany({
          where: importedIds.length > 0 ? { active: true, bggId: { notIn: importedIds } } : { active: true },
          data: { active: false }
        });

        const count = await tx.game.count({ where: { active: true } });

        await tx.catalogSyncRun.update({
          where: { id: run.id },
          data: {
            status,
            completedAt: new Date(),
            importedCount: fetched.games.length,
            activeCount: count,
            error: fetched.warnings.length > 0 ? fetched.warnings.join("; ") : null
          }
        });

        return count;
      },
      {
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS
      }
    );

    return {
      status,
      importedCount: fetched.games.length,
      activeCount,
      runId: run.id,
      detailsRefreshedCount: fetched.detailsRefreshedCount,
      detailFailureCount: fetched.detailFailureCount,
      warnings: fetched.warnings
    };
  } catch (error) {
    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown BoardGameGeek sync error"
      }
    });

    throw error;
  }
}

export async function fetchBoardGameGeekCatalog(options: BggSyncOptions = {}): Promise<CatalogFetchResult> {
  const env = getServerEnv();
  const now = options.now?.() ?? new Date();
  const client = new BggXmlApiClient({
    apiToken: options.apiToken ?? env.BGG_API_TOKEN,
    fetchImpl: options.fetchImpl,
    sleep: options.delay,
    maxAttempts: options.maxAttempts,
    retryDelayMs: options.delayMs,
    maxRetryDelayMs: options.maxRetryDelayMs,
    batchDelayMs: options.delayMs,
    requestTimeoutMs: options.requestTimeoutMs
  });
  const snapshot = await client.getOwnedCollection(env.BGG_USERNAME, env.BGG_INCLUDE_EXPANSIONS);
  const collectionIds = snapshot.games.map((game) => game.bggId);
  const cachedGames =
    collectionIds.length > 0
      ? await prisma.game.findMany({
          where: { bggId: { in: collectionIds } },
          select: {
            bggId: true,
            name: true,
            yearPublished: true,
            imageUrl: true,
            thumbnailUrl: true,
            minPlayers: true,
            maxPlayers: true,
            playingTime: true,
            averageWeight: true,
            categories: true,
            mechanisms: true,
            families: true,
            designers: true,
            artists: true,
            isExpansion: true,
            metadataJson: true,
            parentGame: { select: { bggId: true } }
          }
        })
      : [];
  const cachedById = new Map(cachedGames.map((game) => [game.bggId, game]));
  const games = snapshot.games.map((game) => mergeCollectionGameWithCache(game, cachedById.get(game.bggId)));
  const detailCacheTtlMs = Math.max(0, options.detailCacheTtlMs ?? DEFAULT_DETAIL_CACHE_TTL_MS);
  const staleGames = games.filter((game) => !detailsAreFresh(game, now, detailCacheTtlMs));
  const detailResult = await client.getThingDetailsBatched(staleGames.map((game) => game.bggId));
  const fetchedAt = now.toISOString();
  const mergedGames = games.map((game) => {
    const detail = detailResult.details.get(game.bggId);
    return detail ? mergeThingDetails(game, detail, fetchedAt) : game;
  });

  return {
    games: mergedGames.filter((game) => env.BGG_INCLUDE_EXPANSIONS || !game.isExpansion),
    detailsRefreshedCount: detailResult.details.size,
    detailFailureCount: detailResult.failedIds.length,
    warnings: detailResult.warnings
  };
}

/** Compatibility helper for callers that only need the game list. */
export async function fetchBoardGameGeekGames(options: BggSyncOptions = {}): Promise<BggCollectionGame[]> {
  return (await fetchBoardGameGeekCatalog(options)).games;
}

export function mergeCollectionGameWithCache(
  collectionGame: BggCollectionGame,
  cachedGame?: CachedBggGame
): BggCollectionGame {
  if (!cachedGame) {
    return collectionGame;
  }

  const metadata = parseMetadataCache(cachedGame.metadataJson);

  return {
    ...collectionGame,
    name: collectionGame.name || cachedGame.name,
    yearPublished: collectionGame.yearPublished ?? cachedGame.yearPublished,
    imageUrl: collectionGame.imageUrl ?? cachedGame.imageUrl,
    thumbnailUrl: collectionGame.thumbnailUrl ?? cachedGame.thumbnailUrl,
    minPlayers: collectionGame.minPlayers ?? cachedGame.minPlayers,
    maxPlayers: collectionGame.maxPlayers ?? cachedGame.maxPlayers,
    playingTime: collectionGame.playingTime ?? cachedGame.playingTime,
    averageWeight: cachedGame.averageWeight,
    categories: cachedGame.categories,
    mechanisms: cachedGame.mechanisms,
    families: cachedGame.families,
    designers: cachedGame.designers,
    artists: cachedGame.artists,
    subtype: collectionGame.subtype ?? metadata.subtype,
    isExpansion: collectionGame.subtype === "boardgameexpansion" || cachedGame.isExpansion,
    parentBggIds: cachedGame.parentGame ? [cachedGame.parentGame.bggId] : [],
    detailsFetchedAt: metadata.detailsFetchedAt
  };
}

export function detailsAreFresh(game: BggCollectionGame, now: Date, ttlMs: number): boolean {
  if (!game.detailsFetchedAt || ttlMs <= 0) {
    return false;
  }

  const fetchedAt = Date.parse(game.detailsFetchedAt);

  if (!Number.isFinite(fetchedAt)) {
    return false;
  }

  const age = now.getTime() - fetchedAt;
  return age >= 0 && age < ttlMs;
}

export function mergeThingDetails(
  game: BggCollectionGame,
  detail: BggThingDetails,
  detailsFetchedAt: string
): BggCollectionGame {
  return {
    ...game,
    name: detail.name ?? game.name,
    yearPublished: detail.yearPublished ?? game.yearPublished,
    imageUrl: detail.imageUrl ?? game.imageUrl,
    thumbnailUrl: detail.thumbnailUrl ?? game.thumbnailUrl,
    minPlayers: detail.minPlayers ?? game.minPlayers,
    maxPlayers: detail.maxPlayers ?? game.maxPlayers,
    playingTime: detail.playingTime ?? game.playingTime,
    averageWeight: detail.averageWeight ?? game.averageWeight,
    categories: preferDetailValues(detail.categories, game.categories),
    mechanisms: preferDetailValues(detail.mechanisms, game.mechanisms),
    families: preferDetailValues(detail.families, game.families),
    designers: preferDetailValues(detail.designers, game.designers),
    artists: preferDetailValues(detail.artists, game.artists),
    subtype: detail.isExpansion ? "boardgameexpansion" : game.subtype,
    isExpansion: detail.isExpansion,
    parentBggIds: detail.parentBggIds,
    expansionBggIds: detail.expansionBggIds,
    detailsFetchedAt
  };
}

export async function getCatalogSummary() {
  const [games, latestSync] = await Promise.all([
    prisma.game.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    }),
    prisma.catalogSyncRun.findFirst({
      orderBy: { startedAt: "desc" }
    })
  ]);

  return {
    games,
    latestSync
  };
}

function persistedGameData(game: BggCollectionGame) {
  return {
    name: game.name,
    yearPublished: game.yearPublished,
    imageUrl: game.imageUrl,
    thumbnailUrl: game.thumbnailUrl,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playingTime: game.playingTime,
    averageWeight: game.averageWeight,
    categories: game.categories,
    mechanisms: game.mechanisms,
    families: game.families,
    designers: game.designers,
    artists: game.artists,
    isExpansion: game.isExpansion ?? false,
    metadataJson: JSON.stringify({
      subtype: game.subtype,
      source: game.source,
      detailsFetchedAt: game.detailsFetchedAt ?? null
    }),
    active: true
  };
}

function parseMetadataCache(value: string | null): { subtype: string | null; detailsFetchedAt: string | null } {
  if (!value) {
    return { subtype: null, detailsFetchedAt: null };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return { subtype: null, detailsFetchedAt: null };
    }

    return {
      subtype: typeof parsed.subtype === "string" ? parsed.subtype : null,
      detailsFetchedAt: typeof parsed.detailsFetchedAt === "string" ? parsed.detailsFetchedAt : null
    };
  } catch {
    return { subtype: null, detailsFetchedAt: null };
  }
}

function preferDetailValues(preferred: string[], fallback: string[]): string[] {
  return preferred.length > 0 ? preferred : fallback;
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
