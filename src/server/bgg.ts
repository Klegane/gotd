import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { XMLParser } from "fast-xml-parser";

import { prisma } from "@/server/db";
import { getServerEnv } from "@/server/env";

const BGG_ROOT = "https://boardgamegeek.com/xmlapi2";
const BGG_SITE_ROOT = "https://boardgamegeek.com";
const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_DETAIL_DELAY_MS = 1000;
const DEFAULT_DETAIL_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;
const execFileAsync = promisify(execFile);

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
  source: "geekcollection" | "xmlapi2";
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
  delayMs?: number;
  maxAttempts?: number;
  delay?: (ms: number) => Promise<void>;
};

type CollectionFetchResult =
  | { kind: "queued" }
  | { kind: "xml"; xml: string }
  | { kind: "html"; html: string }
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

export function buildGeekCollectionUrl(username: string, userId: string | undefined, includeExpansions: boolean): string {
  const url = new URL(`${BGG_SITE_ROOT}/geekcollection.php`);
  const params: Record<string, string> = {
    ajax: "1",
    action: "collectionpage",
    username,
    userid: userId ?? "",
    gallery: "",
    sort: "title",
    sortdir: "",
    page: "",
    pageID: "1",
    ff: "",
    hiddencolumns: "",
    publisherid: "",
    searchstr: "",
    rankobjecttype: "subtype",
    rankobjectid: "1",
    minrating: "",
    rating: "",
    minbggrating: "",
    bggrating: "",
    minplays: "",
    maxplays: "",
    minpricepaid: "",
    maxpricepaid: "",
    minvalue: "",
    maxvalue: "",
    mindate: "",
    dateinput: "",
    maxdate: "",
    searchfield: "title",
    geekranks: "Board Game Rank",
    subtype: "boardgame",
    own: "1",
    trade: "both",
    want: "both",
    wanttobuy: "both",
    prevowned: "both",
    comment: "both",
    wishlist: "both",
    rated: "both",
    played: "both",
    wanttoplay: "both",
    preordered: "both",
    hasparts: "both",
    wantparts: "both",
    wishlistpriority: "",
    direct: "1"
  };

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  for (const column of ["title", "status", "version", "rating", "bggrating", "plays", "comment", "commands"]) {
    url.searchParams.append("columns[]", column);
  }

  if (!includeExpansions) {
    url.searchParams.append("excludesubtype", "boardgameexpansion");
  }

  return url.toString();
}

export function buildThingDetailsUrl(ids: number[]): string {
  const url = new URL(`${BGG_ROOT}/thing`);
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("stats", "1");
  return url.toString();
}

export function buildGamePageUrl(id: number): string {
  return `${BGG_SITE_ROOT}/boardgame/${id}`;
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

  if (env.BGG_COLLECTION_URL) {
    const html = await fetchGeekCollectionHtml(env.BGG_COLLECTION_URL, options);
    return enrichGamesWithThingDetails(parseGeekCollectionHtml(html), options);
  }

  const html = await fetchGeekCollectionHtml(
    buildGeekCollectionUrl(env.BGG_USERNAME, env.BGG_USER_ID, env.BGG_INCLUDE_EXPANSIONS),
    options
  );
  const games = parseGeekCollectionHtml(html);

  if (games.length > 0) {
    return enrichGamesWithThingDetails(games, options);
  }

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
  let lastError = "BoardGameGeek collection export did not complete";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchCollectionOnce(fetchImpl, url);

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

export async function fetchGeekCollectionHtml(url: string, options: BggSyncOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError = "BoardGameGeek collection page did not load";

  if (!options.fetchImpl) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchGeekCollectionHtmlExternal(url);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "External BoardGameGeek request failed";

        if (attempt < maxAttempts) {
          await delay(delayMs);
        }
      }
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchGeekCollectionOnce(fetchImpl, url);

    if (result.kind === "html") {
      return result.html;
    }

    if (result.kind === "fatal-error") {
      throw new Error(result.message);
    }

    lastError =
      result.kind === "retryable-error"
        ? result.message
        : "BoardGameGeek collection page returned an unexpected response";

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

  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_DETAIL_DELAY_MS;
  const detailEntries = await fetchThingDetailEntries(games, options);

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];

    try {
      const html = await fetchGamePageHtml(buildGamePageUrl(game.bggId), options);
      const detail = parseGamePageDetailsHtml(html);

      if (detail) {
        const existing = detailEntries.get(detail.bggId);
        detailEntries.set(detail.bggId, existing ? mergeThingDetails(existing, detail) : detail);
      }
    } catch {
      // Keep the base catalog entry if BGG blocks or fails an individual detail page.
    }

    if (index < games.length - 1) {
      await delay(delayMs);
    }
  }

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
      // Public game pages below are a slower fallback if the XML detail endpoint is unavailable.
    }

    if (offset + DEFAULT_DETAIL_BATCH_SIZE < ids.length) {
      await delay(delayMs);
    }
  }

  return detailEntries;
}

