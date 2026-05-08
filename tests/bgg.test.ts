import { describe, expect, it, vi } from "vitest";

import {
  buildCollectionUrl,
  buildGamePageUrl,
  buildGeekCollectionUrl,
  buildThingDetailsUrl,
  fetchCollectionXml,
  parseCollectionXml,
  parseGamePageDetailsHtml,
  parseGeekCollectionHtml,
  parseThingDetailsXml
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

const geekCollectionHtml = `
<td id='CEcell_objectname1' class="collection_objectname">
  <div id='results_objectname1'>
    <a href="/boardgame/173346/7-wonders-duel" class='primary'>7 Wonders Duel</a>
    <span class='smallerfont dull'>(2015)</span>
  </div>
</td>
<td id='CEcell_objectname3' class="collection_objectname">
  <div id='results_objectname3'>
    <a href="/boardgame/383179/age-of-innovation" class='primary'>Age of Innovation</a>
    <span class='smallerfont dull'>(2023)</span>
  </div>
</td>
<td id='CEcell_objectname5' class="collection_objectname">
  <div id='results_objectname5'>
    <a href="/boardgame/353905/bureau-of-investigation-investigations-in-arkham-a" class='primary'>Bureau of Investigation: Investigations in Arkham &amp; Elsewhere</a>
  </div>
</td>`;

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
    <statistics>
      <ratings>
        <averageweight value="2.22" />
      </ratings>
    </statistics>
  </item>
</items>`;

const gamePageHtml = `
<script>
GEEK.geekitemPreload = {"item":{"objectid":173346,"id":"173346","name":"7 Wonders Duel","yearpublished":"2015","minplayers":"2","maxplayers":"2","minplaytime":"30","maxplaytime":"30","polls":{"boardgameweight":{"averageweight":2.2274728500146757,"votes":"3407"}},"stats":{"avgweight":"2.2275"},"images":{"thumb":"https://example.com/thumb.jpg","original":"https://example.com/original.jpg"},"imageurl":"https://example.com/itemrep.jpg"}};
GEEK.geekitemSettings = {};
</script>`;

describe("BoardGameGeek catalog client", () => {
  it("builds a collection URL that excludes expansions by default", () => {
    const url = buildCollectionUrl("some user", false);

    expect(url).toContain("username=some+user");
    expect(url).toContain("own=1");
    expect(url).toContain("subtype=boardgame");
    expect(url).toContain("excludesubtype=boardgameexpansion");
  });

  it("builds a geekcollection URL for the browser collection response", () => {
    const url = buildGeekCollectionUrl("Klegane", "2259209", false);

    expect(url).toContain("geekcollection.php");
    expect(url).toContain("username=Klegane");
    expect(url).toContain("userid=2259209");
    expect(url).toContain("columns%5B%5D=title");
    expect(url).toContain("excludesubtype=boardgameexpansion");
    expect(url).toContain("own=1");
  });

  it("builds a thing details URL with comma-separated ids", () => {
    const url = buildThingDetailsUrl([173346, 383179]);

    expect(url).toBe("https://boardgamegeek.com/xmlapi2/thing?id=173346%2C383179&stats=1");
  });

  it("builds a public game page URL", () => {
    expect(buildGamePageUrl(173346)).toBe("https://boardgamegeek.com/boardgame/173346");
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
      subtype: "boardgame"
    });
  });

  it("parses the BoardGameGeek geekcollection HTML response", () => {
    const games = parseGeekCollectionHtml(geekCollectionHtml);

    expect(games).toEqual([
      {
        bggId: 173346,
        name: "7 Wonders Duel",
        yearPublished: 2015,
        imageUrl: null,
        thumbnailUrl: null,
        minPlayers: null,
        maxPlayers: null,
        playingTime: null,
        averageWeight: null,
        subtype: "boardgame",
        source: "geekcollection"
      },
      {
        bggId: 383179,
        name: "Age of Innovation",
        yearPublished: 2023,
        imageUrl: null,
        thumbnailUrl: null,
        minPlayers: null,
        maxPlayers: null,
        playingTime: null,
        averageWeight: null,
        subtype: "boardgame",
        source: "geekcollection"
      },
      {
        bggId: 353905,
        name: "Bureau of Investigation: Investigations in Arkham & Elsewhere",
        yearPublished: null,
        imageUrl: null,
        thumbnailUrl: null,
        minPlayers: null,
        maxPlayers: null,
        playingTime: null,
        averageWeight: null,
        subtype: "boardgame",
        source: "geekcollection"
      }
    ]);
  });

  it("parses BoardGameGeek thing details XML", () => {
    const details = parseThingDetailsXml(thingDetailsXml);

    expect(details).toEqual([
      {
        bggId: 173346,
        name: "7 Wonders Duel",
        yearPublished: 2015,
        imageUrl: "https://example.com/7duel.jpg",
        thumbnailUrl: "https://example.com/7duel-thumb.jpg",
        minPlayers: 2,
        maxPlayers: 2,
        playingTime: 30,
        averageWeight: 2.22,
        isExpansion: false,
        parentBggIds: [],
        expansionBggIds: []
      }
    ]);
  });

  it("parses BoardGameGeek public game page preload data", () => {
    expect(parseGamePageDetailsHtml(gamePageHtml)).toEqual({
      bggId: 173346,
      name: "7 Wonders Duel",
      yearPublished: 2015,
      imageUrl: "https://example.com/itemrep.jpg",
      thumbnailUrl: "https://example.com/thumb.jpg",
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 30,
      averageWeight: 2.2274728500146757,
      isExpansion: false,
      parentBggIds: [],
      expansionBggIds: []
    });
  });

  it("retries queued responses before returning XML", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(new Response(collectionXml, { status: 200 }));
    const delay = vi.fn().mockResolvedValue(undefined);

    const xml = await fetchCollectionXml("player", false, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay,
      delayMs: 1,
      maxAttempts: 2
    });

    expect(xml).toBe(collectionXml);
    expect(delay).toHaveBeenCalledWith(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries throttled responses and fails after the retry limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(
      fetchCollectionXml("player", false, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        delay,
        delayMs: 1,
        maxAttempts: 2
      })
    ).rejects.toThrow("BoardGameGeek is busy");
    expect(delay).toHaveBeenCalledTimes(1);
  });
});
