## ADDED Requirements

### Requirement: Catalog games expose metadata for discovery filters
The system SHALL store and return catalog game metadata needed to filter by Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight.

#### Scenario: BoardGameGeek detail metadata includes taxonomy and credits
- **WHEN** a catalog refresh receives BoardGameGeek detail metadata with category, mechanism, family, designer, or artist links for a game
- **THEN** the system stores those labels on the local game record
- **AND** duplicate or blank labels are not stored

#### Scenario: BoardGameGeek detail metadata omits taxonomy and credits
- **WHEN** a catalog refresh cannot find category, mechanism, family, designer, or artist metadata for a game
- **THEN** the system keeps the game active with empty metadata lists for the omitted fields

#### Scenario: Catalog games are returned to the frontend
- **WHEN** the frontend loads catalog or session game data used by game pickers and curation panels
- **THEN** each game payload includes category, mechanism, family, designer, and artist lists
- **AND** each game payload continues to include playing time and average weight values when available

### Requirement: Shared game discovery supports metadata filters
The system SHALL apply metadata filters through shared game discovery behavior used by game-picking and curation surfaces.

#### Scenario: User filters by taxonomy or credit facet
- **WHEN** a user selects one or more Category, Mechanism, Family, Designer, or Artist values
- **THEN** the shared discovery results include only games that match at least one selected value within each active facet
- **AND** active facets combine together so a game must satisfy every active facet

#### Scenario: User filters by playing time
- **WHEN** a user enters a minimum or maximum Playing Time filter
- **THEN** the shared discovery results include only games whose playing time is inside the inclusive range

#### Scenario: User filters by weight
- **WHEN** a user enters a minimum or maximum Weight filter
- **THEN** the shared discovery results include only games whose average weight is inside the inclusive range

#### Scenario: Game metadata is missing
- **WHEN** a metadata filter is active and a game does not have a value for that metadata
- **THEN** the shared discovery results exclude that game
- **AND** missing metadata does not exclude games when the corresponding filter is inactive

#### Scenario: Existing discovery behavior remains available
- **WHEN** a user combines metadata filters with name search, player-count filters, or sort modes
- **THEN** the system applies all active filters together
- **AND** existing normalized name matching, player-count compatibility, selected-first behavior, and sort comparison rules continue to work

### Requirement: Game picker dropdown exposes metadata filter controls
The system SHALL let users filter game picker dropdown results by Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight.

#### Scenario: User opens a game picker
- **WHEN** a user opens a `GamePickerDropdown` from a trigger containing `game-picker-trigger-content`
- **THEN** the dropdown displays filter controls for Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight
- **AND** the controls derive their available values from the games passed to that picker

#### Scenario: User filters picker results
- **WHEN** a user changes a metadata filter in the game picker dropdown
- **THEN** the picker option list updates to show only games matching the active filters
- **AND** selecting a filtered option still calls the existing picker change handler with that game's id

#### Scenario: Picker has no matching games
- **WHEN** active picker filters match no games
- **THEN** the picker displays the existing empty-results state for filtered games
- **AND** the closed picker trigger preserves its selected game display when one is already selected

#### Scenario: Picker remains accessible and responsive
- **WHEN** the picker is used with keyboard navigation, screen readers, or a narrow viewport
- **THEN** metadata filter controls are labelled, reachable, and do not overlap search, result, or trigger content

### Requirement: Curation panel exposes metadata filter controls
The system SHALL let curators filter curation panel results by Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight.

#### Scenario: Curator opens dashboard game curation
- **WHEN** a curator views `dashboard-game-curation-panel`
- **THEN** the panel displays filter controls for Category, Mechanism, Family, Designer, Artist, Playing Time, and Weight
- **AND** the controls derive their available values from the games passed to the panel

#### Scenario: Curator filters curation rows
- **WHEN** a curator changes a metadata filter in the curation panel
- **THEN** the curation list updates to show only games matching the active filters
- **AND** existing checkbox selection state remains preserved for games hidden by filters

#### Scenario: Curator adds filtered games
- **WHEN** a curator clicks the add-filtered action while metadata filters are active
- **THEN** the system adds only the currently filtered games to the selected curation set
- **AND** already-selected games remain selected

#### Scenario: Curator saves filtered curation changes
- **WHEN** a curator saves after using metadata filters
- **THEN** the system submits the selected game ids through the existing curation save behavior
- **AND** filtering does not create, remove, or reorder selected ids except through explicit curator selection actions
