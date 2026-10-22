import { XMLParser } from "fast-xml-parser";

import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";

const BGG_ROOT = "https://boardgamegeek.com/xmlapi2";
const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_DETAIL_DELAY_MS = 5000;
const DEFAULT_DETAIL_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;

export type BggCollectionGame = {
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
  subtype: string | null;
  source: "xmlapi2";
  isExpansion?: boolean;
  parentBggIds?: number[];
  expansionBggIds?: number[];
};

export type BggThingDetails = {
  bggId: number;
  name: string | null;
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
  parentBggIds: number[];
  expansionBggIds: number[];
};

export type BggSyncResult = {
  status: "success";
  importedCount: number;
  activeCount: number;
  runId: string;
};

export type BggSyncOptions = {
  fetchImpl?: typeof fetch;
  apiToken?: string;
  delayMs?: number;
  maxAttempts?: number;
  delay?: (ms: number) => Promise<void>;
};

type CollectionFetchResult =
  | { kind: "queued" }
  | { kind: "xml"; xml: string }
  | { kind: "retryable-error"; message: string }
  | { kind: "fatal-error"; message: string };

type MetadataFacet = "categories" | "mechanisms" | "families" | "designers" | "artists";

type GameMetadataFields = Record<MetadataFacet, string[]>;

const metadataLinkTypes: Record<string, MetadataFacet> = {
  boardgamecategory: "categories",
  boardgamemechanic: "mechanisms",
  boardgamefamily: "families",
  boardgamedesigner: "designers",
  boardgameartist: "artists"
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: true
});

export function buildCollectionUrl(username: string, includeExpansions: boolean): string {
  const url = new URL(`${BGG_ROOT}/collection`);
  url.searchParams.set("username", username);
  url.searchParams.set("own", "1");
  url.searchParams.set("subtype", "boardgame");
  url.searchParams.set("stats", "1");

  if (!includeExpansions) {
    url.searchParams.set("excludesubtype", "boardgameexpansion");
  }

  return url.toString();
}

export function buildThingDetailsUrl(ids: number[]): string {
  const url = new URL(`${BGG_ROOT}/thing`);
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("stats", "1");
  return url.toString();
}

