## 1. Shared Game Discovery

- [x] 1.1 Extract normalization, query matching, player-count parsing, player-fit scoring, sort modes, and game comparison from `GameCurationPanel` into a shared helper or hook.
- [x] 1.2 Update `GameCurationPanel` to consume the shared discovery helper without changing its current filtering, sorting, suggestions, or selection behavior.
- [x] 1.3 Export or share the highlighted game name rendering used by curation so picker results highlight name matches consistently.

## 2. Game Picker Dropdown

- [x] 2.1 Add a reusable single-select `GamePickerDropdown` component with stable `id`, `name`, `games`, `value`, `onChange`, disabled, placeholder, and empty-state props.
- [x] 2.2 Render the picker trigger with the selected game's thumbnail and name, falling back to `/placeholder-game.svg` when no game image is available.
- [x] 2.3 Render the open dropdown panel with shared search, min/max player filters, sort select, and a responsive thumbnail option grid.
- [x] 2.4 Implement option selection, outside-click close, Escape close, focus handling, and keyboard selection behavior.
- [x] 2.5 Add responsive CSS for picker trigger, dropdown panel, filters, option grid, selected option state, and small viewports.

## 3. Proposal Selector Integration

- [x] 3.1 Replace the native `session-detail-proposal-game-select` select in `SessionDetailView` with the reusable picker while preserving `proposalGameId` state and proposal button behavior.
- [x] 3.2 Replace the native `dashboard-proposal-game-select` select in `VotingDashboard` with the reusable picker while preserving `proposalGameId` state and proposal button behavior.
- [x] 3.3 Keep existing proposal POST payloads unchanged for normal and priority proposals.
- [x] 3.4 Ensure proposal controls handle an empty catalog or unavailable selection with a clear disabled or empty state.

## 4. Verification

- [x] 4.1 Add or update React tests for opening the picker, filtering by text, selecting a game, and submitting a proposal from the dashboard.
- [x] 4.2 Add or update React tests or component coverage for the session detail proposal picker using thumbnails and shared filters.
- [x] 4.3 Add regression coverage that curation filtering still matches the previous search, min/max players, and sort behavior after extraction.
- [x] 4.4 Run the relevant unit/component test suite.
- [ ] 4.5 Perform a visual smoke check of dashboard and session detail proposal pickers on desktop and narrow viewport widths.
