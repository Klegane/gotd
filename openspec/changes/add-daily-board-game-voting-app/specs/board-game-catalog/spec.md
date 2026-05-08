## ADDED Requirements

### Requirement: BoardGameGeek collection import
The system SHALL import available board games from a configured BoardGameGeek user collection without requiring a BoardGameGeek authentication token and store them in the local catalog.

#### Scenario: Catalog refresh succeeds
- **WHEN** an authenticated user starts a catalog refresh and BoardGameGeek returns collection data
- **THEN** the system stores new games, updates existing games by BoardGameGeek id, records sync metadata, and makes the refreshed catalog available locally

#### Scenario: Catalog refresh uses browser collection response
- **WHEN** a BoardGameGeek geekcollection response includes board game links with ids, titles, and published years
- **THEN** the system imports those games into the local catalog without requiring a BoardGameGeek token

#### Scenario: Catalog item disappears from latest import
- **WHEN** a previously imported game is absent from a later successful BoardGameGeek import
- **THEN** the system marks the game inactive without deleting historical votes that reference it

### Requirement: BoardGameGeek import resilience
The system SHALL handle BoardGameGeek queued, throttled, and failed responses without losing the last successful catalog.

#### Scenario: BoardGameGeek returns queued response
- **WHEN** BoardGameGeek responds that the collection export is queued
- **THEN** the system retries the import after a delay and reports the sync as pending until it succeeds or reaches the retry limit

#### Scenario: BoardGameGeek refresh fails
- **WHEN** BoardGameGeek cannot provide collection data during a refresh
- **THEN** the system records the failure, keeps the last successful catalog visible, and does not delete or deactivate games based on the failed run

### Requirement: Catalog browsing
The system SHALL allow authenticated users to browse the active local catalog used for voting.

#### Scenario: User opens catalog
- **WHEN** an authenticated user opens the game catalog
- **THEN** the system lists active imported games with their names and available BoardGameGeek metadata

#### Scenario: No catalog has been imported
- **WHEN** an authenticated user opens the catalog before any successful import
- **THEN** the system explains that no games are available yet and offers a catalog refresh action

### Requirement: Catalog detail enrichment
The system SHALL enrich imported BoardGameGeek games with publicly available detail metadata including images, player counts, estimated playing time, and average complexity weight.

#### Scenario: Detail metadata is available
- **WHEN** BoardGameGeek returns thing detail metadata for imported games
- **THEN** the system stores each game's image URLs, minimum and maximum player counts, estimated playing time, and average complexity weight

#### Scenario: Detail metadata is unavailable
- **WHEN** BoardGameGeek cannot provide detail metadata for one or more imported games
- **THEN** the system keeps the imported games in the catalog with any metadata already known

### Requirement: Expansion filtering
The system SHALL exclude BoardGameGeek expansions from the default available-games catalog unless expansion inclusion is explicitly enabled by configuration.

#### Scenario: Default refresh receives expansions
- **WHEN** a BoardGameGeek refresh includes collection entries that are expansions
- **THEN** the system excludes those entries from the active voting catalog by default
