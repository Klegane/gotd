export type SortMode = "best-fit" | "selected" | "name" | "min-players" | "max-players" | "weight";
export type GameMetadataFacet = "categories" | "mechanisms" | "families" | "designers" | "artists";

export type GameMetadataFilters = Record<GameMetadataFacet, string[]>;

export type GameRangeFilters = {
  minPlayingTime: string;
  maxPlayingTime: string;
  minWeight: string;
  maxWeight: string;
};

export type ActiveGameDiscoveryFilter = {
  id: string;
  label: string;
  value: string;
};

export const gameMetadataFacetConfigs: Array<{ key: GameMetadataFacet; label: string; id: string }> = [
  { key: "categories", label: "Categoria", id: "category" },
  { key: "mechanisms", label: "Mecanismo", id: "mechanism" },
  { key: "families", label: "Familia", id: "family" },
  { key: "designers", label: "Disenador", id: "designer" },
  { key: "artists", label: "Artista", id: "artist" }
];

export type GameDiscoveryItem = {
  id: string;
  name: string;
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
};

export type GameDiscoveryOptions = {
  query: string;
  minPlayers: string;
  maxPlayers: string;
  sortMode: SortMode;
  metadataFilters?: GameMetadataFilters;
  rangeFilters?: GameRangeFilters;
  selectedIds?: Set<string>;
};

export function filterAndSortGames<T extends GameDiscoveryItem>(
  games: T[],
  {
    query,
    minPlayers,
    maxPlayers,
    sortMode,
    metadataFilters = createEmptyMetadataFilters(),
    rangeFilters = createEmptyRangeFilters(),
    selectedIds = new Set<string>()
  }: GameDiscoveryOptions
): T[] {
  const normalizedQuery = normalizeGameQuery(query);
  const minPlayerCount = parsePositiveInt(minPlayers);
  const maxPlayerCount = parsePositiveInt(maxPlayers);
  const minPlayingTime = parseNonNegativeInt(rangeFilters.minPlayingTime);
  const maxPlayingTime = parseNonNegativeInt(rangeFilters.maxPlayingTime);
  const minWeight = parseNonNegativeFloat(rangeFilters.minWeight);
  const maxWeight = parseNonNegativeFloat(rangeFilters.maxWeight);

  return games
    .filter((game) =>
      gameMatchesDiscoveryFilters(
        game,
        normalizedQuery,
        minPlayerCount,
        maxPlayerCount,
        metadataFilters,
        minPlayingTime,
        maxPlayingTime,
        minWeight,
        maxWeight
      )
    )
    .sort((left, right) => compareGames(left, right, sortMode, selectedIds, minPlayerCount, maxPlayerCount));
}

export function gameSuggestions<T extends GameDiscoveryItem>(games: T[], query: string, limit = 6): T[] {
  const normalizedQuery = normalizeGameQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  return games
    .filter((game) => normalizeGameQuery(game.name).includes(normalizedQuery))
    .slice(0, limit);
}

export function gameImageSrc(game: Pick<GameDiscoveryItem, "thumbnailUrl" | "imageUrl">): string {
  return game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg";
}

export function createEmptyMetadataFilters(): GameMetadataFilters {
  return {
    categories: [],
    mechanisms: [],
    families: [],
    designers: [],
    artists: []
  };
}

export function createEmptyRangeFilters(): GameRangeFilters {
  return {
    minPlayingTime: "",
    maxPlayingTime: "",
    minWeight: "",
    maxWeight: ""
  };
}

export function gameMetadataFilterOptions<T extends GameDiscoveryItem>(games: T[]): Record<GameMetadataFacet, string[]> {
  const options = createEmptyMetadataFilters();
  const seen: Record<GameMetadataFacet, Set<string>> = {
    categories: new Set(),
    mechanisms: new Set(),
    families: new Set(),
    designers: new Set(),
    artists: new Set()
  };

  for (const game of games) {
    for (const { key } of gameMetadataFacetConfigs) {
      for (const label of game[key]) {
        const normalized = normalizeGameQuery(label);

        if (!normalized || seen[key].has(normalized)) {
          continue;
        }

        seen[key].add(normalized);
        options[key].push(label);
      }
    }
  }

  for (const { key } of gameMetadataFacetConfigs) {
    options[key].sort((left, right) => left.localeCompare(right, "es-ES"));
  }

  return options;
}

