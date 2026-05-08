"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { GamePreferenceControl, type PreferenceState } from "@/components/GamePreferenceControl";

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
  preference: PreferenceState | null;
};

type PreferenceFilter = "all" | "favorite" | "vetoed" | "none";

export function GamesCatalogView() {
  const [games, setGames] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingGameId, setWorkingGameId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preferenceFilter, setPreferenceFilter] = useState<PreferenceFilter>("all");

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
    const normalizedQuery = normalize(query);

    return games.filter((game) => {
      if (normalizedQuery && !normalize(game.name).includes(normalizedQuery)) {
        return false;
      }

      if (preferenceFilter === "none") {
        return game.preference === null;
      }

      if (preferenceFilter !== "all") {
        return game.preference === preferenceFilter;
      }

      return true;
    });
  }, [games, preferenceFilter, query]);

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
      <Link id="games-catalog-back-link" href="/" className="back-link">&larr; Volver al calendario</Link>

      <div id="games-catalog-toolbar" className="games-toolbar">
        <label htmlFor="games-catalog-search-input">
          <span>Buscar</span>
          <input
            id="games-catalog-search-input"
            name="games-catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del juego"
          />
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

      {error ? <p id="games-catalog-error" className="status-line" style={{ color: "var(--coral)" }}>{error}</p> : null}

      <p id="games-catalog-count" className="status-line">{visibleGames.length} de {games.length} juegos</p>

      <div id="games-catalog-grid" className="games-catalog-grid">
        {visibleGames.map((game) => (
          <article id={`catalog-game-card-${game.id}`} className={`catalog-game-card ${game.preference ?? ""}`} key={game.id}>
            <img
              id={`catalog-game-image-${game.id}`}
              src={game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"}
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

function playersLabel(game: Pick<CatalogGame, "minPlayers" | "maxPlayers">): string {
  if (game.minPlayers && game.maxPlayers && game.minPlayers !== game.maxPlayers) {
    return `${game.minPlayers}-${game.maxPlayers} jugadores`;
  }

  if (game.minPlayers || game.maxPlayers) {
    return `${game.minPlayers ?? game.maxPlayers} jugadores`;
  }

  return "Jugadores desconocido";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();
}
