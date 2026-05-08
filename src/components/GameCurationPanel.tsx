"use client";

import { useMemo, useState } from "react";

import { playersLabel, type Game } from "@/components/VotingDashboard";

type SortMode = "best-fit" | "selected" | "name" | "min-players" | "max-players" | "weight";

type GameCurationPanelProps = {
  idPrefix?: string;
  games: Game[];
  selectedGameIds: string[];
  onSelectedGameIdsChange: (gameIds: string[]) => void;
  onSave: () => void;
  saving: boolean;
};

export function GameCurationPanel({
  idPrefix = "game-curation",
  games,
  selectedGameIds,
  onSelectedGameIdsChange,
  onSave,
  saving
}: GameCurationPanelProps) {
  const [query, setQuery] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("best-fit");
  const selectedSet = useMemo(() => new Set(selectedGameIds), [selectedGameIds]);
  const normalizedQuery = normalize(query);
  const minPlayerCount = parsePositiveInt(minPlayers);
  const maxPlayerCount = parsePositiveInt(maxPlayers);
  const titleId = `${idPrefix}-title`;

  const suggestions = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return games
      .filter((game) => normalize(game.name).includes(normalizedQuery))
      .slice(0, 6);
  }, [games, normalizedQuery]);

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        if (normalizedQuery && !normalize(game.name).includes(normalizedQuery)) {
          return false;
        }

        if (minPlayerCount && game.maxPlayers !== null && game.maxPlayers < minPlayerCount) {
          return false;
        }

        if (maxPlayerCount && game.minPlayers !== null && game.minPlayers > maxPlayerCount) {
          return false;
        }

        return true;
      })
      .sort((left, right) => compareGames(left, right, sortMode, selectedSet, minPlayerCount, maxPlayerCount));
  }, [games, maxPlayerCount, minPlayerCount, normalizedQuery, selectedSet, sortMode]);

  function toggleGame(gameId: string) {
    onSelectedGameIdsChange(
      selectedSet.has(gameId)
        ? selectedGameIds.filter((selectedGameId) => selectedGameId !== gameId)
        : [...selectedGameIds, gameId]
    );
  }

  function selectFilteredGames() {
    const nextIds = new Set(selectedGameIds);

    for (const game of filteredGames) {
      nextIds.add(game.id);
    }

    onSelectedGameIdsChange([...nextIds]);
  }

  return (
    <div id={`${idPrefix}-panel`} className="curation-panel" aria-labelledby={titleId}>
      <div id={`${idPrefix}-summary`} className="curation-copy">
        <h2 id={titleId}>Selección de juegos</h2>
        <p id={`${idPrefix}-status`} className="status-line">
          {selectedGameIds.length === 0
            ? "Sin juegos seleccionados: todos los juegos del catálogo son elegibles."
            : `${selectedGameIds.length} juegos seleccionados para esta sesión.`}
        </p>
      </div>

      <div id={`${idPrefix}-controls`} className="curation-controls">
        <label className="curation-search" htmlFor={`${idPrefix}-search-input`}>
          <span>Buscar juego</span>
          <input
            id={`${idPrefix}-search-input`}
            name={`${idPrefix}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del juego"
            autoComplete="off"
          />
          {suggestions.length > 0 ? (
            <div id={`${idPrefix}-suggestions`} className="curation-suggestions" role="listbox">
              {suggestions.map((game) => (
                <button
                  id={`${idPrefix}-suggestion-${game.id}`}
                  type="button"
                  key={game.id}
                  onClick={() => setQuery(game.name)}
                >
                  <HighlightedName name={game.name} query={query} />
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <label htmlFor={`${idPrefix}-min-players-input`}>
          <span>Mín. grupo</span>
          <input
            id={`${idPrefix}-min-players-input`}
            name={`${idPrefix}-min-players`}
            type="number"
            min="1"
            value={minPlayers}
            onChange={(event) => setMinPlayers(event.target.value)}
            placeholder="Ej. 3"
          />
        </label>

        <label htmlFor={`${idPrefix}-max-players-input`}>
          <span>Máx. grupo</span>
          <input
            id={`${idPrefix}-max-players-input`}
            name={`${idPrefix}-max-players`}
            type="number"
            min="1"
            value={maxPlayers}
            onChange={(event) => setMaxPlayers(event.target.value)}
            placeholder="Ej. 5"
          />
        </label>

        <label htmlFor={`${idPrefix}-sort-select`}>
          <span>Orden</span>
          <select
            id={`${idPrefix}-sort-select`}
            name={`${idPrefix}-sort`}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="best-fit">Mejor ajuste</option>
            <option value="selected">Seleccionados primero</option>
            <option value="name">Nombre</option>
            <option value="min-players">Mín. jugadores</option>
            <option value="max-players">Máx. jugadores</option>
            <option value="weight">Dureza</option>
          </select>
        </label>
      </div>

      <div id={`${idPrefix}-actions`} className="curation-actions">
        <button
          id={`${idPrefix}-add-filtered-button`}
          type="button"
          className="button secondary"
          onClick={selectFilteredGames}
          disabled={filteredGames.length === 0}
        >
          Añadir filtrados
        </button>
        <button
          id={`${idPrefix}-use-full-catalog-button`}
          type="button"
          className="button secondary"
          onClick={() => onSelectedGameIdsChange([])}
          disabled={selectedGameIds.length === 0}
        >
          Usar catálogo completo
        </button>
        <button
          id={`${idPrefix}-save-button`}
          type="button"
          className="button primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Guardando juegos..." : "Guardar juegos"}
        </button>
      </div>

      <div id={`${idPrefix}-list`} className="curation-list enhanced">
        {filteredGames.map((game) => (
          <label
            id={`${idPrefix}-option-${game.id}`}
            key={game.id}
            className={selectedSet.has(game.id) ? "selected" : ""}
            htmlFor={`${idPrefix}-game-${game.id}-checkbox`}
          >
            <input
              id={`${idPrefix}-game-${game.id}-checkbox`}
              name={`${idPrefix}-game-${game.id}`}
              type="checkbox"
              checked={selectedSet.has(game.id)}
              onChange={() => toggleGame(game.id)}
            />
            <span>
              <strong><HighlightedName name={game.name} query={query} /></strong>
              <small>
                {playersLabel(game)}
                {game.playingTime ? ` · ${game.playingTime} min` : ""}
                {game.averageWeight ? ` · Peso ${game.averageWeight.toFixed(1)}/5` : ""}
              </small>
            </span>
          </label>
        ))}
        {filteredGames.length === 0 ? (
          <p className="status-line">No hay juegos que encajen con esos filtros.</p>
        ) : null}
      </div>
    </div>
  );
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <>{name}</>;
  }

  const index = name.toLocaleLowerCase("es-ES").indexOf(trimmedQuery.toLocaleLowerCase("es-ES"));

  if (index < 0) {
    return <>{name}</>;
  }

  return (
    <>
      {name.slice(0, index)}
      <mark>{name.slice(index, index + trimmedQuery.length)}</mark>
      {name.slice(index + trimmedQuery.length)}
    </>
  );
}

function compareGames(
  left: Game,
  right: Game,
  sortMode: SortMode,
  selectedSet: Set<string>,
  minPlayers: number | null,
  maxPlayers: number | null
): number {
  if (sortMode === "selected") {
    const selectedDifference = Number(selectedSet.has(right.id)) - Number(selectedSet.has(left.id));

    if (selectedDifference !== 0) {
      return selectedDifference;
    }
  }

  if (sortMode === "min-players") {
    return compareNullableNumbers(left.minPlayers, right.minPlayers) || compareNames(left, right);
  }

  if (sortMode === "max-players") {
    return compareNullableNumbers(left.maxPlayers, right.maxPlayers) || compareNames(left, right);
  }

  if (sortMode === "weight") {
    return compareNullableNumbers(left.averageWeight, right.averageWeight) || compareNames(left, right);
  }

  if (sortMode === "best-fit") {
    const fitDifference = playerFitScore(left, minPlayers, maxPlayers) - playerFitScore(right, minPlayers, maxPlayers);

    if (fitDifference !== 0) {
      return fitDifference;
    }
  }

  return compareNames(left, right);
}

function playerFitScore(game: Game, minPlayers: number | null, maxPlayers: number | null): number {
  let score = 0;

  if (minPlayers && game.maxPlayers !== null) {
    score += Math.max(0, minPlayers - game.maxPlayers) * 100;
    score += Math.abs((game.minPlayers ?? minPlayers) - minPlayers);
  }

  if (maxPlayers && game.minPlayers !== null) {
    score += Math.max(0, game.minPlayers - maxPlayers) * 100;
    score += Math.abs((game.maxPlayers ?? maxPlayers) - maxPlayers);
  }

  if (game.minPlayers === null || game.maxPlayers === null) {
    score += 8;
  }

  return score;
}

function compareNames(left: Game, right: Game): number {
  return left.name.localeCompare(right.name, "es-ES");
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();
}
