"use client";

import React, { useMemo, useState } from "react";

import { HighlightedGameName } from "@/components/HighlightedGameName";
import { GameActiveFilterSummary, GameMetadataFilterControls } from "@/components/GameMetadataFilters";
import {
  activeGameDiscoveryFilters,
  createEmptyMetadataFilters,
  createEmptyRangeFilters,
  filterAndSortGames,
  gameImageSrc,
  gameSuggestions,
  playersLabel,
  type SortMode
} from "@/components/gameDiscovery";
import type { Game } from "@/components/VotingDashboard";

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
  const [metadataFilters, setMetadataFilters] = useState(createEmptyMetadataFilters);
  const [rangeFilters, setRangeFilters] = useState(createEmptyRangeFilters);
  const [resetSignal, setResetSignal] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("best-fit");
  const selectedSet = useMemo(() => new Set(selectedGameIds), [selectedGameIds]);
  const titleId = `${idPrefix}-title`;

  const suggestions = useMemo(() => gameSuggestions(games, query), [games, query]);

  const filteredGames = useMemo(
    () =>
      filterAndSortGames(games, {
        query,
        minPlayers,
        maxPlayers,
        sortMode,
        metadataFilters,
        rangeFilters,
        selectedIds: selectedSet
      }),
    [games, maxPlayers, metadataFilters, minPlayers, query, rangeFilters, selectedSet, sortMode]
  );
  const activeFilters = useMemo(
    () => activeGameDiscoveryFilters({ query, minPlayers, maxPlayers, metadataFilters, rangeFilters }),
    [maxPlayers, metadataFilters, minPlayers, query, rangeFilters]
  );

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

  function resetFilters() {
    setQuery("");
    setMinPlayers("");
    setMaxPlayers("");
    setMetadataFilters(createEmptyMetadataFilters());
    setRangeFilters(createEmptyRangeFilters());
    setResetSignal((current) => current + 1);
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
                  <HighlightedGameName name={game.name} query={query} />
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

      <GameMetadataFilterControls
        idPrefix={`${idPrefix}-metadata-filter`}
        games={games}
        metadataFilters={metadataFilters}
        rangeFilters={rangeFilters}
        resetSignal={resetSignal}
        onMetadataFiltersChange={setMetadataFilters}
        onRangeFiltersChange={setRangeFilters}
      />

      <GameActiveFilterSummary
        filters={activeFilters}
        resultCount={filteredGames.length}
        totalCount={games.length}
        onReset={resetFilters}
      />

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
            <img
              id={`${idPrefix}-thumbnail-${game.id}`}
              src={gameImageSrc(game)}
              alt=""
              className="curation-row-thumb"
              loading="lazy"
            />
            <span>
              <strong><HighlightedGameName name={game.name} query={query} /></strong>
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