export async function syncBoardGameGeekCatalog(options: BggSyncOptions = {}): Promise<BggSyncResult> {
  const env = getServerEnv();
  const run = await prisma.catalogSyncRun.create({
    data: {
      sourceUsername: env.BGG_USERNAME,
      status: "pending"
    }
  });

  try {
    const games = await fetchBoardGameGeekGames(options);

    const result = await prisma.$transaction(async (tx) => {
      const importedIds = games.map((game) => game.bggId);

      for (const game of games) {
        await tx.game.upsert({
          where: { bggId: game.bggId },
          update: {
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
            metadataJson: JSON.stringify({ subtype: game.subtype, source: game.source }),
            active: true
          },
          create: {
            bggId: game.bggId,
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
            metadataJson: JSON.stringify({ subtype: game.subtype, source: game.source }),
            active: true
          }
        });
      }

      if (importedIds.length > 0) {
        await tx.game.updateMany({
          where: {
            active: true,
            bggId: {
              notIn: importedIds
            }
          },
          data: { active: false }
        });
      } else {
        await tx.game.updateMany({
          where: { active: true },
          data: { active: false }
        });
      }

      const activeCount = await tx.game.count({ where: { active: true } });

      await tx.catalogSyncRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          completedAt: new Date(),
          importedCount: games.length,
          activeCount
        }
      });

      return activeCount;
    });

    // Resolve parent-child expansion relationships after the main transaction
    for (const game of games) {
      if (game.parentBggIds && game.parentBggIds.length > 0) {
        const parentGame = await prisma.game.findFirst({
          where: { bggId: { in: game.parentBggIds } },
          select: { id: true }
        });

        if (parentGame) {
          await prisma.game.updateMany({
            where: { bggId: game.bggId },
            data: { parentGameId: parentGame.id }
          });
        }
      }
    }

    return {
      status: "success",
      importedCount: games.length,
      activeCount: result,
      runId: run.id
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

export async function fetchBoardGameGeekGames(options: BggSyncOptions = {}): Promise<BggCollectionGame[]> {
  const env = getServerEnv();
  const xml = await fetchCollectionXml(env.BGG_USERNAME, env.BGG_INCLUDE_EXPANSIONS, options);
  return enrichGamesWithThingDetails(parseCollectionXml(xml, env.BGG_INCLUDE_EXPANSIONS), options);
}

export async function fetchCollectionXml(
  username: string,
  includeExpansions: boolean,
  options: BggSyncOptions = {}
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const url = buildCollectionUrl(username, includeExpansions);
  const apiToken = getApiToken(options);
  let lastError = "BoardGameGeek collection export did not complete";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchCollectionOnce(fetchImpl, url, apiToken);

    if (result.kind === "xml") {
      return result.xml;
    }

    if (result.kind === "fatal-error") {
      throw new Error(result.message);
    }

    lastError =
      result.kind === "queued"
        ? "BoardGameGeek queued the collection export"
        : result.kind === "retryable-error"
          ? result.message
          : "BoardGameGeek collection export returned an unexpected response";

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(lastError);
}

export async function enrichGamesWithThingDetails(
  games: BggCollectionGame[],
  options: BggSyncOptions = {}
): Promise<BggCollectionGame[]> {
  if (games.length === 0) {
    return games;
  }

  const detailEntries = await fetchThingDetailEntries(games, options);

  return games.map((game) => {
    const detail = detailEntries.get(game.bggId);

    if (!detail) {
      return game;
    }

    return {
      ...game,
      name: game.name || detail.name || game.name,
      yearPublished: game.yearPublished ?? detail.yearPublished,
      imageUrl: detail.imageUrl ?? game.imageUrl,
      thumbnailUrl: detail.thumbnailUrl ?? game.thumbnailUrl,
      minPlayers: detail.minPlayers ?? game.minPlayers,
      maxPlayers: detail.maxPlayers ?? game.maxPlayers,
      playingTime: detail.playingTime ?? game.playingTime,
      averageWeight: detail.averageWeight ?? game.averageWeight,
      categories: preferMetadataValues(detail.categories, game.categories),
      mechanisms: preferMetadataValues(detail.mechanisms, game.mechanisms),
      families: preferMetadataValues(detail.families, game.families),
      designers: preferMetadataValues(detail.designers, game.designers),
      artists: preferMetadataValues(detail.artists, game.artists),
      isExpansion: detail.isExpansion,
      parentBggIds: detail.parentBggIds,
      expansionBggIds: detail.expansionBggIds
    };
  });
}

async function fetchThingDetailEntries(
  games: BggCollectionGame[],
  options: BggSyncOptions
): Promise<Map<number, BggThingDetails>> {
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_DETAIL_DELAY_MS;
  const detailEntries = new Map<number, BggThingDetails>();
  const ids = games.map((game) => game.bggId);

  for (let offset = 0; offset < ids.length; offset += DEFAULT_DETAIL_BATCH_SIZE) {
    const batchIds = ids.slice(offset, offset + DEFAULT_DETAIL_BATCH_SIZE);

    try {
      const xml = await fetchThingDetailsXml(batchIds, options);

      for (const detail of parseThingDetailsXml(xml)) {
        detailEntries.set(detail.bggId, detail);
      }
    } catch {
      // Collection data remains usable if an optional detail batch is temporarily unavailable.
    }

    if (offset + DEFAULT_DETAIL_BATCH_SIZE < ids.length) {
      await delay(delayMs);
    }
  }

  return detailEntries;
}

function preferMetadataValues(preferred: string[], fallback: string[]): string[] {
  return preferred.length > 0 ? preferred : fallback;
}


export async function fetchThingDetailsXml(ids: number[], options: BggSyncOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const url = buildThingDetailsUrl(ids);
  const apiToken = getApiToken(options);
  let lastError = "BoardGameGeek thing details did not load";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchCollectionOnce(fetchImpl, url, apiToken);

    if (result.kind === "xml") {
      return result.xml;
    }

    if (result.kind === "fatal-error") {
      throw new Error(result.message);
    }

    lastError =
      result.kind === "queued"
        ? "BoardGameGeek queued the thing details export"
        : result.kind === "retryable-error"
          ? result.message
          : "BoardGameGeek thing details returned an unexpected response";

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(lastError);
}

export async function fetchCollectionOnce(
  fetchImpl: typeof fetch,
  url: string,
  apiToken: string
): Promise<CollectionFetchResult> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/xml,text/xml",
      Authorization: `Bearer ${apiToken}`
    }
  });

  if (response.status === 202) {
    return { kind: "queued" };
  }

  if ([429, 500, 502, 503, 504].includes(response.status)) {
    return {
      kind: "retryable-error",
      message: `BoardGameGeek is busy (${response.status})`
    };
  }

  if (!response.ok) {
    return {
      kind: "fatal-error",
      message:
        response.status === 401 || response.status === 403
          ? `BoardGameGeek authentication failed (${response.status}); check BGG_API_TOKEN`
          : `BoardGameGeek request failed (${response.status})`
    };
  }

  return { kind: "xml", xml: await response.text() };
}

export function parseCollectionXml(xml: string, includeExpansions: boolean): BggCollectionGame[] {
  const parsed = parser.parse(xml);
  const items = toArray(parsed?.items?.item);

  return items
    .map((item) => parseCollectionItem(item))
    .filter((game): game is BggCollectionGame => {
      if (!game) {
        return false;
      }

      return includeExpansions || game.subtype !== "boardgameexpansion";
    });
}

