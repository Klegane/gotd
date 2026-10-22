import { randomUUID } from "node:crypto";

import type { CatalogSyncRun } from "@prisma/client";

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
export const CATALOG_SYNC_LEASE_TIMEOUT_MS = 2 * 60 * 1000;
const ACTIVE_SYNC_STATUSES = ["queued", "running"] as const;

export type CatalogSyncStatus = "queued" | "running" | "success" | "partial" | "failed";

export type CatalogSyncJob = {
  id: string;
  sourceUsername: string;
  status: CatalogSyncStatus;
  startedAt: Date;
  claimedAt: Date | null;
  heartbeatAt: Date | null;
  completedAt: Date | null;
  attemptCount: number;
  importedCount: number;
  activeCount: number;
  detailsRefreshedCount: number;
  detailFailureCount: number;
  warnings: string[];
  error: string | null;
};

export type EnqueuedCatalogSync = {
  run: CatalogSyncJob;
  created: boolean;
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

export async function enqueueCatalogSync(requestedByUserId: string): Promise<EnqueuedCatalogSync> {
  const env = getServerEnv();
  const active = await prisma.catalogSyncRun.findFirst({
    where: { status: { in: [...ACTIVE_SYNC_STATUSES] } },
    orderBy: { startedAt: "asc" }
  });

  if (active) {
    return { run: toCatalogSyncJob(active), created: false };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateId = randomUUID();
    const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "CatalogSyncRun" (
        "id", "sourceUsername", "status", "startedAt", "requestedByUserId"
      )
      VALUES (
        ${candidateId}, ${env.BGG_USERNAME}, 'queued', CURRENT_TIMESTAMP, ${requestedByUserId}
      )
      ON CONFLICT DO NOTHING
      RETURNING "id"
    `;

    if (inserted.length > 0) {
      const run = await prisma.catalogSyncRun.findUniqueOrThrow({ where: { id: candidateId } });
      return { run: toCatalogSyncJob(run), created: true };
    }

    const concurrentRun = await prisma.catalogSyncRun.findFirst({
      where: { status: { in: [...ACTIVE_SYNC_STATUSES] } },
      orderBy: { startedAt: "asc" }
    });

    if (concurrentRun) {
      return { run: toCatalogSyncJob(concurrentRun), created: false };
    }
  }

  throw new Error("Could not enqueue the BoardGameGeek catalog refresh");
}

export async function claimNextCatalogSyncRun(
  workerId: string,
  leaseTimeoutMs = CATALOG_SYNC_LEASE_TIMEOUT_MS,
  now = new Date()
): Promise<string | null> {
  const staleBefore = new Date(now.getTime() - leaseTimeoutMs);
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "CatalogSyncRun"
    SET
      "status" = 'running',
      "claimedAt" = CURRENT_TIMESTAMP,
      "heartbeatAt" = CURRENT_TIMESTAMP,
      "completedAt" = NULL,
      "workerId" = ${workerId},
      "attemptCount" = "attemptCount" + 1,
      "error" = NULL
    WHERE "id" = (
      SELECT "id"
      FROM "CatalogSyncRun"
      WHERE
        "status" = 'queued'
        OR (
          "status" = 'running'
          AND ("heartbeatAt" IS NULL OR "heartbeatAt" < ${staleBefore})
        )
      ORDER BY "startedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id"
  `;

  return claimed[0]?.id ?? null;
}

export async function heartbeatCatalogSyncRun(runId: string, workerId: string): Promise<boolean> {
  const result = await prisma.catalogSyncRun.updateMany({
    where: { id: runId, workerId, status: "running" },
    data: { heartbeatAt: new Date() }
  });

  return result.count === 1;
}

export async function executeCatalogSyncRun(
  runId: string,
  workerId: string,
  options: BggSyncOptions = {}
): Promise<CatalogSyncJob> {
  try {
    const fetched = await fetchBoardGameGeekCatalog(options);
    const status = fetched.warnings.length > 0 ? "partial" : "success";

    await prisma.$transaction(
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

        const completed = await tx.catalogSyncRun.updateMany({
          where: { id: runId, workerId, status: "running" },
          data: {
            status,
            completedAt: new Date(),
            heartbeatAt: new Date(),
            workerId: null,
            importedCount: fetched.games.length,
            activeCount: count,
            detailsRefreshedCount: fetched.detailsRefreshedCount,
            detailFailureCount: fetched.detailFailureCount,
            warningsJson: JSON.stringify(fetched.warnings),
            error: fetched.warnings.length > 0 ? fetched.warnings.join("; ") : null
          }
        });

        if (completed.count !== 1) {
          throw new Error("Catalog sync lease was lost before completion");
        }

        return count;
      },
      {
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS
      }
    );

    const completedRun = await prisma.catalogSyncRun.findUniqueOrThrow({ where: { id: runId } });
    return toCatalogSyncJob(completedRun);
  } catch (error) {
    await prisma.catalogSyncRun.updateMany({
      where: { id: runId, workerId, status: "running" },
      data: {
        status: "failed",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        workerId: null,
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
    latestSync: latestSync ? toCatalogSyncJob(latestSync) : null
  };
}

export async function getCatalogSyncJob(runId: string): Promise<CatalogSyncJob | null> {
  const run = await prisma.catalogSyncRun.findUnique({ where: { id: runId } });
  return run ? toCatalogSyncJob(run) : null;
}

export function toCatalogSyncJob(run: CatalogSyncRun): CatalogSyncJob {
  return {
    id: run.id,
    sourceUsername: run.sourceUsername,
    status: normalizeCatalogSyncStatus(run.status),
    startedAt: run.startedAt,
    claimedAt: run.claimedAt,
    heartbeatAt: run.heartbeatAt,
    completedAt: run.completedAt,
    attemptCount: run.attemptCount,
    importedCount: run.importedCount,
    activeCount: run.activeCount,
    detailsRefreshedCount: run.detailsRefreshedCount,
    detailFailureCount: run.detailFailureCount,
    warnings: parseWarnings(run.warningsJson),
    error: run.error
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

function normalizeCatalogSyncStatus(status: string): CatalogSyncStatus {
  if (status === "queued" || status === "running" || status === "success" || status === "partial") {
    return status;
  }

  return "failed";
}

function parseWarnings(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
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
