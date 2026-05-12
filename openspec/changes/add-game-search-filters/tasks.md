## 1. Catalog Metadata

- [x] 1.1 Add `categories`, `mechanisms`, `families`, `designers`, and `artists` array fields with empty defaults to `prisma/schema.prisma`.
- [x] 1.2 Create the Prisma migration for the new game metadata fields and regenerate the Prisma client.
- [x] 1.3 Extend BGG catalog/detail types so parsed games carry category, mechanism, family, designer, and artist labels.
- [x] 1.4 Parse taxonomy and credit labels from BGG detail XML/page preload data, dedupe and trim labels, and preserve existing image/player/time/weight parsing.
- [x] 1.5 Persist the new metadata arrays during game upsert and keep omitted metadata as empty arrays.
- [x] 1.6 Update catalog/session game payload typing so frontend callers receive the new metadata arrays.

## 2. Shared Discovery Logic

- [x] 2.1 Extend `GameDiscoveryItem` and discovery options with metadata facets plus playing-time and weight range filters.
- [x] 2.2 Add shared helpers to derive deduped, sorted filter option lists from the current games list.
- [x] 2.3 Implement OR-within-facet and AND-across-facets filtering for Category, Mechanism, Family, Designer, and Artist.
- [x] 2.4 Implement inclusive minimum/maximum filters for Playing Time and Weight.
- [x] 2.5 Preserve existing name search, player-count compatibility, selected-first ordering, sort modes, suggestions, and highlight behavior.

## 3. Game Picker UI

- [x] 3.1 Add metadata filter state to `GamePickerDropdown` and pass it into shared discovery.
- [x] 3.2 Render labelled Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight controls inside the picker dropdown opened from `game-picker-trigger-content`.
- [x] 3.3 Ensure picker empty state, selected-game trigger display, keyboard navigation, and `onChange(gameId)` selection behavior remain intact with filters active.
- [x] 3.4 Update picker styles so search, metadata controls, and options fit without overlap on desktop and mobile.

## 4. Curation UI

- [x] 4.1 Add metadata filter state to `GameCurationPanel` and pass it into shared discovery.
- [x] 4.2 Render labelled Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight controls in curation panels, including `dashboard-game-curation-panel`.
- [x] 4.3 Ensure the add-filtered action uses the current metadata-filtered result set and preserves already-selected hidden games.
- [x] 4.4 Ensure saving curation submits the selected ids through the existing save flow without filter-only side effects.
- [x] 4.5 Update curation styles so the expanded controls remain readable and responsive.

## 5. Tests and Verification

- [x] 5.1 Update BGG parser/import tests for taxonomy and credit extraction, deduplication, and empty metadata fallback.
- [x] 5.2 Add shared discovery tests for facet filters, playing-time ranges, weight ranges, missing metadata, and combinations with existing filters.
- [x] 5.3 Update game picker component tests to verify metadata controls filter options and selected results still submit the chosen game id.
- [x] 5.4 Update curation component/dashboard tests to verify metadata controls filter rows and the add-filtered action selects only the visible filtered games.
- [x] 5.5 Run `npm test`.
- [x] 5.6 Run `npm run build`.
- [ ] 5.7 Perform a browser smoke check of the picker dropdown and dashboard curation panel at desktop and mobile widths.
