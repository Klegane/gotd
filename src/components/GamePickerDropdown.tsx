"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { HighlightedGameName } from "@/components/HighlightedGameName";
import { GameActiveFilterSummary, GameMetadataFilterControls } from "@/components/GameMetadataFilters";
import {
  activeGameDiscoveryFilters,
  createEmptyMetadataFilters,
  createEmptyRangeFilters,
  filterAndSortGames,
  gameImageSrc,
  playersLabel,
  type GameDiscoveryItem,
  type SortMode
} from "@/components/gameDiscovery";

type GamePickerDropdownProps = {
  id: string;
  name: string;
  label: string;
  games: GameDiscoveryItem[];
  value: string;
  onChange: (gameId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
};

export function GamePickerDropdown({
  id,
  name,
  label,
  games,
  value,
  onChange,
  disabled = false,
  placeholder = "Selecciona un juego",
  emptyText = "No hay juegos disponibles"
}: GamePickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [metadataFilters, setMetadataFilters] = useState(createEmptyMetadataFilters);
  const [rangeFilters, setRangeFilters] = useState(createEmptyRangeFilters);
  const [resetSignal, setResetSignal] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("best-fit");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedGame = games.find((game) => game.id === value) ?? null;
  const selectedIds = useMemo(() => (selectedGame ? new Set([selectedGame.id]) : new Set<string>()), [selectedGame]);
  const filteredGames = useMemo(
    () => filterAndSortGames(games, { query, minPlayers, maxPlayers, sortMode, metadataFilters, rangeFilters, selectedIds }),
    [games, maxPlayers, metadataFilters, minPlayers, query, rangeFilters, selectedIds, sortMode]
  );
  const activeFilters = useMemo(
    () => activeGameDiscoveryFilters({ query, minPlayers, maxPlayers, metadataFilters, rangeFilters }),
    [maxPlayers, metadataFilters, minPlayers, query, rangeFilters]
  );
  const isDisabled = disabled || games.length === 0;
  const panelId = `${id}-dropdown`;
  const labelId = `${id}-label`;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filteredGames.length) {
      setActiveIndex(Math.max(0, filteredGames.length - 1));
    }
  }, [activeIndex, filteredGames.length]);

  function openPanel(focus: "search" | "option" = "search") {
    if (isDisabled) {
      return;
    }

    setOpen(true);
    window.setTimeout(() => {
      if (focus === "option" && filteredGames.length > 0) {
        optionRefs.current[activeIndex]?.focus();
      } else {
        searchRef.current?.focus();
      }
    }, 0);
  }

  function closePanel({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
    setOpen(false);

    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }

  function selectGame(gameId: string) {
    onChange(gameId);
    closePanel();
  }

  function resetFilters() {
    setQuery("");
    setMinPlayers("");
    setMaxPlayers("");
    setMetadataFilters(createEmptyMetadataFilters());
    setRangeFilters(createEmptyRangeFilters());
    setActiveIndex(0);
    setResetSignal((current) => current + 1);
  }

  function focusOption(index: number) {
    if (filteredGames.length === 0) {
      return;
    }

    const nextIndex = (index + filteredGames.length) % filteredGames.length;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openPanel("option");
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number, gameId: string) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOption(filteredGames.length - 1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectGame(gameId);
    }
  }

  return (
    <div ref={containerRef} className="game-picker" data-open={open ? "true" : "false"}>
      <span id={labelId} className="game-picker-label">{label}</span>
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="game-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${id}`}
        disabled={isDisabled}
        onClick={() => (open ? closePanel({ restoreFocus: false }) : openPanel())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="game-picker-trigger-content">
          <img
            src={selectedGame ? gameImageSrc(selectedGame) : "/placeholder-game.svg"}
            alt=""
            className="game-picker-trigger-thumb"
            loading="lazy"
          />
          <span>
            <strong>{selectedGame?.name ?? (games.length === 0 ? emptyText : placeholder)}</strong>
            {selectedGame ? <small>{playersLabel(selectedGame)}</small> : null}
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="game-picker-menu" onKeyDown={handlePanelKeyDown}>
          <div className="game-picker-controls">
            <label htmlFor={`${id}-search-input`}>
              <span>Buscar juego</span>
              <input
                id={`${id}-search-input`}
                name={`${name}-search`}
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption(0);
                  }
                }}
                placeholder="Nombre del juego"
                autoComplete="off"
              />
            </label>

            <label htmlFor={`${id}-min-players-input`}>
              <span>Min. grupo</span>
              <input
                id={`${id}-min-players-input`}
                name={`${name}-min-players`}
                type="number"
                min="1"
                value={minPlayers}
                onChange={(event) => {
                  setMinPlayers(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Ej. 3"
              />
            </label>

            <label htmlFor={`${id}-max-players-input`}>
              <span>Max. grupo</span>
              <input
                id={`${id}-max-players-input`}
                name={`${name}-max-players`}
                type="number"
                min="1"
                value={maxPlayers}
                onChange={(event) => {
                  setMaxPlayers(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Ej. 5"
              />
            </label>

            <label htmlFor={`${id}-sort-select`}>
              <span>Orden</span>
              <select
                id={`${id}-sort-select`}
                name={`${name}-sort`}
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="best-fit">Mejor ajuste</option>
                <option value="selected">Seleccionado primero</option>
                <option value="name">Nombre</option>
                <option value="min-players">Min. jugadores</option>
                <option value="max-players">Max. jugadores</option>
                <option value="weight">Dureza</option>
              </select>
            </label>
          </div>

          <GameMetadataFilterControls
            idPrefix={`${id}-metadata-filter`}
            games={games}
            metadataFilters={metadataFilters}
            rangeFilters={rangeFilters}
            resetSignal={resetSignal}
            onMetadataFiltersChange={(nextFilters) => {
              setMetadataFilters(nextFilters);
              setActiveIndex(0);
            }}
            onRangeFiltersChange={(nextFilters) => {
              setRangeFilters(nextFilters);
              setActiveIndex(0);
            }}
          />

          <GameActiveFilterSummary
            filters={activeFilters}
            resultCount={filteredGames.length}
            totalCount={games.length}
            onReset={resetFilters}
          />

          <div id={`${id}-options`} className="game-picker-options" role="listbox" aria-labelledby={labelId}>
            {filteredGames.map((game, index) => (
              <button
                id={`${id}-option-${game.id}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                key={game.id}
                role="option"
                aria-selected={game.id === value}
                className={game.id === value ? "game-picker-option selected" : "game-picker-option"}
                onClick={() => selectGame(game.id)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index, game.id)}
              >
                <img src={gameImageSrc(game)} alt="" className="game-picker-option-thumb" loading="lazy" />
                <span className="game-picker-option-copy">
                  <strong><HighlightedGameName name={game.name} query={query} /></strong>
                  <small>
                    {playersLabel(game)}
                    {game.playingTime ? ` - ${game.playingTime} min` : ""}
                    {game.averageWeight ? ` - Peso ${game.averageWeight.toFixed(1)}/5` : ""}
                  </small>
                </span>
              </button>
            ))}
            {filteredGames.length === 0 ? (
              <p className="status-line">No hay juegos que encajen con esos filtros.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
