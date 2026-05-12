## Context

`GamePickerDropdown` and `GameCurationPanel` already share `filterAndSortGames` from `src/components/gameDiscovery.ts`. Today that shared discovery layer supports normalized name search, min/max player compatibility filters, selected-first ordering, and sort modes.

The catalog `Game` model already stores `playingTime` and `averageWeight`, but it does not expose first-class fields for BoardGameGeek Category, Mechanism, Family, Designer, or Artist. `metadataJson` currently stores only lightweight import metadata such as `subtype` and `source`, so the new taxonomy and credit filters need data-model and import changes before the UI can filter reliably.

## Goals / Non-Goals

**Goals:**
- Add one shared filtering model that both game picker dropdowns and curation panels consume.
- Filter by Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight without changing existing search, sort, thumbnail, selection, save, or submit behavior.
- Persist and return the metadata needed for those filters from catalog APIs.
- Keep the controls usable in both the compact picker dropdown and the broader curation panel.

**Non-Goals:**
- Server-side catalog search or pagination for this change.
- User-authored custom categories, mechanisms, tags, or aliases.
- Ranking/recommendation logic beyond the existing sort modes and explicit filters.
- Changing vote, proposal, or curation persistence semantics.

## Decisions

### Store taxonomy and credit metadata as typed game fields

Add first-class array fields to `Game`: `categories`, `mechanisms`, `families`, `designers`, and `artists`, each defaulting to an empty array.

Rationale: these values are part of the catalog shape used by UI discovery. Typed arrays avoid parsing `metadataJson` in React, make API payloads explicit, and keep tests easy to read.

Alternative considered: store the new values inside `metadataJson`. That would avoid a migration, but it would make filtering depend on opaque JSON shape and would keep useful catalog metadata hidden from typed callers.

### Parse BGG links into normalized display labels

Extend BGG detail parsing to extract link labels for:
- `boardgamecategory`
- `boardgamemechanic`
- `boardgamefamily`
- `boardgamedesigner`
- `boardgameartist`

The parser should accept both XML `link` nodes from the BoardGameGeek thing response and equivalent link structures from the public page preload data when present. Values should be deduplicated, trimmed, and stored as display labels from BGG. Existing behavior for images, players, playing time, weight, expansion status, and parent/expansion links stays intact.

Alternative considered: maintain separate relational tables for taxonomy and credits. That is more queryable long term, but this app currently filters client-side over the active catalog payload, so arrays are the lower-complexity fit.

### Extend shared discovery options instead of duplicating filters

`GameDiscoveryItem` should include the five metadata arrays. `filterAndSortGames` should accept selected facet values and numeric range filters for playing time and weight.

Filtering semantics:
- Multiple selected values within one facet use OR semantics.
- Different active facets use AND semantics.
- Playing time and weight ranges are inclusive.
- Games with missing metadata do not match an active filter for that metadata, but inactive filters continue to leave those games visible.
- Existing name search, player filters, selected-first behavior, and sort modes remain unchanged.

Alternative considered: apply metadata filters separately inside each component. That would be quicker initially, but the picker and curation panel would drift the next time a filter rule changes.

### Share filter option derivation and UI affordances

Create shared helpers to derive available filter options from the current games list, sorted with `es-ES` collation and deduplicated by normalized label. Both `GamePickerDropdown` and `GameCurationPanel` should use the same option lists and state shape.

The picker can render compact filter groups inside the dropdown menu. The curation panel can render the same controls within `dashboard-game-curation-panel` and other `GameCurationPanel` instances. Numeric filters should be simple bounded number inputs for minutes and weight; facet filters should use accessible grouped checkbox controls or an equivalent native control that supports multiple selections.

Alternative considered: a single large reusable filter component for both layouts. This is acceptable if it stays flexible, but the implementation should not force picker layout and curation layout to become identical.

## Risks / Trade-offs

- Existing catalog rows lack taxonomy and credit values until refreshed -> default arrays to empty and keep games visible when metadata filters are inactive.
- BGG detail structures may differ between XML and public page preload data -> isolate extraction helpers and cover XML/page examples in `tests/bgg.test.ts`.
- Designer and artist lists can be long -> keep filter groups collapsible or visually compact and avoid expanding all options at once in narrow picker menus.
- Client-side filtering over large catalogs can become expensive -> memoize option derivation and filtered results, and avoid recomputing normalized labels inside tight loops where practical.
- UI density may make the picker feel crowded -> keep primary search at the top and secondary filters grouped below it, preserving keyboard navigation and no-overlap responsive layout.

## Migration Plan

1. Add Prisma fields for `categories`, `mechanisms`, `families`, `designers`, and `artists` with empty-array defaults.
2. Generate and apply a migration. Existing rows retain empty arrays.
3. Update BGG sync parsing/upsert logic so future refreshes populate the arrays.
4. Extend catalog/session payload types and UI filtering.
5. Backfill by running a catalog refresh after deployment; no one-off data migration is required beyond defaulting existing rows.

Rollback is straightforward: hide the new UI controls and stop using the fields. The added columns can remain harmlessly populated until a later cleanup migration if needed.

## Open Questions

- None for proposal scope. Use BGG display labels as-is unless implementation reveals duplicate labels that require a stronger canonicalization rule.
