import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GameCurationPanel } from "@/components/GameCurationPanel";
import { GamePickerDropdown } from "@/components/GamePickerDropdown";
import type { Game } from "@/components/VotingDashboard";

describe("GamePickerDropdown", () => {
  it("opens a thumbnail grid, filters by shared search, and selects a game", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GamePickerDropdown
        id="session-detail-proposal-game-select"
        name="session-detail-proposal-game"
        label="Proponer juego"
        games={games}
        value=""
        onChange={onChange}
      />
    );

    fireEvent.click(container.querySelector("#session-detail-proposal-game-select") as HTMLButtonElement);

    expect(
      container.querySelector("#session-detail-proposal-game-select-option-game_a img")?.getAttribute("src")
    ).toBe("/azul-thumb.jpg");

    fireEvent.change(container.querySelector("#session-detail-proposal-game-select-search-input") as HTMLInputElement, {
      target: { value: "dune" }
    });

    expect(container.querySelector("#session-detail-proposal-game-select-option-game_a")).toBeNull();
    expect(container.querySelector("#session-detail-proposal-game-select-option-game_c")?.textContent).toContain("Dune Imperium");

    fireEvent.click(container.querySelector("#session-detail-proposal-game-select-option-game_c") as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith("game_c");
  });

  it("filters by player count and sorts with shared game discovery rules", () => {
    const { container } = render(
      <GamePickerDropdown
        id="dashboard-proposal-game-select"
        name="dashboard-proposal-game"
        label="Proponer juego"
        games={games}
        value=""
        onChange={vi.fn()}
      />
    );

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select") as HTMLButtonElement);
    fireEvent.change(container.querySelector("#dashboard-proposal-game-select-min-players-input") as HTMLInputElement, {
      target: { value: "5" }
    });

    expect(container.querySelector("#dashboard-proposal-game-select-option-game_a")).toBeNull();
    expect(container.querySelector("#dashboard-proposal-game-select-option-game_c")?.textContent).toContain("Dune Imperium");

    fireEvent.change(container.querySelector("#dashboard-proposal-game-select-sort-select") as HTMLSelectElement, {
      target: { value: "name" }
    });

    const optionNames = Array.from(container.querySelectorAll(".game-picker-option strong")).map((node) => node.textContent);
    expect(optionNames).toEqual(["Dune Imperium", "Root"]);
  });

  it("filters picker options by metadata facets", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GamePickerDropdown
        id="dashboard-proposal-game-select"
        name="dashboard-proposal-game"
        label="Proponer juego"
        games={games}
        value=""
        onChange={onChange}
      />
    );

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select") as HTMLButtonElement);
    fireEvent.click(
      container.querySelector("#dashboard-proposal-game-select-metadata-filter-category-science-fiction") as HTMLInputElement
    );

    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("1 de 4 juegos");
    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("Categoria");
    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("Science Fiction");
    expect(container.querySelector("#dashboard-proposal-game-select-option-game_a")).toBeNull();
    expect(container.querySelector("#dashboard-proposal-game-select-option-game_c")?.textContent).toContain("Dune Imperium");

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select-option-game_c") as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith("game_c");
  });

  it("searches metadata facet options and resets picker filters", async () => {
    const { container } = render(
      <GamePickerDropdown
        id="dashboard-proposal-game-select"
        name="dashboard-proposal-game"
        label="Proponer juego"
        games={games}
        value=""
        onChange={vi.fn()}
      />
    );

    fireEvent.click(container.querySelector("#dashboard-proposal-game-select") as HTMLButtonElement);
    fireEvent.change(
      container.querySelector("#dashboard-proposal-game-select-metadata-filter-designer-search-input") as HTMLInputElement,
      { target: { value: "Cole" } }
    );

    expect(container.querySelector("#dashboard-proposal-game-select-metadata-filter-designer-michael-kiesling")).toBeNull();
    expect(container.querySelector("#dashboard-proposal-game-select-metadata-filter-designer-cole-wehrle")).not.toBeNull();

    fireEvent.click(
      container.querySelector("#dashboard-proposal-game-select-metadata-filter-designer-cole-wehrle") as HTMLInputElement
    );

    expect(container.querySelector("#dashboard-proposal-game-select-option-game_a")).toBeNull();
    expect(container.querySelector("#dashboard-proposal-game-select-option-game_d")?.textContent).toContain("Root");

    fireEvent.click(container.querySelector(".reset-filters-button") as HTMLButtonElement);

    await waitFor(() => {
      expect(
        (container.querySelector("#dashboard-proposal-game-select-metadata-filter-designer-search-input") as HTMLInputElement)
          .value
      ).toBe("");
    });
    expect(container.querySelector("#dashboard-proposal-game-select-option-game_a")).not.toBeNull();
    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("Sin filtros activos");
  });
});

