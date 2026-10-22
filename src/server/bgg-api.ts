import { XMLParser, XMLValidator } from "fast-xml-parser";

const BGG_API_ROOT = "https://boardgamegeek.com/xmlapi2";
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_MAX_RETRY_DELAY_MS = 30000;
const DEFAULT_BATCH_DELAY_MS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const THING_BATCH_SIZE = 20;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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
  detailsFetchedAt?: string | null;
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

export type BggCollectionSnapshot = {
  games: BggCollectionGame[];
  totalItems: number;
};

export type BggDetailBatchResult = {
  details: Map<number, BggThingDetails>;
  failedIds: number[];
  warnings: string[];
};

export type BggApiErrorCode =
  | "authentication"
  | "api-error"
  | "http"
  | "invalid-request"
  | "invalid-xml"
  | "network"
  | "queued"
  | "timeout"
  | "unavailable";

export class BggApiError extends Error {
  constructor(
    message: string,
    public readonly code: BggApiErrorCode,
    public readonly retryable: boolean,
    public readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "BggApiError";
  }
}

export type BggApiClientOptions = {
  apiToken: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  batchDelayMs?: number;
  requestTimeoutMs?: number;
};

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

export class BggXmlApiClient {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly batchDelayMs: number;
  private readonly requestTimeoutMs: number;

  constructor(options: BggApiClientOptions) {
    const apiToken = options.apiToken.trim();

    if (!apiToken) {
      throw new BggApiError("BGG_API_TOKEN is required", "invalid-request", false);
    }

    this.apiToken = apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    this.maxRetryDelayMs = Math.max(this.retryDelayMs, options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS);
    this.batchDelayMs = Math.max(0, options.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS);
    this.requestTimeoutMs = Math.max(1, options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  }

  async getOwnedCollection(username: string, includeExpansions: boolean): Promise<BggCollectionSnapshot> {
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      throw new BggApiError("BGG_USERNAME is required", "invalid-request", false);
    }

    const xml = await this.requestXml(buildCollectionUrl(normalizedUsername, includeExpansions));
    return parseCollectionSnapshotXml(xml, includeExpansions);
  }

  async getThingDetails(ids: number[]): Promise<BggThingDetails[]> {
    const normalizedIds = uniquePositiveIds(ids);

    if (normalizedIds.length === 0) {
      return [];
    }

    if (normalizedIds.length > THING_BATCH_SIZE) {
      throw new BggApiError(
        `BoardGameGeek thing requests support at most ${THING_BATCH_SIZE} ids`,
        "invalid-request",
        false
      );
    }

    const xml = await this.requestXml(buildThingDetailsUrl(normalizedIds));
    return parseThingDetailsXml(xml);
  }

  async getThingDetailsBatched(ids: number[]): Promise<BggDetailBatchResult> {
    const normalizedIds = uniquePositiveIds(ids);
    const details = new Map<number, BggThingDetails>();
    const failedIds: number[] = [];
    const warnings: string[] = [];

    for (let offset = 0; offset < normalizedIds.length; offset += THING_BATCH_SIZE) {
      const batchIds = normalizedIds.slice(offset, offset + THING_BATCH_SIZE);

      try {
        const batchDetails = await this.getThingDetails(batchIds);

        for (const detail of batchDetails) {
          details.set(detail.bggId, detail);
        }

        const missingIds = batchIds.filter((id) => !details.has(id));

        if (missingIds.length > 0) {
          failedIds.push(...missingIds);
          warnings.push(`BoardGameGeek omitted details for ${missingIds.length} catalog item(s)`);
        }
      } catch (error) {
        if (!(error instanceof BggApiError) || !error.retryable) {
          throw error;
        }

        failedIds.push(...batchIds);
        warnings.push(`Could not refresh details for ${batchIds.length} catalog item(s): ${error.message}`);
      }

      if (offset + THING_BATCH_SIZE < normalizedIds.length) {
        await this.sleep(this.batchDelayMs);
      }
    }

    return {
      details,
      failedIds,
      warnings
    };
  }

  private async requestXml(url: string): Promise<string> {
    let lastError = new BggApiError("BoardGameGeek request did not complete", "unavailable", true);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;

      try {
        response = await this.fetchWithTimeout(url);
      } catch (error) {
        lastError = normalizeTransportError(error);

        if (!lastError.retryable || attempt === this.maxAttempts) {
          throw lastError;
        }

        await this.sleep(this.retryDelayForAttempt(attempt));
        continue;
      }

      // BGG answers with 202 while it prepares a collection export. A 202 is
      // technically "ok" to fetch, but it is not a usable XML payload yet.
      if (response.status === 202) {
        lastError = errorForResponse(response);

        if (attempt === this.maxAttempts) {
          throw lastError;
        }

        await this.sleep(retryAfterMs(response) ?? this.retryDelayForAttempt(attempt));
        continue;
      }

      if (response.ok) {
        const xml = await response.text();
        validateBggXml(xml);
        return xml;
      }

      const responseError = errorForResponse(response);
      lastError = responseError;

      if (!responseError.retryable || attempt === this.maxAttempts) {
        throw responseError;
      }

      await this.sleep(retryAfterMs(response) ?? this.retryDelayForAttempt(attempt));
    }

