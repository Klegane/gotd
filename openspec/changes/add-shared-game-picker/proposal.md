## Why

Game proposal controls currently use plain native selects, so players must choose from the catalog by name only while nearby curation workflows already support richer search, player-count filters, sorting, and visual recognition. A shared game picker will make game discovery more consistent across proposal, curation, and other game-selection workflows.

## What Changes

- Replace the session detail proposal select `session-detail-proposal-game-select` with a dropdown picker that opens into a responsive grid of games.
- Show each game option with its name and thumbnail, using the existing game image fallback behavior.
- Add the same discovery controls used by the dashboard curation search experience: text search, min/max player filters, and useful ordering.
- Reuse one shared search/filter/sort implementation for game-picking surfaces so proposal selectors and curation selectors stay homogeneous.
- Apply the shared picker pattern to equivalent game proposal controls, including the dashboard proposal selector, while preserving existing proposal and priority submission behavior.
- Keep backend proposal APIs unchanged.

## Capabilities

### New Capabilities
- `shared-game-picker`: Covers reusable game discovery and selection UI for dropdown-style game pickers with thumbnails, grid options, and shared search/filter behavior.

### Modified Capabilities

None.

## Impact

- Affected code: `src/components/SessionDetailView.tsx`, `src/components/VotingDashboard.tsx`, `src/components/GameCurationPanel.tsx`, shared component files under `src/components/`, `src/app/globals.css`, and focused React tests.
- Affected UI: session detail proposal controls, dashboard proposal controls, and any future game-picking component that should share search/filter behavior.
- Affected behavior: client-side selection and filtering only; proposal submission payloads and server routes remain unchanged.
