## Why

Large catalogs are difficult to navigate when game search is limited to name and player-count metadata. Players and curators often know they want a type of game, designer, artist, play length, or complexity before they know the exact title.

## What Changes

- Add shared discovery filters for Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight.
- Make those filters available in the game picker dropdown used by proposal controls, including the `game-picker-trigger-content` surface when the picker is opened.
- Make the same filters available in the dashboard/session curation panel, including the `dashboard-game-curation-panel` surface.
- Extend game discovery data so each game can expose BoardGameGeek taxonomy and credit metadata needed by the new filters.
- Preserve existing name search, player-count filters, sort modes, thumbnails, highlighting, selection, and save/submit behavior.

## Capabilities

### New Capabilities
- `game-metadata-discovery-filters`: Covers shared filtering of catalog games by taxonomy, credits, playing time, and weight across game picker and curation surfaces.

### Modified Capabilities

## Impact

- Affected code: `src/components/gameDiscovery.ts`, `src/components/GamePickerDropdown.tsx`, `src/components/GameCurationPanel.tsx`, `src/components/VotingDashboard.tsx`, `src/components/SessionDetailView.tsx`, `src/app/globals.css`, and focused React tests.
- Affected catalog/import code: `src/server/bgg.ts`, `src/server/games.ts`, catalog API responses, Prisma schema, migrations, and BGG parser tests if taxonomy metadata is not already persisted.
- Affected UI: proposal game pickers such as `dashboard-proposal-game-select` and `session-detail-proposal-game-select`, plus the dashboard/session curation panels that share `GameCurationPanel`.
- Dependencies: no new runtime dependency expected; use existing BGG XML/page parsing and shared React controls unless implementation proves otherwise.