describe("GameCurationPanel thumbnails", () => {
  it("uses thumbnail, image, and placeholder fallbacks without changing row selection", () => {
    const onSelectedGameIdsChange = vi.fn();
    const { container } = render(
      <GameCurationPanel
        idPrefix="session-detail-game-curation"
        games={games}
        selectedGameIds={[]}
        onSelectedGameIdsChange={onSelectedGameIdsChange}
        onSave={vi.fn()}
        saving={false}
      />
    );

    expect(container.querySelector("#session-detail-game-curation-thumbnail-game_a")?.getAttribute("src")).toBe("/azul-thumb.jpg");
    expect(container.querySelector("#session-detail-game-curation-thumbnail-game_b")?.getAttribute("src")).toBe("/catan.jpg");
    expect(container.querySelector("#session-detail-game-curation-thumbnail-game_c")?.getAttribute("src")).toBe("/placeholder-game.svg");

    fireEvent.click(container.querySelector("#session-detail-game-curation-game-game_b-checkbox") as HTMLInputElement);

    expect(onSelectedGameIdsChange).toHaveBeenCalledWith(["game_b"]);
  });

  it("keeps curation search and player filters after shared extraction", () => {
    const { container } = render(
      <GameCurationPanel
        idPrefix="dashboard-game-curation"
        games={games}
        selectedGameIds={[]}
        onSelectedGameIdsChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );

    fireEvent.change(container.querySelector("#dashboard-game-curation-search-input") as HTMLInputElement, {
      target: { value: "root" }
    });

    expect(container.querySelector("#dashboard-game-curation-option-game_a")).toBeNull();
    expect(container.querySelector("#dashboard-game-curation-option-game_d")?.textContent).toContain("Root");

    fireEvent.change(container.querySelector("#dashboard-game-curation-search-input") as HTMLInputElement, {
      target: { value: "" }
    });
    fireEvent.change(container.querySelector("#dashboard-game-curation-max-players-input") as HTMLInputElement, {
      target: { value: "2" }
    });

    expect(container.querySelector("#dashboard-game-curation-option-game_c")).toBeNull();
    expect(container.querySelector("#dashboard-game-curation-option-game_a")?.textContent).toContain("Azul");

    fireEvent.click(container.querySelector(".reset-filters-button") as HTMLButtonElement);

    expect((container.querySelector("#dashboard-game-curation-max-players-input") as HTMLInputElement).value).toBe("");
    expect(container.querySelector("#dashboard-game-curation-option-game_c")).not.toBeNull();
    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("Sin filtros activos");
  });

  it("uses metadata filters when adding filtered curation rows", () => {
    const onSelectedGameIdsChange = vi.fn();
    const { container } = render(
      <GameCurationPanel
        idPrefix="dashboard-game-curation"
        games={games}
        selectedGameIds={["game_b"]}
        onSelectedGameIdsChange={onSelectedGameIdsChange}
        onSave={vi.fn()}
        saving={false}
      />
    );

    fireEvent.click(
      container.querySelector("#dashboard-game-curation-metadata-filter-category-science-fiction") as HTMLInputElement
    );

    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("1 de 4 juegos");
    expect(container.querySelector(".active-filter-summary")?.textContent).toContain("Science Fiction");
    expect(container.querySelector("#dashboard-game-curation-option-game_a")).toBeNull();
    expect(container.querySelector("#dashboard-game-curation-option-game_c")?.textContent).toContain("Dune Imperium");

    fireEvent.click(container.querySelector("#dashboard-game-curation-add-filtered-button") as HTMLButtonElement);

    expect(onSelectedGameIdsChange).toHaveBeenCalledWith(["game_b", "game_c"]);
  });

  it("focuses a metadata search input when a curation filter opens", async () => {
    const { container } = render(
      <GameCurationPanel
        idPrefix="dashboard-game-curation"
        games={games}
        selectedGameIds={[]}
        onSelectedGameIdsChange={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />
    );

    fireEvent.click(container.querySelector("#dashboard-game-curation-metadata-filter-artist-summary") as HTMLElement);

    await waitFor(() => {
      expect(document.activeElement).toBe(
        container.querySelector("#dashboard-game-curation-metadata-filter-artist-search-input")
      );
    });

    fireEvent.change(document.activeElement as HTMLInputElement, {
      target: { value: "Kyle" }
    });

    expect((container.querySelector("#dashboard-game-curation-metadata-filter-artist-search-input") as HTMLInputElement).value).toBe(
      "Kyle"
    );
    expect(container.querySelector("#dashboard-game-curation-metadata-filter-artist-kyle-ferrin")).not.toBeNull();
    expect(container.querySelector("#dashboard-game-curation-metadata-filter-artist-philippe-guerin")).toBeNull();
  });
});

const games: Game[] = [
  game("game_a", "Azul", {
    thumbnailUrl: "/azul-thumb.jpg",
    minPlayers: 2,
    maxPlayers: 4,
    categories: ["Abstract Strategy"],
    mechanisms: ["Pattern Building"],
    families: ["Next Move"],
    designers: ["Michael Kiesling"],
    artists: ["Philippe Guerin"],
    playingTime: 30,
    averageWeight: 1.8
  }),
  game("game_b", "Catan", {
    imageUrl: "/catan.jpg",
    minPlayers: 3,
    maxPlayers: 4,
    categories: ["Economic"],
    mechanisms: ["Trading"],
    families: ["Catan"],
    designers: ["Klaus Teuber"],
    artists: ["Volkan Baga"],
    playingTime: 90,
    averageWeight: 2.3
  }),
  game("game_c", "Dune Imperium", {
    minPlayers: 5,
    maxPlayers: 6,
    categories: ["Science Fiction"],
    mechanisms: ["Deck, Bag, and Pool Building"],
    families: ["Dune"],
    designers: ["Paul Dennen"],
    artists: ["Clay Brooks"],
    playingTime: 120,
    averageWeight: 3.0
  }),
  game("game_d", "Root", {
    thumbnailUrl: "/root-thumb.jpg",
    minPlayers: 2,
    maxPlayers: 5,
    categories: ["Wargame"],
    mechanisms: ["Area Majority"],
    families: ["Leder Games"],
    designers: ["Cole Wehrle"],
    artists: ["Kyle Ferrin"],
    playingTime: 90,
    averageWeight: 3.8
  })
];

function game(id: string, name: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    bggId: Number(id.replace(/\D/g, "")) || 1,
    name,
    yearPublished: 2020,
    imageUrl: null,
    thumbnailUrl: null,
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 60,
    averageWeight: 2.5,
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: [],
    preference: null,
    isCreatorOption: true,
    proposalCount: 0,
    proposedByCurrentUser: false,
    priorityProposalByCurrentUser: false,
    proposers: [],
    ...overrides
  };
}
