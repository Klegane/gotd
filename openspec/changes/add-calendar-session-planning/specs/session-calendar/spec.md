## ADDED Requirements

### Requirement: Calendar session browsing
The system SHALL provide an authenticated calendar view of voting sessions across past, current, and future dates.

#### Scenario: User views a calendar range
- **WHEN** an authenticated user opens the calendar for a date range
- **THEN** the system returns voting sessions in that range with local date, scheduled time, title, status, current vote state, and result summary when results exist

#### Scenario: Calendar includes previous results
- **WHEN** a past session has stored votes
- **THEN** the calendar displays the winning or tied game summary for that session without requiring a new BoardGameGeek refresh

#### Scenario: Calendar includes future sessions
- **WHEN** an open future session exists
- **THEN** the calendar displays the session as votable before its scheduled date

### Requirement: Scheduled session details
The system SHALL store and display schedule details for each voting session.

#### Scenario: Session has schedule metadata
- **WHEN** a voting session has a title, local date, local start time, optional local end time, and notes
- **THEN** the system displays those details in the calendar and selected-session view

#### Scenario: Session has no custom title
- **WHEN** a default daily voting session has no admin-provided title
- **THEN** the system displays a sensible default title based on the local date

### Requirement: Future session voting
The system SHALL allow authenticated users to cast or change one vote for an open future voting session.

#### Scenario: User votes in a future session
- **WHEN** an authenticated user selects an eligible game for an open future session
- **THEN** the system stores that vote for the selected session without changing the user's vote in today's session

#### Scenario: User changes future vote
- **WHEN** an authenticated user already has a vote in a future session and selects another eligible game for that same session
- **THEN** the system replaces the existing vote for that session

#### Scenario: User attempts to vote in closed session
- **WHEN** an authenticated user attempts to vote in a closed or cancelled session
- **THEN** the system rejects the vote and preserves any existing vote for that session

### Requirement: Multiple sessions per day
The system SHALL support more than one voting session on the same local calendar date.

#### Scenario: Same day has multiple sessions
- **WHEN** two open sessions exist on the same local date with different scheduled times or titles
- **THEN** the calendar lists both sessions and keeps votes and results separate for each session

#### Scenario: Today flow remains available
- **WHEN** an authenticated user opens the default voting page
- **THEN** the system selects today's default open session or creates one if no session exists for the current local date
