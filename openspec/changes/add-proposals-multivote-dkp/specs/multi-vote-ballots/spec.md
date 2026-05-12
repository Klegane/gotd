## ADDED Requirements

### Requirement: Ballot vote limits
The system SHALL calculate per-player ballot limits from the number of eligible games in the session.

#### Scenario: Session has three or fewer eligible games
- **WHEN** an open session has three or fewer eligible games
- **THEN** the system allows each authenticated player to allocate one normal vote to one eligible game

#### Scenario: Session has more than three eligible games
- **WHEN** an open session has more than three eligible games
- **THEN** the system allows each authenticated player to allocate up to one fewer normal votes than the number of eligible games

#### Scenario: Player repeats votes on one game
- **WHEN** an authenticated player allocates multiple normal votes to the same eligible game within the session ballot limit
- **THEN** the system accepts the ballot and counts each allocated vote for that game

#### Scenario: Player votes for every eligible game
- **WHEN** an authenticated player submits a ballot that allocates at least one vote to every eligible game in the session
- **THEN** the system rejects the ballot because a player must not be able to vote for all available games

#### Scenario: Player exceeds total vote limit
- **WHEN** an authenticated player submits a ballot with more normal votes than the session limit
- **THEN** the system rejects the ballot and preserves the player's previous valid ballot, if any

### Requirement: Ballot replacement
The system SHALL treat each submitted ballot as the authenticated player's full current ballot for that session.

#### Scenario: Player submits first ballot
- **WHEN** an authenticated player submits a valid ballot for an open session
- **THEN** the system stores the ballot allocations for that player and session

#### Scenario: Player changes ballot
- **WHEN** an authenticated player who already has a ballot submits a different valid ballot for the same open session
- **THEN** the system replaces the previous allocations with the new allocations

#### Scenario: Player submits invalid ballot
- **WHEN** an authenticated player who already has a ballot submits an invalid ballot for the same session
- **THEN** the system rejects the new ballot and preserves the previous valid allocations

#### Scenario: Player votes in closed session
- **WHEN** an authenticated player submits a ballot for a closed or cancelled session
- **THEN** the system rejects the ballot and preserves any existing valid ballot for that session

### Requirement: Ballot-aware session state
The system SHALL return ballot state and limits in session responses.

#### Scenario: User views voting session
- **WHEN** an authenticated user opens a voting session
- **THEN** the system returns the user's current ballot allocations, the normal vote limit, and whether repeated votes are allowed

#### Scenario: Calendar summarizes current ballot
- **WHEN** an authenticated user views the calendar
- **THEN** the system summarizes the user's current ballot for each listed session without implying there is only one selected game

### Requirement: Result scoring
The system SHALL calculate session results from all ballot allocations and active point bids.

#### Scenario: Results contain normal votes only
- **WHEN** a session has ballots without point bids
- **THEN** the system totals each game's allocated normal votes and identifies the highest-scoring game or tied games

#### Scenario: Results contain normal votes and point bids
- **WHEN** a session has ballot allocations and active point bids
- **THEN** the system returns each game's normal vote count, bid point count, total score, and leader status

#### Scenario: Session has no ballots
- **WHEN** an authenticated user views results for a session without ballots or point bids
- **THEN** the system displays an empty-results state without selecting a winner