    throw lastError;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await this.fetchImpl(url, {
        cache: "no-store",
        headers: {
          Accept: "application/xml,text/xml",
          Authorization: `Bearer ${this.apiToken}`
        },
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new BggApiError(
          `BoardGameGeek request timed out after ${this.requestTimeoutMs} ms`,
          "timeout",
          true,
          undefined,
          { cause: error }
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private retryDelayForAttempt(attempt: number): number {
    return Math.min(this.retryDelayMs * 2 ** Math.max(0, attempt - 1), this.maxRetryDelayMs);
  }
}

export function buildCollectionUrl(username: string, includeExpansions: boolean): string {
  const url = new URL(`${BGG_API_ROOT}/collection`);
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
  const url = new URL(`${BGG_API_ROOT}/thing`);
  url.searchParams.set("id", uniquePositiveIds(ids).join(","));
  url.searchParams.set("stats", "1");
  return url.toString();
}

export function parseCollectionXml(xml: string, includeExpansions: boolean): BggCollectionGame[] {
  return parseCollectionSnapshotXml(xml, includeExpansions).games;
}

export function parseCollectionSnapshotXml(xml: string, includeExpansions: boolean): BggCollectionSnapshot {
  const parsed = parseBggXml(xml);

  if (!Object.prototype.hasOwnProperty.call(parsed, "items")) {
    throw new BggApiError("BoardGameGeek collection response is missing the items root", "invalid-xml", false);
  }

  const itemsNode = isRecord(parsed.items) ? parsed.items : {};
  const rawItems = toArray(itemsNode.item);
  const declaredTotal = toNumber(itemsNode.totalitems);
  const parsedGames = rawItems.map((item) => (isRecord(item) ? parseCollectionItem(item) : null));

  if (declaredTotal === null) {
    throw new BggApiError("BoardGameGeek collection response is missing totalitems", "invalid-xml", false);
  }

  if (parsedGames.some((game) => game === null)) {
    throw new BggApiError("BoardGameGeek collection contains an invalid item", "invalid-xml", false);
  }

  if (declaredTotal !== null && declaredTotal !== rawItems.length) {
    throw new BggApiError(
      `BoardGameGeek collection is incomplete (expected ${declaredTotal}, received ${rawItems.length})`,
      "invalid-xml",
      false
    );
  }

  const games = (parsedGames as BggCollectionGame[]).filter(
    (game) => includeExpansions || game.subtype !== "boardgameexpansion"
  );

  return {
    games,
    totalItems: declaredTotal
  };
}

export function parseThingDetailsXml(xml: string): BggThingDetails[] {
  const parsed = parseBggXml(xml);

  if (!Object.prototype.hasOwnProperty.call(parsed, "items")) {
    throw new BggApiError("BoardGameGeek thing response is missing the items root", "invalid-xml", false);
  }

  const itemsNode = isRecord(parsed.items) ? parsed.items : {};

  return toArray(itemsNode.item)
    .map((item) => (isRecord(item) ? parseThingDetailsItem(item) : null))
    .filter((detail): detail is BggThingDetails => detail !== null);
}

function parseBggXml(xml: string): Record<string, unknown> {
  validateBggXml(xml);
  const parsed = parser.parse(xml) as unknown;

  if (!isRecord(parsed)) {
    throw new BggApiError("BoardGameGeek returned an invalid XML document", "invalid-xml", false);
  }

  const apiErrors = extractApiErrors(parsed);

  if (apiErrors.length > 0) {
    throw new BggApiError(`BoardGameGeek API error: ${apiErrors.join("; ")}`, "api-error", false);
  }

  return parsed;
}

function validateBggXml(xml: string): void {
  if (!xml.trim()) {
    throw new BggApiError("BoardGameGeek returned an empty response", "invalid-xml", false);
  }

  const validation = XMLValidator.validate(xml);

  if (validation !== true) {
    throw new BggApiError("BoardGameGeek returned malformed XML", "invalid-xml", false);
  }
}

function extractApiErrors(parsed: Record<string, unknown>): string[] {
  const errors: string[] = [];

  function collect(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    const text = toText(value);

    if (text) {
      errors.push(text);
      return;
    }

    if (isRecord(value)) {
      Object.values(value).forEach(collect);
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "errors")) {
    collect(parsed.errors);
  } else if (Object.prototype.hasOwnProperty.call(parsed, "error")) {
    collect(parsed.error);
  }

  return errors;
}

function errorForResponse(response: Response): BggApiError {
  if (response.status === 401 || response.status === 403) {
    return new BggApiError(
      `BoardGameGeek authentication failed (${response.status}); check BGG_API_TOKEN`,
      "authentication",
      false,
      response.status
    );
  }

  if (response.status === 202) {
    return new BggApiError("BoardGameGeek queued the requested export", "queued", true, response.status);
  }

  if (RETRYABLE_STATUSES.has(response.status)) {
    return new BggApiError(
      `BoardGameGeek is temporarily unavailable (${response.status})`,
      "unavailable",
      true,
      response.status
    );
  }

  return new BggApiError(
    `BoardGameGeek request failed (${response.status})`,
    "http",
    false,
    response.status
  );
}

function normalizeTransportError(error: unknown): BggApiError {
  if (error instanceof BggApiError) {
    return error;
  }

  return new BggApiError("Could not connect to BoardGameGeek", "network", true, undefined, {
    cause: error
  });
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");

  if (!value) {
    return null;
  }

  const seconds = Number.parseFloat(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
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

  const isExpansion = toText(item.type) === "boardgameexpansion";
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

    if (toBoolean(link.inbound)) {
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

  function addLabel(facet: MetadataFacet, value: unknown): void {
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

  function collect(value: unknown, typeHint?: string): void {
    if (Array.isArray(value)) {
      value.forEach((child) => collect(child, typeHint));
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
  return metadata;
}

function uniquePositiveIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
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

function toBoolean(value: unknown): boolean {
  return value === true || toText(value)?.toLowerCase() === "true";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
