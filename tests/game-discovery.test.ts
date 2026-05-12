import { describe, expect, it } from "vitest";

import {
  activeGameDiscoveryFilters,
  createEmptyMetadataFilters,
  createEmptyRangeFilters,
  filterAndSortGames,
  gameMetadataFilterOptions,
  type GameDiscoveryItem
} from "@/components/gameDiscovery";

describe("game discovery metadata filters", () => {
  it("derives deduped sorted metadata options", () => {
    const options = gameMetadataFilterOptions(games);

    expect(options.categories).toEqual(["Economic", "Science Fiction", "Strategy"]);
    expect(options.mechanisms).toEqual(["Deck Building", "Pattern Building", "Trading"]);
    expect(options.designers).toEqual(["Klaus Teuber", "Michael Kiesling", "Paul Dennen"]);
  });

  it("uses OR within a facet and AND across active facets", () => {
    const metadataFilters = createEmptyMetadataFilters();
    metadataFilters.categories = ["Strategy", "Economic"];
    metadataFilters.mechanisms = ["Trading"];

    const filtered = filterAndSortGames(games, {
      query: "",
      minPlayers: "",
      maxPlayers: "",
      sortMode: "name",
      metadataFilters
    });

    expect(filtered.map((game) => game.name)).toEqual(["Catan"]);
  });

  it("filters by inclusive playing time and weight ranges while excluding missing metadata", () => {
    const filtered = filterAndSortGames(games, {
      query: "",
      minPlayers: "",
      maxPlayers: "",
      sortMode: "name",
      rangeFilters: {
        ...createEmptyRangeFilters(),
        minPlayingTime: "45",
        maxWeight: "3"
      }
    });

    expect(filtered.map((game) => game.name)).toEqual(["Catan"]);
  });

  it("keeps existing name and player filters working with metadata filters", () => {
    const metadataFilters = createEmptyMetadataFilters();
    metadataFilters.categories = ["Science Fiction"];

    const filtered = filterAndSortGames(games, {
      query: "dune",
      minPlayers: "5",
      maxPlayers: "",
      sortMode: "best-fit",
      metadataFilters
    });

    expect(filtered.map((game) => game.name)).toEqual(["Dune Imperium"]);
  });

  it("describes active discovery filters for visual feedback", () => {
    const metadataFilters = createEmptyMetadataFilters();
    metadataFilters.categories = ["Science Fiction"];
    metadataFilters.designers = ["Paul Dennen"];

    expect(
      activeGameDiscoveryFilters({
        query: "dune",
        minPlayers: "5",
        maxPlayers: "",
        metadataFilters,
        rangeFilters: {
          ...createEmptyRangeFilters(),
          maxPlayingTime: "120",
          minWeight: "2.5"
        }
      })
    ).toEqual([
      { id: "query", label: "Busqueda", value: "dune" },
      { id: "min-players", label: "Grupo min.", value: "5" },
      { id: "category-science-fiction", label: "Categoria", value: "Science Fiction" },
      { id: "designer-paul-dennen", label: "Disenador", value: "Paul Dennen" },
      { id: "max-playing-time", label: "Tiempo max.", value: "120 min" },
      { id: "min-weight", label: "Peso min.", value: "2.5/5" }
    ]);
  });
});

const games: GameDiscoveryItem[] = [
  game("game_a", "Azul", {
    categories: ["Strategy"],
    mechanisms: ["Pattern Building"],
    designers: ["Michael Kiesling"],
    playingTime: 30,
    averageWeight: 1.8
  }),
  game("game_b", "Catan", {
    categories: ["Economic", "Strategy"],
    mechanisms: ["Trading"],
    designers: ["Klaus Teuber"],
    playingTime: 60,
    averageWeight: 3
  }),
  game("game_c", "Dune Imperium", {
    categories: ["Science Fiction"],
    mechanisms: ["Deck Building"],
    designers: ["Paul Dennen"],
    minPlayers: 5,
    maxPlayers: 6,
    playingTime: 120,
    averageWeight: 3.2
  }),
  game("game_d", "No Metadata", {
    playingTime: null,
    averageWeight: null
  })
];

function game(id: string, name: string, overrides: Partial<GameDiscoveryItem> = {}): GameDiscoveryItem {
  return {
    id,
    name,
    imageUrl: null,
    thumbnailUrl: null,
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 45,
    averageWeight: 2,
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: [],
    ...overrides
  };
}