function mergeThingDetails(base: BggThingDetails, override: BggThingDetails): BggThingDetails {
  return {
    bggId: override.bggId,
    name: override.name ?? base.name,
    yearPublished: override.yearPublished ?? base.yearPublished,
    imageUrl: override.imageUrl ?? base.imageUrl,
    thumbnailUrl: override.thumbnailUrl ?? base.thumbnailUrl,
    minPlayers: override.minPlayers ?? base.minPlayers,
    maxPlayers: override.maxPlayers ?? base.maxPlayers,
    playingTime: override.playingTime ?? base.playingTime,
    averageWeight: override.averageWeight ?? base.averageWeight,
    categories: preferMetadataValues(override.categories, base.categories),
    mechanisms: preferMetadataValues(override.mechanisms, base.mechanisms),
    families: preferMetadataValues(override.families, base.families),
    designers: preferMetadataValues(override.designers, base.designers),
    artists: preferMetadataValues(override.artists, base.artists),
    isExpansion: override.isExpansion || base.isExpansion,
    parentBggIds: preferNumberValues(override.parentBggIds, base.parentBggIds),
    expansionBggIds: preferNumberValues(override.expansionBggIds, base.expansionBggIds)
  };
}

function preferMetadataValues(preferred: string[], fallback: string[]): string[] {
  return preferred.length > 0 ? preferred : fallback;
}

function preferNumberValues(preferred: number[], fallback: number[]): number[] {
  return preferred.length > 0 ? preferred : fallback;
}

export async function fetchGamePageHtml(url: string, options: BggSyncOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError = "BoardGameGeek game page did not load";

  if (!options.fetchImpl) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchGamePageHtmlExternal(url);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "External BoardGameGeek game page request failed";

        if (attempt < maxAttempts) {
          await delay(delayMs);
        }
      }
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchGamePageOnce(fetchImpl, url);

    if (result.kind === "html") {
      return result.html;
    }

    if (result.kind === "fatal-error") {
      throw new Error(result.message);
    }

    lastError =
      result.kind === "retryable-error"
        ? result.message
        : "BoardGameGeek game page returned an unexpected response";

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(lastError);
}

export async function fetchThingDetailsXml(ids: number[], options: BggSyncOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? sleep;
  const delayMs = options.delayMs ?? DEFAULT_RETRY_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const url = buildThingDetailsUrl(ids);
  let lastError = "BoardGameGeek thing details did not load";

  if (!options.fetchImpl) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchBoardGameGeekXmlExternal(url);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "External BoardGameGeek thing details request failed";

        if (attempt < maxAttempts) {
          await delay(delayMs);
        }
      }
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchCollectionOnce(fetchImpl, url);

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

async function fetchGeekCollectionHtmlExternal(url: string): Promise<string> {
  return fetchTextWithExternalClients(url, {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    requireIncludes: "/boardgame/"
  });
}

