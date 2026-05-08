## ADDED Requirements

### Requirement: Daily voting session
The system SHALL maintain one voting session per configured local calendar date.

#### Scenario: User opens today's vote for the first time
- **WHEN** an authenticated user opens the daily voting page and no session exists for the current local date
- **THEN** the system creates or selects a voting session for that date

#### Scenario: User opens today's existing vote
- **WHEN** an authenticated user opens the daily voting page and a session already exists for the current local date
- **THEN** the system displays that existing session rather than creating a duplicate

### Requirement: Single current vote per user
The system SHALL allow each authenticated user to have one current vote per daily voting session.

#### Scenario: User casts first vote of the day
- **WHEN** an authenticated user selects an active catalog game for today's voting session
- **THEN** the system stores the vote for that user and session

#### Scenario: User changes vote
- **WHEN** an authenticated user who already voted selects a different active catalog game for the same daily session
- **THEN** the system updates the existing vote instead of creating a second vote

#### Scenario: User votes for inactive game
- **WHEN** an authenticated user attempts to vote for an inactive or unknown game
- **THEN** the system rejects the vote and preserves the user's previous vote, if any

### Requirement: Vote results
The system SHALL calculate vote totals for each daily voting session from stored votes.

#### Scenario: User views current results
- **WHEN** an authenticated user opens the results for a daily voting session
- **THEN** the system displays vote totals grouped by game and identifies the current highest-voted game or tied games

#### Scenario: Session has no votes
- **WHEN** an authenticated user opens results for a session with no votes
- **THEN** the system displays an empty-results state without selecting a winner

### Requirement: Voting history
The system SHALL preserve previous daily voting sessions and their results.

#### Scenario: User opens voting history
- **WHEN** an authenticated user opens voting history
- **THEN** the system lists previous daily sessions with their vote totals and winning or tied games