export function activeGameDiscoveryFilters({
  query,
  minPlayers,
  maxPlayers,
  metadataFilters = createEmptyMetadataFilters(),
  rangeFilters = createEmptyRangeFilters()
}: Pick<GameDiscoveryOptions, "query" | "minPlayers" | "maxPlayers"> & {
  metadataFilters?: GameMetadataFilters;
  rangeFilters?: GameRangeFilters;
}): ActiveGameDiscoveryFilter[] {
  const filters: ActiveGameDiscoveryFilter[] = [];
  const trimmedQuery = query.trim();
  const trimmedMinPlayers = minPlayers.trim();
  const trimmedMaxPlayers = maxPlayers.trim();

  if (trimmedQuery) {
    filters.push({ id: "query", label: "Busqueda", value: trimmedQuery });
  }

  if (trimmedMinPlayers) {
    filters.push({ id: "min-players", label: "Grupo min.", value: trimmedMinPlayers });
  }

  if (trimmedMaxPlayers) {
    filters.push({ id: "max-players", label: "Grupo max.", value: trimmedMaxPlayers });
  }

  for (const facet of gameMetadataFacetConfigs) {
    for (const value of metadataFilters[facet.key]) {
      filters.push({
        id: `${facet.id}-${filterIdSegment(value)}`,
        label: facet.label,
        value
      });
    }
  }

  addRangeFilter(filters, "min-playing-time", "Tiempo min.", rangeFilters.minPlayingTime, " min");
  addRangeFilter(filters, "max-playing-time", "Tiempo max.", rangeFilters.maxPlayingTime, " min");
  addRangeFilter(filters, "min-weight", "Peso min.", rangeFilters.minWeight, "/5");
  addRangeFilter(filters, "max-weight", "Peso max.", rangeFilters.maxWeight, "/5");

  return filters;
}

export function playersLabel(game: Pick<GameDiscoveryItem, "minPlayers" | "maxPlayers">): string {
  if (game.minPlayers && game.maxPlayers && game.minPlayers !== game.maxPlayers) {
    return `${game.minPlayers}-${game.maxPlayers} jugadores`;
  }

  if (game.minPlayers || game.maxPlayers) {
    return `${game.minPlayers ?? game.maxPlayers} jugadores`;
  }

  return "Jugadores desconocido";
}

export function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeGameQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();
}

function gameMatchesDiscoveryFilters(
  game: GameDiscoveryItem,
  normalizedQuery: string,
  minPlayers: number | null,
  maxPlayers: number | null,
  metadataFilters: GameMetadataFilters,
  minPlayingTime: number | null,
  maxPlayingTime: number | null,
  minWeight: number | null,
  maxWeight: number | null
): boolean {
  if (normalizedQuery && !normalizeGameQuery(game.name).includes(normalizedQuery)) {
    return false;
  }

  if (minPlayers && game.maxPlayers !== null && game.maxPlayers < minPlayers) {
    return false;
  }

  if (maxPlayers && game.minPlayers !== null && game.minPlayers > maxPlayers) {
    return false;
  }

  for (const { key } of gameMetadataFacetConfigs) {
    if (!matchesMetadataFacet(game[key], metadataFilters[key])) {
      return false;
    }
  }

  if (!matchesNumberRange(game.playingTime, minPlayingTime, maxPlayingTime)) {
    return false;
  }

  if (!matchesNumberRange(game.averageWeight, minWeight, maxWeight)) {
    return false;
  }

  return true;
}

function matchesMetadataFacet(values: string[], selectedValues: string[]): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (values.length === 0) {
    return false;
  }

  const normalizedValues = new Set(values.map(normalizeGameQuery));
  return selectedValues.some((value) => normalizedValues.has(normalizeGameQuery(value)));
}

function matchesNumberRange(value: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) {
    return true;
  }

  if (value === null) {
    return false;
  }

  if (min !== null && value < min) {
    return false;
  }

  if (max !== null && value > max) {
    return false;
  }

  return true;
}

function compareGames(
  left: GameDiscoveryItem,
  right: GameDiscoveryItem,
  sortMode: SortMode,
  selectedIds: Set<string>,
  minPlayers: number | null,
  maxPlayers: number | null
): number {
  if (sortMode === "selected") {
    const selectedDifference = Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));

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

function playerFitScore(game: GameDiscoveryItem, minPlayers: number | null, maxPlayers: number | null): number {
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

function compareNames(left: Pick<GameDiscoveryItem, "name">, right: Pick<GameDiscoveryItem, "name">): number {
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

function addRangeFilter(
  filters: ActiveGameDiscoveryFilter[],
  id: string,
  label: string,
  value: string,
  suffix: string
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return;
  }

  filters.push({ id, label, value: `${trimmed}${suffix}` });
}

function filterIdSegment(value: string): string {
  return normalizeGameQuery(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "value";
}

function parseNonNegativeInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseNonNegativeFloat(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