async function fetchBoardGameGeekXmlExternal(url: string): Promise<string> {
  return fetchTextWithExternalClients(url, {
    accept: "application/xml,text/xml,*/*;q=0.8",
    requireIncludes: "<items"
  });
}

async function fetchGamePageHtmlExternal(url: string): Promise<string> {
  return fetchTextWithExternalClients(url, {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    requireIncludes: "GEEK.geekitemPreload"
  });
}

async function fetchTextWithExternalClients(
  url: string,
  options: { accept: string; requireIncludes: string }
): Promise<string> {
  const attempts: Array<{ command: string; args: string[] }> = [
    {
      command: "curl",
      args: [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "-A",
        browserUserAgent(),
        "-H",
        `Accept: ${options.accept}`,
        "-H",
        "X-Requested-With: XMLHttpRequest",
        "-H",
        "Referer: https://boardgamegeek.com/collection/user/",
        url
      ]
    },
    {
      command: "curl.exe",
      args: [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "-A",
        browserUserAgent(),
        "-H",
        `Accept: ${options.accept}`,
        "-H",
        "X-Requested-With: XMLHttpRequest",
        "-H",
        "Referer: https://boardgamegeek.com/collection/user/",
        url
      ]
    },
    {
      command: "wget",
      args: [
        "--quiet",
        "--output-document=-",
        `--user-agent=${browserUserAgent()}`,
        `--header=Accept: ${options.accept}`,
        "--header=X-Requested-With: XMLHttpRequest",
        "--header=Referer: https://boardgamegeek.com/collection/user/",
        url
      ]
    }
  ];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const { stdout } = await execFileAsync(attempt.command, attempt.args, {
        maxBuffer: 10 * 1024 * 1024
      });

      if (stdout.includes(options.requireIncludes)) {
        return stdout;
      }

      errors.push(`${attempt.command}: response did not include ${options.requireIncludes}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push(`${attempt.command}: ${message}`);
    }
  }

  throw new Error(`Unable to fetch BoardGameGeek collection with external clients: ${errors.join("; ")}`);
}

export async function fetchCollectionOnce(fetchImpl: typeof fetch, url: string): Promise<CollectionFetchResult> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/xml,text/xml"
    }
  });

  if (response.status === 202) {
    return { kind: "queued" };
  }

  if (response.status === 500 || response.status === 503) {
    return {
      kind: "retryable-error",
      message: `BoardGameGeek is busy (${response.status})`
    };
  }

  if (!response.ok) {
    return {
      kind: "fatal-error",
      message: `BoardGameGeek request failed (${response.status})`
    };
  }

  return { kind: "xml", xml: await response.text() };
}

export async function fetchGeekCollectionOnce(fetchImpl: typeof fetch, url: string): Promise<CollectionFetchResult> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${BGG_SITE_ROOT}/collection/user/`,
      "User-Agent": browserUserAgent(),
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (response.status === 500 || response.status === 503) {
    return {
      kind: "retryable-error",
      message: `BoardGameGeek is busy (${response.status})`
    };
  }

  if (!response.ok) {
    return {
      kind: "fatal-error",
      message: `BoardGameGeek collection page request failed (${response.status})`
    };
  }

  return { kind: "html", html: await response.text() };
}

export async function fetchGamePageOnce(fetchImpl: typeof fetch, url: string): Promise<CollectionFetchResult> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${BGG_SITE_ROOT}/collection/user/`,
      "User-Agent": browserUserAgent()
    }
  });

  if (response.status === 500 || response.status === 503) {
    return {
      kind: "retryable-error",
      message: `BoardGameGeek is busy (${response.status})`
    };
  }

  if (!response.ok) {
    return {
      kind: "fatal-error",
      message: `BoardGameGeek game page request failed (${response.status})`
    };
  }

  return { kind: "html", html: await response.text() };
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

export function parseGamePageDetailsHtml(html: string): BggThingDetails | null {
  const match = html.match(/GEEK\.geekitemPreload\s*=\s*(?<json>\{[\s\S]*?\});\s*GEEK\.geekitemSettings/i);
  const json = match?.groups?.json;

  if (!json) {
    return null;
  }

  const parsed = JSON.parse(json) as unknown;
  const item = isRecord(parsed) && isRecord(parsed.item) ? parsed.item : null;

  if (!item) {
    return null;
  }

  const images = isRecord(item.images) ? item.images : {};
  const polls = isRecord(item.polls) ? item.polls : {};
  const weightPoll = isRecord(polls.boardgameweight) ? polls.boardgameweight : {};
  const stats = isRecord(item.stats) ? item.stats : {};
  const bggId = toNumber(item.objectid) ?? toNumber(item.id);

  if (!bggId) {
    return null;
  }

  const linkedItems = Array.isArray(item.linkedItems) ? item.linkedItems : isRecord(item.linkedItems) ? [item.linkedItems] : [];
  const subtype = toText(item.subtype);
  const isExpansion = subtype === "boardgameexpansion";
  const parentBggIds: number[] = [];
  const expansionBggIds: number[] = [];
  const metadata = extractMetadataLinks(item);

  for (const linked of linkedItems) {
    if (!isRecord(linked)) continue;
    const linkedId = toNumber(linked.objectid) ?? toNumber(linked.id);
    const linkType = toText(linked.linktype) ?? toText(linked.type);
    if (!linkedId) continue;
    if (linkType === "boardgameexpansion") {
      expansionBggIds.push(linkedId);
    } else if (linkType === "boardgameintegration" || linkType === "expandsboardgame") {
      parentBggIds.push(linkedId);
    }
  }

  return {
    bggId,
    name: toText(item.name),
    yearPublished: toNumber(item.yearpublished),
    imageUrl: toText(item.imageurl) ?? toText(images.original),
    thumbnailUrl: toText(images.thumb) ?? toText(images.previewthumb) ?? toText(item.imageurl),
    minPlayers: toNumber(item.minplayers),
    maxPlayers: toNumber(item.maxplayers),
    playingTime: toNumber(item.maxplaytime) ?? toNumber(item.minplaytime),
    averageWeight: toFloat(weightPoll.averageweight) ?? toFloat(stats.avgweight),
    ...metadata,
    isExpansion,
    parentBggIds,
    expansionBggIds
  };
}

export function parseGeekCollectionHtml(html: string): BggCollectionGame[] {
  const linkPattern = /<a\s+href=["']\/boardgame\/(?<id>\d+)\/[^"']+["'][^>]*class=["']primary["'][^>]*>(?<name>[\s\S]*?)<\/a>/gi;
  const games = new Map<number, BggCollectionGame>();
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const bggId = Number.parseInt(match.groups?.id ?? "", 10);
    const name = decodeHtml(stripTags(match.groups?.name ?? ""));

    if (!Number.isFinite(bggId) || !name || games.has(bggId)) {
      continue;
    }

    const afterLink = html.slice(match.index + match[0].length, match.index + match[0].length + 700);
    const yearMatch = afterLink.match(/<span[^>]*class=["'][^"']*smallerfont[^"']*["'][^>]*>\s*\((?<year>\d{4})\)\s*<\/span>/i);

    games.set(bggId, {
      bggId,
      name,
      yearPublished: yearMatch?.groups?.year ? Number.parseInt(yearMatch.groups.year, 10) : null,
      imageUrl: null,
      thumbnailUrl: null,
      minPlayers: null,
      maxPlayers: null,
      playingTime: null,
      averageWeight: null,
      ...emptyMetadataFields(),
      subtype: "boardgame",
      source: "geekcollection"
    });
  }

  return [...games.values()];
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
    parentBggIds: [],
    expansionBggIds: []
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

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
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

function browserUserAgent(): string {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
