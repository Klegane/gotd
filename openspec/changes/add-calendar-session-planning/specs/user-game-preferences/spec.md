## ADDED Requirements

### Requirement: Personal game preferences
The system SHALL allow each authenticated user to mark catalog games as favorite or vetoed.

#### Scenario: User marks favorite
- **WHEN** an authenticated user marks an active catalog game as favorite
- **THEN** the system stores a favorite preference for that user and game

#### Scenario: User marks vetoed
- **WHEN** an authenticated user marks an active catalog game as vetoed
- **THEN** the system stores a vetoed preference for that user and game

#### Scenario: User clears preference
- **WHEN** an authenticated user clears their preference for a game
- **THEN** the system removes that user's preference for the game

### Requirement: Preference exclusivity
The system SHALL ensure a user has at most one preference state for a game.

#### Scenario: User changes favorite to vetoed
- **WHEN** an authenticated user marks a favorited game as vetoed
- **THEN** the system replaces the favorite preference with a vetoed preference

#### Scenario: User changes vetoed to favorite
- **WHEN** an authenticated user marks a vetoed game as favorite
- **THEN** the system replaces the vetoed preference with a favorite preference

### Requirement: Preferences in voting experience
The system SHALL include the current user's game preferences in catalog and session voting responses.

#### Scenario: User opens voting session
- **WHEN** an authenticated user opens a voting session
- **THEN** the system identifies which listed games are that user's favorites and which are vetoed

#### Scenario: Voting list contains preferences
- **WHEN** the voting UI renders games with preference metadata
- **THEN** favorites are visually promoted or marked, and vetoed games are visibly marked without deleting them from the shared catalog

#### Scenario: Preferences do not change global eligibility
- **WHEN** one user marks a game as vetoed
- **THEN** the system keeps the game eligible for other users unless the session's admin-curated game list excludes it
