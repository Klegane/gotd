## Context

`SessionDetailView` and `VotingDashboard` both expose proposal controls backed by `proposalGameId`, but each currently renders a native `<select>` containing only game names. `GameCurationPanel` already implements richer client-side discovery for the same catalog data: normalized name search, min/max player filters, sort modes, suggestions, and selected-first ordering.

The catalog `Game` shape already contains `thumbnailUrl`, `imageUrl`, player counts, playing time, and weight. Existing game cards and result rows already use `game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"`, so the picker can rely on existing data and fallback behavior without API changes.

## Goals / Non-Goals

**Goals:**
- Provide a reusable single-select game picker that behaves like a dropdown and displays options in a responsive thumbnail grid.
- Make proposal game selection in session detail and dashboard use the same discovery controls and filtering semantics as curation.
- Extract shared search/filter/sort utilities so future game-searching components do not reimplement catalog discovery differently.
- Preserve existing proposal button behavior, priority proposal behavior, selected `gameId` state, and POST payloads.
- Keep keyboard, focus, and screen-reader behavior coherent for a custom dropdown.

**Non-Goals:**
- Change proposal permissions, proposal APIs, catalog loading, or session state payloads.
- Replace the curation panel's multi-select management workflow with a dropdown.
- Add server-side search or pagination.
- Introduce a new UI dependency.

## Decisions

### Extract shared game discovery logic

Move normalization, positive integer parsing, player-fit scoring, game comparison, filtering, and sorting into a shared module or hook, for example `src/components/gameDiscovery.ts` or `useGameDiscovery`. `GameCurationPanel` and the new picker should both consume this logic.

Rationale: the app already has useful curation behavior, and extracting it avoids two subtly different definitions of "search by game" as more surfaces are added.

Alternative considered: copy the filtering code into a new picker component. This is faster initially but directly conflicts with the goal of homogeneous game search.

### Introduce a single-select `GamePickerDropdown`

Create a reusable component for choosing one game from a catalog:
- Props should include `id`, `name`, `label`, `games`, `value`, `onChange`, optional `disabled`, and optional empty text.
- The trigger should show the selected game's thumbnail and name, or a placeholder when nothing is selected.
- Opening the trigger should reveal a dropdown panel containing search, min/max player filters, sort selection, and a responsive option grid.
- Each grid option should show thumbnail, name, and compact metadata such as player range and playing time.
- Selecting an option should update `value` through `onChange` and close the dropdown.

Rationale: proposal controls need one selected game, not the curation panel's bulk-selection actions. A single-select component keeps proposal markup simple while reusing discovery logic.

Alternative considered: use the native `<select>` with richer labels. Native options cannot reliably render thumbnails or a custom grid across browsers.

### Keep IDs stable where users and tests already rely on them

The session detail proposal picker should preserve `session-detail-proposal-game-select` as the main control id. The dashboard proposal picker should preserve `dashboard-proposal-game-select`. Derived controls may use suffixes such as `-search-input`, `-min-players-input`, `-max-players-input`, `-sort-select`, and `-option-<gameId>`.

Rationale: existing tests and user-visible automation hooks can continue to locate proposal controls while gaining richer behavior.

Alternative considered: adopt a new id prefix for the component. That is cleaner internally but causes unnecessary test churn.

### Share visual language with existing catalog cards, not full cards

The dropdown option grid should use compact option tiles with stable thumbnail dimensions and concise metadata. It should not embed full `.game-card` voting controls inside the dropdown.

Rationale: a dropdown needs fast scanning and selection; full voting cards include actions and preference controls that would make the menu noisy and fragile.

Alternative considered: reuse full catalog card markup. This would create a heavy dropdown and mix selection with unrelated game actions.

## Risks / Trade-offs

- Custom dropdown accessibility can regress compared with native select -> Use a button/listbox pattern with explicit labels, focus handling, Escape/outside-click close behavior, and tests around opening and selecting.
- Large catalogs can make an open dropdown expensive -> Filter and sort with `useMemo`, cap suggestion-style affordances if needed, and keep option tiles lightweight.
- Shared extraction can accidentally change curation ordering -> Preserve current `GameCurationPanel` filter and sort semantics with focused tests before applying the shared helper there.
- Dropdown panels can overflow small screens -> Use constrained max-height, internal scrolling, and responsive grid columns that collapse to one column on narrow widths.
