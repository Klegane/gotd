import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GamesCatalogView } from "@/components/GamesCatalogView";
import type { PreferenceState } from "@/components/GamePreferenceControl";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

describe("GamesCatalogView filters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resets catalog search and preference filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          games
        })
      )
    );

    const { container } = render(<GamesCatalogView />);

    await waitFor(() => {
      expect(container.querySelector("#catalog-game-card-game_a")).not.toBeNull();
    });

    fireEvent.change(container.querySelector("#games-catalog-search-input") as HTMLInputElement, {
      target: { value: "root" }
    });
    fireEvent.change(container.querySelector("#games-catalog-preference-filter") as HTMLSelectElement, {
      target: { value: "favorite" }
    });

    expect(container.querySelector("#catalog-game-card-game_a")).toBeNull();
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("0 de 3 juegos");
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("Busqueda");
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("Preferencia");

    fireEvent.click(container.querySelector("#games-catalog-reset-filters-button") as HTMLButtonElement);

    expect((container.querySelector("#games-catalog-search-input") as HTMLInputElement).value).toBe("");
    expect((container.querySelector("#games-catalog-preference-filter") as HTMLSelectElement).value).toBe("all");
    await waitFor(() => {
      expect(container.querySelector("#games-catalog-count")?.textContent).toContain("3 de 3 juegos");
      expect(container.querySelector("#games-catalog-count")?.textContent).toContain("Sin filtros activos");
      expect(container.querySelector("#catalog-game-card-game_a")).not.toBeNull();
      expect(container.querySelector("#catalog-game-card-game_c")).not.toBeNull();
    });
  });

  it("filters catalog games from searchable metadata facets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          games
        })
      )
    );

    const { container } = render(<GamesCatalogView />);

    await waitFor(() => {
      expect(container.querySelector("#catalog-game-card-game_c")).not.toBeNull();
    });

    fireEvent.change(container.querySelector("#games-catalog-metadata-filter-designer-search-input") as HTMLInputElement, {
      target: { value: "Cole" }
    });

    expect(container.querySelector("#games-catalog-metadata-filter-designer-michael-kiesling")).toBeNull();
    expect(container.querySelector("#games-catalog-metadata-filter-designer-cole-wehrle")).not.toBeNull();

    fireEvent.click(container.querySelector("#games-catalog-metadata-filter-designer-cole-wehrle") as HTMLInputElement);

    expect(container.querySelector("#catalog-game-card-game_a")).toBeNull();
    expect(container.querySelector("#catalog-game-card-game_b")).toBeNull();
    expect(container.querySelector("#catalog-game-card-game_c")).not.toBeNull();
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("1 de 3 juegos");
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("Disenador");
    expect(container.querySelector("#games-catalog-count")?.textContent).toContain("Cole Wehrle");

    fireEvent.click(container.querySelector("#games-catalog-reset-filters-button") as HTMLButtonElement);

    await waitFor(() => {
      expect((container.querySelector("#games-catalog-metadata-filter-designer-search-input") as HTMLInputElement).value).toBe("");
      expect(container.querySelector("#games-catalog-count")?.textContent).toContain("3 de 3 juegos");
      expect(container.querySelector("#catalog-game-card-game_a")).not.toBeNull();
      expect(container.querySelector("#catalog-game-card-game_b")).not.toBeNull();
      expect(container.querySelector("#catalog-game-card-game_c")).not.toBeNull();
    });
  });
});

const games = [
  game("game_a", "Azul", "favorite", {
    categories: ["Abstract Strategy"],
    mechanisms: ["Pattern Building"],
    designers: ["Michael Kiesling"],
    playingTime: 30,
    averageWeight: 1.8,
    minPlayers: 2,
    maxPlayers: 4
  }),
  game("game_b", "Catan", "vetoed", {
    categories: ["Economic"],
    mechanisms: ["Trading"],
    designers: ["Klaus Teuber"],
    playingTime: 90,
    averageWeight: 2.3,
    minPlayers: 3,
    maxPlayers: 4
  }),
  game("game_c", "Root", null, {
    categories: ["Wargame"],
    mechanisms: ["Area Majority"],
    designers: ["Cole Wehrle"],
    playingTime: 90,
    averageWeight: 3.8,
    minPlayers: 2,
    maxPlayers: 5
  })
];

function game(
  id: string,
  name: string,
  preference: PreferenceState | null,
  overrides: Partial<ReturnType<typeof baseGame>> = {}
) {
  return {
    ...baseGame(id, name),
    ...overrides,
    preference
  };
}

function baseGame(id: string, name: string) {
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
    categories: [] as string[],
    mechanisms: [] as string[],
    families: [] as string[],
    designers: [] as string[],
    artists: [] as string[]
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}
