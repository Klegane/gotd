import { describe, expect, it, vi } from "vitest";

import {
  BggApiError,
  BggXmlApiClient,
  buildCollectionUrl,
  buildThingDetailsUrl,
  detailsAreFresh,
  mergeCollectionGameWithCache,
  mergeThingDetails,
  parseCollectionXml,
  parseThingDetailsXml,
  type BggCollectionGame,
  type BggThingDetails,
  type CachedBggGame
} from "@/server/bgg";

const collectionXml = `<items totalitems="2">
  <item objectid="174430" subtype="boardgame">
    <name>Gloomhaven</name><yearpublished>2017</yearpublished>
    <stats minplayers="1" maxplayers="4" playingtime="120" />
  </item>
  <item objectid="999999" subtype="boardgameexpansion"><name>Expansion Box</name></item>
</items>`;

const thingXml = `<items><item type="boardgame" id="173346">
  <name type="primary" value="7 Wonders Duel" /><yearpublished value="2015" />
  <minplayers value="2" /><maxplayers value="2" /><playingtime value="30" />
  <link type="boardgamecategory" value="Adventure" />
  <link type="boardgamemechanic" value="Drafting" />
  <link type="boardgamedesigner" value="Antoine Bauza" />
  <link type="boardgameexpansion" id="999999" value="Expansion Box" />
  <statistics><ratings><averageweight value="2.22" /></ratings></statistics>
</item><item type="boardgameexpansion" id="999999">
  <name type="primary" value="Expansion Box" />
  <link type="boardgameexpansion" id="173346" inbound="true" />
</item></items>`;

describe("BoardGameGeek XML API2 parsing", () => {
  it("builds supported collection and thing URLs", () => {
    const url = buildCollectionUrl("some user", false);
    expect(url).toContain("username=some+user");
    expect(url).toContain("own=1");
    expect(url).toContain("excludesubtype=boardgameexpansion");
    expect(buildThingDetailsUrl([173346, 383179])).toBe(
      "https://boardgamegeek.com/xmlapi2/thing?id=173346%2C383179&stats=1"
    );
  });

  it("parses collection XML, filters expansions, and detects truncation", () => {
    expect(parseCollectionXml(collectionXml, false)).toEqual([
      expect.objectContaining({
        bggId: 174430,
        name: "Gloomhaven",
        yearPublished: 2017,
        minPlayers: 1,
        maxPlayers: 4,
        playingTime: 120,
        source: "xmlapi2"
      })
    ]);
    expect(() => parseCollectionXml(collectionXml.replace('totalitems="2"', 'totalitems="3"'), true)).toThrow(
      "collection is incomplete"
    );
    expect(() => parseCollectionXml("<items />", true)).toThrow("missing totalitems");
  });

  it("parses taxonomy and expansion relationships from thing XML", () => {
    const details = parseThingDetailsXml(thingXml);
    expect(details[0]).toMatchObject({
      bggId: 173346,
      name: "7 Wonders Duel",
      averageWeight: 2.22,
      categories: ["Adventure"],
      mechanisms: ["Drafting"],
      designers: ["Antoine Bauza"],
      expansionBggIds: [999999]
    });
    expect(details[1]).toMatchObject({ isExpansion: true, parentBggIds: [173346] });
  });
});

describe("BoardGameGeek XML API2 HTTP client", () => {
  it("sends the token and retries queued, network, and transient responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(collectionXml, { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new BggXmlApiClient({
      apiToken: "test-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      retryDelayMs: 1,
      maxAttempts: 4
    });

    await expect(client.getOwnedCollection("player", false)).resolves.toMatchObject({ totalItems: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/xmlapi2/collection?"),
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" })
      })
    );
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("fails immediately for credentials, malformed XML, and API errors", async () => {
    const authClient = clientReturning(new Response("", { status: 401 }), 3);
    const malformedClient = clientReturning(new Response("<items>", { status: 200 }));
    const apiErrorClient = clientReturning(
      new Response('<errors><error message="Invalid username" /></errors>', { status: 200 })
    );

    await expect(authClient.getOwnedCollection("player", false)).rejects.toMatchObject({
      code: "authentication",
      retryable: false
    });
    await expect(malformedClient.getOwnedCollection("player", false)).rejects.toBeInstanceOf(BggApiError);
    await expect(apiErrorClient.getOwnedCollection("player", false)).rejects.toThrow("Invalid username");
  });

  it("batches thing requests at 20 ids and exposes recoverable failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(
        new Response('<items><item type="boardgame" id="21"><name type="primary" value="Game 21" /></item></items>')
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new BggXmlApiClient({
      apiToken: "test-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      batchDelayMs: 1,
      maxAttempts: 1
    });

    const result = await client.getThingDetailsBatched(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.details.get(21)?.name).toBe("Game 21");
    expect(result.failedIds).toHaveLength(20);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("catalog detail cache", () => {
  it("reuses fresh rows and merges refreshed details with a timestamp", () => {
    const cached = mergeCollectionGameWithCache(baseGame(), cachedGame());
    expect(cached).toMatchObject({
      averageWeight: 2.22,
      categories: ["Strategy"],
      parentBggIds: [42]
    });
    expect(detailsAreFresh(cached, new Date("2026-10-22T12:00:00.000Z"), 7 * 86_400_000)).toBe(true);
    expect(detailsAreFresh(cached, new Date("2026-10-28T12:00:00.000Z"), 7 * 86_400_000)).toBe(false);

    const merged = mergeThingDetails(baseGame(), detail(), "2026-10-22T12:00:00.000Z");
    expect(merged).toMatchObject({
      averageWeight: 2.22,
      categories: ["Strategy"],
      detailsFetchedAt: "2026-10-22T12:00:00.000Z"
    });
  });
});

function clientReturning(response: Response, maxAttempts = 1) {
  return new BggXmlApiClient({
    apiToken: "test-token",
    fetchImpl: vi.fn().mockResolvedValue(response) as unknown as typeof fetch,
    maxAttempts
  });
}

function baseGame(): BggCollectionGame {
  return {
    bggId: 173346,
    name: "7 Wonders Duel",
    yearPublished: 2015,
    imageUrl: null,
    thumbnailUrl: null,
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 30,
    averageWeight: null,
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: [],
    subtype: "boardgame",
    source: "xmlapi2"
  };
}

function cachedGame(): CachedBggGame {
  return {
    ...baseGame(),
    averageWeight: 2.22,
    categories: ["Strategy"],
    isExpansion: false,
    metadataJson: JSON.stringify({ detailsFetchedAt: "2026-10-20T12:00:00.000Z" }),
    parentGame: { bggId: 42 }
  };
}

function detail(): BggThingDetails {
  return {
    ...baseGame(),
    imageUrl: "https://example.com/game.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    averageWeight: 2.22,
    categories: ["Strategy"],
    isExpansion: false,
    parentBggIds: [],
    expansionBggIds: []
  };
}