export function parseThingDetailsXml(xml: string): BggThingDetails[] {
  const parsed = parser.parse(xml);
  const items = toArray(parsed?.items?.item);

  return items
    .map((item) => parseThingDetailsItem(item))
    .filter((detail): detail is BggThingDetails => Boolean(detail));
}

function parseCollectionItem(item: Record<string, unknown>): BggCollectionGame | null {
  const bggId = toNumber(item.objectid);
  const name = toText(item.name);

  if (!bggId || !name) {
    return null;
  }

  const stats = isRecord(item.stats) ? item.stats : {};

  return {
    bggId,
    name,
    yearPublished: toNumber(item.yearpublished),
    imageUrl: toText(item.image),
    thumbnailUrl: toText(item.thumbnail),
    minPlayers: toNumber(stats.minplayers),
    maxPlayers: toNumber(stats.maxplayers),
    playingTime: toNumber(stats.playingtime),
    averageWeight: null,
    ...emptyMetadataFields(),
    subtype: toText(item.subtype),
    source: "xmlapi2"
  };
}

function parseThingDetailsItem(item: Record<string, unknown>): BggThingDetails | null {
  const bggId = toNumber(item.id);

  if (!bggId) {
    return null;
  }

  const itemType = toText(item.type);
  const isExpansion = itemType === "boardgameexpansion";
  const metadata = extractMetadataLinks(item);
  const parentBggIds: number[] = [];
  const expansionBggIds: number[] = [];

  for (const link of toArray(item.link)) {
    if (!isRecord(link) || toText(link.type) !== "boardgameexpansion") {
      continue;
    }

    const linkedId = toNumber(link.id);

    if (!linkedId) {
      continue;
    }

    if (toText(link.inbound) === "true") {
      parentBggIds.push(linkedId);
    } else {
      expansionBggIds.push(linkedId);
    }
  }

  return {
    bggId,
    name: getPrimaryThingName(item.name),
    yearPublished: toNumber(item.yearpublished),
    imageUrl: toText(item.image),
    thumbnailUrl: toText(item.thumbnail),
    minPlayers: toNumber(item.minplayers),
    maxPlayers: toNumber(item.maxplayers),
    playingTime: toNumber(item.playingtime),
    averageWeight: getAverageWeight(item),
    ...metadata,
    isExpansion,
    parentBggIds,
    expansionBggIds
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

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (isRecord(value)) {
    if (typeof value.value === "string" || typeof value.value === "number") {
      return String(value.value).trim() || null;
    }

    const text = value.text;
    return typeof text === "string" ? text.trim() || null : null;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  const text = toText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value: unknown): number | null {
  const text = toText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPrimaryThingName(value: unknown): string | null {
  const names = toArray(value);

  for (const name of names) {
    if (isRecord(name) && name.type === "primary") {
      return toText(name);
    }
  }

  return toText(names[0]);
}

function getAverageWeight(item: Record<string, unknown>): number | null {
  const statistics = isRecord(item.statistics) ? item.statistics : null;
  const ratings = statistics && isRecord(statistics.ratings) ? statistics.ratings : null;
  return ratings ? toFloat(ratings.averageweight) : null;
}

function emptyMetadataFields(): GameMetadataFields {
  return {
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: []
  };
}

function extractMetadataLinks(item: Record<string, unknown>): GameMetadataFields {
  const metadata = emptyMetadataFields();
  const seen: Record<MetadataFacet, Set<string>> = {
    categories: new Set(),
    mechanisms: new Set(),
    families: new Set(),
    designers: new Set(),
    artists: new Set()
  };

  function addLabel(facet: MetadataFacet, value: unknown) {
    const label = toText(value);

    if (!label) {
      return;
    }

    const key = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");

    if (seen[facet].has(key)) {
      return;
    }

    seen[facet].add(key);
    metadata[facet].push(label);
  }

  function collect(value: unknown, typeHint?: string) {
    if (Array.isArray(value)) {
      for (const child of value) {
        collect(child, typeHint);
      }
      return;
    }

    if (!isRecord(value)) {
      if (typeHint) {
        const facet = metadataLinkTypes[typeHint.toLocaleLowerCase("en-US")];

        if (facet) {
          addLabel(facet, value);
        }
      }
      return;
    }

    const linkType = typeHint ?? toText(value.type) ?? toText(value.linktype);
    const facet = linkType ? metadataLinkTypes[linkType.toLocaleLowerCase("en-US")] : undefined;

    if (facet) {
      addLabel(facet, toText(value.value) ?? toText(value.name) ?? toText(value.title));
    }

    for (const [key, child] of Object.entries(value)) {
      if (metadataLinkTypes[key.toLocaleLowerCase("en-US")]) {
        collect(child, key);
      }
    }
  }

  collect(item.link);
  collect(item.links);
  collect(item.linkedItems);

  return metadata;
}

function getApiToken(options: BggSyncOptions): string {
  return options.apiToken ?? getServerEnv().BGG_API_TOKEN;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
