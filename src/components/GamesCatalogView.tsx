"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import { GameActiveFilterSummary, GameMetadataFilterControls } from "@/components/GameMetadataFilters";
import { GamePreferenceControl, type PreferenceState } from "@/components/GamePreferenceControl";
import {
  activeGameDiscoveryFilters,
  createEmptyMetadataFilters,
  createEmptyRangeFilters,
  filterAndSortGames,
  gameImageSrc,
  playersLabel,
  type ActiveGameDiscoveryFilter,
  type SortMode
} from "@/components/gameDiscovery";

type CatalogGame = {
  id: string;
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
  preference: PreferenceState | null;
};

type PreferenceFilter = "all" | "favorite" | "vetoed" | "none";

const preferenceFilterLabels: Record<Exclude<PreferenceFilter, "all">, string> = {
  favorite: "Favoritos",
  vetoed: "Vetados",
  none: "Sin marca"
};

export function GamesCatalogView() {
  const [games, setGames] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingGameId, setWorkingGameId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [metadataFilters, setMetadataFilters] = useState(createEmptyMetadataFilters);
  const [rangeFilters, setRangeFilters] = useState(createEmptyRangeFilters);
  const [preferenceFilter, setPreferenceFilter] = useState<PreferenceFilter>("all");
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog");

        if (!response.ok) {
          throw new Error("No se pudo cargar el catálogo.");
        }

        const body = (await response.json()) as { games: CatalogGame[] };
        setGames(body.games);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el catálogo.");
      } finally {
        setLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  const visibleGames = useMemo(() => {
    const discoveredGames = filterAndSortGames(games, {
      query,
      minPlayers,
      maxPlayers,
      sortMode,
      metadataFilters,
      rangeFilters
    });

    return discoveredGames.filter((game) => {
      if (preferenceFilter === "none") {
        return game.preference === null;
      }

      if (preferenceFilter !== "all") {
        return game.preference === preferenceFilter;
      }

      return true;
    });
  }, [games, maxPlayers, metadataFilters, minPlayers, preferenceFilter, query, rangeFilters, sortMode]);

  const activeFilters = useMemo(
    () =>
      catalogActiveFilters(
        activeGameDiscoveryFilters({
          query,
          minPlayers,
          maxPlayers,
          metadataFilters,
          rangeFilters
        }),
        preferenceFilter
      ),
    [maxPlayers, metadataFilters, minPlayers, preferenceFilter, query, rangeFilters]
  );

  function resetFilters() {
    setQuery("");
    setMinPlayers("");
    setMaxPlayers("");
    setSortMode("name");
    setMetadataFilters(createEmptyMetadataFilters());
    setRangeFilters(createEmptyRangeFilters());
    setPreferenceFilter("all");
    setResetSignal((current) => current + 1);
  }

  async function setPreference(gameId: string, preference: PreferenceState | null) {
    setWorkingGameId(gameId);
    setError(null);

    try {
      const response = await fetch(`/api/preferences/games/${gameId}`, {
        method: preference ? "PUT" : "DELETE",
        headers: preference ? { "Content-Type": "application/json" } : undefined,
        body: preference ? JSON.stringify({ preference }) : undefined
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar la preferencia.");
      }

      setGames((current) =>
        current.map((game) => (game.id === gameId ? { ...game, preference } : game))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la preferencia.");
    } finally {
      setWorkingGameId(null);
    }
  }

  if (loading) {
    return <p id="games-catalog-loading" className="status-line">Cargando catálogo...</p>;
  }

  return (
    <div id="games-catalog-view" className="games-catalog-page">
      <Link id="games-catalog-back-link" href="/" className="back-link">&larr; Volver a sesiones</Link>

      <div id="games-catalog-toolbar" className="games-toolbar">
        <label htmlFor="games-catalog-search-input">
          <span>Buscar juego</span>
          <input
            id="games-catalog-search-input"
            name="games-catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del juego"
          />
        </label>
        <label htmlFor="games-catalog-min-players-input">
          <span>Grupo min.</span>
          <input
            id="games-catalog-min-players-input"
            name="games-catalog-min-players"
            type="number"
            min="1"
            value={minPlayers}
            onChange={(event) => setMinPlayers(event.target.value)}
            placeholder="2"
          />
        </label>
        <label htmlFor="games-catalog-max-players-input">
          <span>Grupo max.</span>
          <input
            id="games-catalog-max-players-input"
            name="games-catalog-max-players"
            type="number"
            min="1"
            value={maxPlayers}
            onChange={(event) => setMaxPlayers(event.target.value)}
            placeholder="5"
          />
        </label>
        <label htmlFor="games-catalog-sort-select">
          <span>Orden</span>
          <select
            id="games-catalog-sort-select"
            name="games-catalog-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="name">Nombre</option>
            <option value="best-fit">Mejor ajuste</option>
            <option value="min-players">Min. jugadores</option>
            <option value="max-players">Max. jugadores</option>
            <option value="weight">Peso</option>
          </select>
        </label>
        <label htmlFor="games-catalog-preference-filter">
          <span>Preferencia</span>
          <select
            id="games-catalog-preference-filter"
            name="games-catalog-preference-filter"
            value={preferenceFilter}
            onChange={(event) => setPreferenceFilter(event.target.value as PreferenceFilter)}
          >
            <option value="all">Todos</option>
            <option value="favorite">Favoritos</option>
            <option value="vetoed">Vetados</option>
            <option value="none">Sin marca</option>
          </select>
        </label>
      </div>

      <GameMetadataFilterControls
        idPrefix="games-catalog-metadata-filter"
        games={games}
        metadataFilters={metadataFilters}
        rangeFilters={rangeFilters}
        resetSignal={resetSignal}
        onMetadataFiltersChange={setMetadataFilters}
        onRangeFiltersChange={setRangeFilters}
      />

      {error ? <p id="games-catalog-error" className="status-line" style={{ color: "var(--color-danger)" }}>{error}</p> : null}

      <div id="games-catalog-count">
        <GameActiveFilterSummary
          filters={activeFilters}
          resultCount={visibleGames.length}
          totalCount={games.length}
          onReset={resetFilters}
          resetButtonId="games-catalog-reset-filters-button"
        />
      </div>

      <div id="games-catalog-grid" className="games-catalog-grid">
        {visibleGames.map((game) => (
          <article id={`catalog-game-card-${game.id}`} className={`catalog-game-card ${game.preference ?? ""}`} key={game.id}>
            <img
              id={`catalog-game-image-${game.id}`}
              src={gameImageSrc(game)}
              alt=""
              className="catalog-game-thumb"
              loading="lazy"
            />
            <div className="catalog-game-copy">
              <h2>
                <Link id={`catalog-game-link-${game.id}`} href={`/games/${game.id}`} className="game-link">
                  {game.name}
                </Link>
              </h2>
              <p>{game.yearPublished ? game.yearPublished : "Año desconocido"}</p>
              <p>
                {playersLabel(game)}
                {game.playingTime ? ` · ${game.playingTime} min` : ""}
              </p>
              <p>{game.averageWeight ? `Peso ${game.averageWeight.toFixed(1)}/5` : "Peso desconocido"}</p>
            </div>
            <GamePreferenceControl
              idPrefix={`catalog-game-${game.id}`}
              preference={game.preference}
              onChange={(preference) => setPreference(game.id, preference)}
              disabled={workingGameId === game.id}
            />
          </article>
        ))}
      </div>

      {visibleGames.length === 0 ? (
        <p id="games-catalog-empty-state" className="status-line">No hay juegos que coincidan con esos filtros.</p>
      ) : null}
    </div>
  );
}

function catalogActiveFilters(
  filters: ActiveGameDiscoveryFilter[],
  preferenceFilter: PreferenceFilter
): ActiveGameDiscoveryFilter[] {
  if (preferenceFilter === "all") {
    return filters;
  }

  return [
    ...filters,
    {
      id: `preference-${preferenceFilter}`,
      label: "Preferencia",
      value: preferenceFilterLabels[preferenceFilter]
    }
  ];
}
