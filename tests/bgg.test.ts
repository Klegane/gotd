import { describe, expect, it, vi } from "vitest";

import {
  buildCollectionUrl,
  buildThingDetailsUrl,
  enrichGamesWithThingDetails,
  fetchCollectionXml,
  parseCollectionXml,
  parseThingDetailsXml,
  type BggCollectionGame
} from "@/server/bgg";

const collectionXml = `<?xml version="1.0" encoding="utf-8"?>
<items totalitems="2">
  <item objecttype="thing" objectid="174430" subtype="boardgame">
    <name>Gloomhaven</name>
    <yearpublished>2017</yearpublished>
    <image>https://example.com/gloomhaven.jpg</image>
    <thumbnail>https://example.com/gloomhaven-thumb.jpg</thumbnail>
    <stats minplayers="1" maxplayers="4" playingtime="120" />
  </item>
  <item objecttype="thing" objectid="999999" subtype="boardgameexpansion">
    <name>Expansion Box</name>
    <yearpublished>2020</yearpublished>
  </item>
</items>`;

const thingDetailsXml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="173346">
    <thumbnail>https://example.com/7duel-thumb.jpg</thumbnail>
    <image>https://example.com/7duel.jpg</image>
    <name type="primary" value="7 Wonders Duel" />
    <yearpublished value="2015" />
    <minplayers value="2" />
    <maxplayers value="2" />
    <playingtime value="30" />
    <link type="boardgamecategory" id="1022" value="Adventure" />
    <link type="boardgamecategory" id="1022" value="Adventure" />
    <link type="boardgamemechanic" id="2664" value="Deck, Bag, and Pool Building" />
    <link type="boardgamefamily" id="5497" value="Players: Two Player Only Games" />
    <link type="boardgamedesigner" id="37769" value="Antoine Bauza" />
    <link type="boardgameartist" id="13027" value="Miguel Coimbra" />
    <link type="boardgameexpansion" id="999999" value="Expansion Box" />
    <statistics>
      <ratings>
        <averageweight value="2.22" />
      </ratings>
    </statistics>
  </item>
  <item type="boardgameexpansion" id="999999">
    <name type="primary" value="Expansion Box" />
    <link type="boardgameexpansion" id="173346" value="7 Wonders Duel" inbound="true" />
  </item>
</items>`;

describe("BoardGameGeek XML API2 client", () => {
  it("builds an API collection URL that excludes expansions by default", () => {
    const url = buildCollectionUrl("some user", false);

    expect(url).toContain("username=some+user");
    expect(url).toContain("own=1");
    expect(url).toContain("subtype=boardgame");
    expect(url).toContain("excludesubtype=boardgameexpansion");
  });

  it("builds an API thing-details URL with comma-separated ids", () => {
    const url = buildThingDetailsUrl([173346, 383179]);

    expect(url).toBe("https://boardgamegeek.com/xmlapi2/thing?id=173346%2C383179&stats=1");
  });

  it("parses collection XML and filters expansions", () => {
    const games = parseCollectionXml(collectionXml, false);

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      bggId: 174430,
      name: "Gloomhaven",
      yearPublished: 2017,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 120,
      subtype: "boardgame",
      source: "xmlapi2"
    });
  });

  it("parses metadata and expansion relationships from thing XML", () => {
    const details = parseThingDetailsXml(thingDetailsXml);

    expect(details[0]).toEqual({
      bggId: 173346,
      name: "7 Wonders Duel",
      yearPublished: 2015,
      imageUrl: "https://example.com/7duel.jpg",
      thumbnailUrl: "https://example.com/7duel-thumb.jpg",
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 30,
      averageWeight: 2.22,
      categories: ["Adventure"],
      mechanisms: ["Deck, Bag, and Pool Building"],
      families: ["Players: Two Player Only Games"],
      designers: ["Antoine Bauza"],
      artists: ["Miguel Coimbra"],
      isExpansion: false,
      parentBggIds: [],
      expansionBggIds: [999999]
    });
    expect(details[1]).toMatchObject({
      bggId: 999999,
      isExpansion: true,
      parentBggIds: [173346],
      expansionBggIds: []
    });
  });

  it("enriches collection entries exclusively through XML API2", async () => {
    const baseGame: BggCollectionGame = {
      bggId: 173346,
      name: "7 Wonders Duel",
      yearPublished: 2015,
      imageUrl: null,
      thumbnailUrl: null,
      minPlayers: null,
      maxPlayers: null,
      playingTime: null,
      averageWeight: null,
      ...emptyMetadata(),
      subtype: "boardgame",
      source: "xmlapi2"
    };
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(thingDetailsXml, { status: 200 }));

    const games = await enrichGamesWithThingDetails([baseGame], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      apiToken: "test-token",
      delay: vi.fn().mockResolvedValue(undefined),
      delayMs: 1,
      maxAttempts: 1
    });

    expect(games[0]).toMatchObject({
      bggId: 173346,
      imageUrl: "https://example.com/7duel.jpg",
      thumbnailUrl: "https://example.com/7duel-thumb.jpg",
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 30,
      averageWeight: 2.22,
      categories: ["Adventure"],
      expansionBggIds: [999999]
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://boardgamegeek.com/xmlapi2/thing?id=173346&stats=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });

  it("batches detail requests at the API limit of 20 items", async () => {
    const games = Array.from({ length: 21 }, (_, index): BggCollectionGame => ({
      bggId: index + 1,
      name: `Game ${index + 1}`,
      yearPublished: null,
      imageUrl: null,
      thumbnailUrl: null,
      minPlayers: null,
      maxPlayers: null,
      playingTime: null,
      averageWeight: null,
      ...emptyMetadata(),
      subtype: "boardgame",
      source: "xmlapi2"
    }));
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response("<items />", { status: 200 }));

    await enrichGamesWithThingDetails(games, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      apiToken: "test-token",
      delay: vi.fn().mockResolvedValue(undefined),
      delayMs: 1,
      maxAttempts: 1
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.every(([url]) => String(url).startsWith("https://boardgamegeek.com/xmlapi2/thing?"))).toBe(true);
  });

  it("sends the Bearer token and retries queued collection responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(new Response(collectionXml, { status: 200 }));
    const delay = vi.fn().mockResolvedValue(undefined);

    const xml = await fetchCollectionXml("player", false, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      apiToken: "test-token",
      delay,
      delayMs: 1,
      maxAttempts: 2
    });

    expect(xml).toBe(collectionXml);
    expect(delay).toHaveBeenCalledWith(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/xmlapi2/collection?"),
      expect.objectContaining({
        headers: {
          Accept: "application/xml,text/xml",
          Authorization: "Bearer test-token"
        }
      })
    );
  });

  it("retries throttled responses and fails after the retry limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      fetchCollectionXml("player", false, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        apiToken: "test-token",
        delay,
        delayMs: 1,
        maxAttempts: 2
      })
    ).rejects.toThrow("BoardGameGeek is busy");
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("reports invalid API credentials without retrying", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      fetchCollectionXml("player", false, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        apiToken: "invalid-token",
        delay,
        delayMs: 1,
        maxAttempts: 3
      })
    ).rejects.toThrow("check BGG_API_TOKEN");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});

function emptyMetadata() {
  return {
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: []
  };
}
