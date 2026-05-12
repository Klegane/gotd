## ADDED Requirements

### Requirement: Dropdown game picker displays visual game options
The system SHALL provide a reusable single-select game picker that opens as a dropdown and displays matching games in a responsive grid with each game's name and thumbnail.

#### Scenario: Player opens the session detail proposal picker
- **WHEN** a player opens `session-detail-proposal-game-select`
- **THEN** the system displays a dropdown grid of catalog games with each game's name and thumbnail
- **AND** each game thumbnail uses `thumbnailUrl`, then `imageUrl`, then `/placeholder-game.svg` as fallback

#### Scenario: Player selects a game from the dropdown grid
- **WHEN** a player selects a game option from the picker grid
- **THEN** the system updates the selected proposal game id to that game's id
- **AND** the proposal and priority buttons submit the selected game through the existing proposal flow

### Requirement: Game picker search and filters match curation discovery
The system SHALL use shared game discovery behavior for game-picking and curation surfaces that search catalog games.

#### Scenario: Player searches by game name
- **WHEN** a player types a game name query in a game picker search input
- **THEN** the picker filters games using the same normalized name matching behavior as `dashboard-game-curation-search-input`
- **AND** matching text is highlighted consistently with curation search results

#### Scenario: Player filters by player count
- **WHEN** a player enters minimum or maximum group size filters in a game picker
- **THEN** the picker filters games using the same player-count compatibility rules as the game curation panel
- **AND** unavailable player-count metadata does not hide a game unless the shared curation logic would hide it

#### Scenario: Player changes sort mode
- **WHEN** a player changes the picker sort mode
- **THEN** the picker orders games using the same supported sort modes and comparison rules as the game curation panel

### Requirement: Proposal game selectors share the reusable picker
The system SHALL use the reusable game picker for player proposal game selection anywhere proposal controls are rendered.

#### Scenario: Dashboard proposal controls are available
- **WHEN** the dashboard renders proposal controls for a session that allows player proposals
- **THEN** `dashboard-proposal-game-select` displays the reusable thumbnail grid picker instead of a name-only native select
- **AND** selecting and submitting a game preserves the existing proposal API request behavior

#### Scenario: Session detail proposal controls are available
- **WHEN** the session detail view renders proposal controls for a session that allows player proposals
- **THEN** `session-detail-proposal-game-select` displays the reusable thumbnail grid picker instead of a name-only native select
- **AND** selecting and submitting a game preserves the existing proposal API request behavior

### Requirement: Game picker remains accessible and responsive
The system SHALL keep the game picker usable with keyboard navigation, screen readers, and narrow viewports.

#### Scenario: Player uses keyboard controls
- **WHEN** focus is on the game picker trigger
- **THEN** the player can open the dropdown, move through available options, close it without changing selection, and select an option without using a pointer

#### Scenario: Player uses a narrow viewport
- **WHEN** the game picker dropdown is displayed on a narrow viewport
- **THEN** the dropdown remains within the available viewport width
- **AND** option text, thumbnails, and filter controls do not overlap
