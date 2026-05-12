"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  gameMetadataFacetConfigs,
  gameMetadataFilterOptions,
  normalizeGameQuery,
  type ActiveGameDiscoveryFilter,
  type GameDiscoveryItem,
  type GameMetadataFacet,
  type GameMetadataFilters,
  type GameRangeFilters
} from "@/components/gameDiscovery";

type GameMetadataFiltersProps = {
  idPrefix: string;
  games: GameDiscoveryItem[];
  metadataFilters: GameMetadataFilters;
  rangeFilters: GameRangeFilters;
  onMetadataFiltersChange: (filters: GameMetadataFilters) => void;
  onRangeFiltersChange: (filters: GameRangeFilters) => void;
  resetSignal?: number;
};

type GameActiveFilterSummaryProps = {
  filters: ActiveGameDiscoveryFilter[];
  resultCount: number;
  totalCount: number;
  onReset?: () => void;
  resetButtonId?: string;
};

type FacetQueryState = Record<GameMetadataFacet, string>;

export function GameMetadataFilterControls({
  idPrefix,
  games,
  metadataFilters,
  rangeFilters,
  onMetadataFiltersChange,
  onRangeFiltersChange,
  resetSignal = 0
}: GameMetadataFiltersProps) {
  const [facetQueries, setFacetQueries] = useState(createEmptyFacetQueries);
  const options = useMemo(() => gameMetadataFilterOptions(games), [games]);

  useEffect(() => {
    setFacetQueries(createEmptyFacetQueries());
  }, [resetSignal]);

  function toggleMetadataFilter(facet: GameMetadataFacet, value: string) {
    const current = metadataFilters[facet];
    const selected = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onMetadataFiltersChange({
      ...metadataFilters,
      [facet]: selected
    });
  }

  function updateFacetQuery(facet: GameMetadataFacet, value: string) {
    setFacetQueries({
      ...facetQueries,
      [facet]: value
    });
  }

  function updateRangeFilter(key: keyof GameRangeFilters, value: string) {
    onRangeFiltersChange({
      ...rangeFilters,
      [key]: value
    });
  }

  function focusSearchInputOnOpen(event: React.SyntheticEvent<HTMLDetailsElement>) {
    const details = event.currentTarget;

    if (!details.open) {
      return;
    }

    details.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }

  return (
    <div className="metadata-filter-controls">
      <div className="metadata-facet-controls">
        {gameMetadataFacetConfigs.map((facet) => {
          const facetOptions = options[facet.key];
          const facetQuery = facetQueries[facet.key];
          const normalizedFacetQuery = normalizeGameQuery(facetQuery);
          const visibleFacetOptions = normalizedFacetQuery
            ? facetOptions.filter((option) => normalizeGameQuery(option).includes(normalizedFacetQuery))
            : facetOptions;
          const selectedCount = metadataFilters[facet.key].length;

          return (
            <details
              id={`${idPrefix}-${facet.id}-filter`}
              key={facet.key}
              className="metadata-filter-group"
              onToggle={focusSearchInputOnOpen}
            >
              <summary id={`${idPrefix}-${facet.id}-summary`}>
                <span>{facet.label}</span>
                {selectedCount > 0 ? <small>{selectedCount}</small> : null}
              </summary>
              <div className="metadata-filter-body">
                <label className="metadata-filter-search" htmlFor={`${idPrefix}-${facet.id}-search-input`}>
                  <span>Buscar {facet.label}</span>
                  <input
                    id={`${idPrefix}-${facet.id}-search-input`}
                    type="search"
                    value={facetQuery}
                    onChange={(event) => updateFacetQuery(facet.key, event.target.value)}
                    placeholder={`Ej. ${facetOptions[0] ?? facet.label}`}
                    autoComplete="off"
                  />
                </label>
                <div className="metadata-filter-options">
                  {visibleFacetOptions.map((option, index) => {
                    const inputId = `${idPrefix}-${facet.id}-${optionIdSegment(option, index)}`;

                    return (
                      <label key={option} htmlFor={inputId} className="metadata-filter-option">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={metadataFilters[facet.key].includes(option)}
                          onChange={() => toggleMetadataFilter(facet.key, option)}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                  {facetOptions.length === 0 ? <p className="metadata-filter-empty">Sin opciones disponibles</p> : null}
                  {facetOptions.length > 0 && visibleFacetOptions.length === 0 ? (
                    <p className="metadata-filter-empty">Sin coincidencias</p>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="metadata-range-controls">
        <fieldset>
          <legend>Playing Time</legend>
          <label htmlFor={`${idPrefix}-min-playing-time-input`}>
            <span>Min</span>
            <input
              id={`${idPrefix}-min-playing-time-input`}
              type="number"
              min="0"
              value={rangeFilters.minPlayingTime}
              onChange={(event) => updateRangeFilter("minPlayingTime", event.target.value)}
              placeholder="30"
            />
          </label>
          <label htmlFor={`${idPrefix}-max-playing-time-input`}>
            <span>Max</span>
            <input
              id={`${idPrefix}-max-playing-time-input`}
              type="number"
              min="0"
              value={rangeFilters.maxPlayingTime}
              onChange={(event) => updateRangeFilter("maxPlayingTime", event.target.value)}
              placeholder="120"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Weight</legend>
          <label htmlFor={`${idPrefix}-min-weight-input`}>
            <span>Min</span>
            <input
              id={`${idPrefix}-min-weight-input`}
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rangeFilters.minWeight}
              onChange={(event) => updateRangeFilter("minWeight", event.target.value)}
              placeholder="1.5"
            />
          </label>
          <label htmlFor={`${idPrefix}-max-weight-input`}>
            <span>Max</span>
            <input
              id={`${idPrefix}-max-weight-input`}
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rangeFilters.maxWeight}
              onChange={(event) => updateRangeFilter("maxWeight", event.target.value)}
              placeholder="3.5"
            />
          </label>
        </fieldset>
      </div>
    </div>
  );
}

export function GameActiveFilterSummary({
  filters,
  resultCount,
  totalCount,
  onReset,
  resetButtonId
}: GameActiveFilterSummaryProps) {
  return (
    <div className="active-filter-summary">
      <div className="active-filter-status" role="status" aria-live="polite">
        <span className="active-filter-count">
          {resultCount} de {totalCount} juegos
        </span>
        {filters.length > 0 ? (
          <div className="active-filter-chips" aria-label="Filtros activos">
            {filters.map((filter) => (
              <span key={`${filter.id}-${filter.value}`} className="active-filter-chip">
                <strong>{filter.label}</strong>
                <span>{filter.value}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="active-filter-empty">Sin filtros activos</span>
        )}
      </div>
      {onReset ? (
        <button
          id={resetButtonId}
          type="button"
          className="button secondary reset-filters-button"
          onClick={onReset}
        >
          Restablecer filtros
        </button>
      ) : null}
    </div>
  );
}

function createEmptyFacetQueries(): FacetQueryState {
  return {
    categories: "",
    mechanisms: "",
    families: "",
    designers: "",
    artists: ""
  };
}

function optionIdSegment(value: string, index: number): string {
  const normalized = normalizeGameQuery(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || `option-${index}`;
}
