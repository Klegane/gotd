## ADDED Requirements

### Requirement: Session proposal policy
The system SHALL allow each voting session to configure whether authenticated players may propose additional games for that session.

#### Scenario: Creator opens a session to proposals
- **WHEN** a creator or admin creates or updates a session with player proposals enabled
- **THEN** the system allows authenticated players to propose eligible active catalog games for that session

#### Scenario: Creator closes a session to proposals
- **WHEN** a creator or admin creates or updates a session with player proposals disabled
- **THEN** the system prevents non-admin players from adding proposed games to that session

### Requirement: Player game proposals
The system SHALL let authenticated players propose active catalog games when a session is open to proposals.

#### Scenario: Player proposes an eligible game
- **WHEN** an authenticated player proposes an active catalog game for a session that allows proposals
- **THEN** the system records the player's proposal and makes the game eligible for voting in that session

#### Scenario: Player proposes a game already eligible
- **WHEN** an authenticated player proposes an active catalog game that is already eligible for the session
- **THEN** the system records that player's proposal without creating a duplicate session game option

#### Scenario: Player proposes when proposals are closed
- **WHEN** an authenticated non-admin player attempts to propose a game for a session that does not allow player proposals
- **THEN** the system rejects the proposal and leaves the session options unchanged

#### Scenario: Player proposes an unavailable game
- **WHEN** an authenticated player attempts to propose an inactive, missing, or non-catalog game
- **THEN** the system rejects the proposal and leaves the session options unchanged

### Requirement: Creator options
The system SHALL distinguish creator/admin options from player proposals for each session.

#### Scenario: Creator adds session options
- **WHEN** a creator or admin adds active catalog games while creating or editing a session
- **THEN** the system records those games as creator/admin options for that session

#### Scenario: Session state includes proposal metadata
- **WHEN** an authenticated user views a session with creator options and player proposals
- **THEN** the system returns each eligible game's proposal source metadata and proposer information needed by the UI

### Requirement: Restrictive closed-proposal cost
The system SHALL charge the session creator a configured priority-point cost when a session is closed to player proposals and has fewer than three creator/admin options.

#### Scenario: Closed-proposal session has fewer than three creator options
- **WHEN** a non-admin creator saves a closed-proposal session with fewer than three creator/admin options
- **THEN** the system charges the configured control cost based on the number of missing options

#### Scenario: Creator lacks points for restrictive session
- **WHEN** a non-admin creator attempts to save a closed-proposal session and lacks enough available priority points for the control cost
- **THEN** the system rejects the session change and explains the required point cost

#### Scenario: Closed-proposal session has at least three creator options
- **WHEN** a creator or admin saves a closed-proposal session with at least three creator/admin options
- **THEN** the system saves the session without charging a restrictive-session control cost

#### Scenario: Open-proposal session has fewer than three creator options
- **WHEN** a creator or admin saves an open-proposal session with fewer than three creator/admin options
- **THEN** the system saves the session without charging a restrictive-session control cost
