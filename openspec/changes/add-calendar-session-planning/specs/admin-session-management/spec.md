## ADDED Requirements

### Requirement: Admin role authorization
The system SHALL restrict session planning and curation actions to authenticated admin users.

#### Scenario: Admin calls admin API
- **WHEN** an authenticated user with admin role calls a session management API
- **THEN** the system permits the action if the request is otherwise valid

#### Scenario: Non-admin calls admin API
- **WHEN** an authenticated user without admin role calls a session management API
- **THEN** the system rejects the request without changing session, vote, or catalog data

#### Scenario: Unauthenticated visitor calls admin API
- **WHEN** a request without a valid session calls a session management API
- **THEN** the system rejects the request without changing session, vote, or catalog data

### Requirement: Admin scheduled session management
The system SHALL allow admins to create, edit, close, and cancel scheduled voting sessions.

#### Scenario: Admin creates future session
- **WHEN** an admin creates a session with local date, start time, optional end time, title, notes, and status
- **THEN** the system stores the session and makes it available according to its status

#### Scenario: Admin edits session details
- **WHEN** an admin updates a session's title, notes, local date, local time, or status
- **THEN** the system persists the changes without deleting existing votes

#### Scenario: Admin cancels session
- **WHEN** an admin cancels a session
- **THEN** the system marks the session cancelled and prevents further votes for that session

### Requirement: Session-specific game curation
The system SHALL allow admins to restrict a voting session to a selected subset of active catalog games.

#### Scenario: Admin sets curated games
- **WHEN** an admin assigns a non-empty set of active games to a session
- **THEN** the system allows votes only for those games in that session

#### Scenario: Session has no curated games
- **WHEN** a session has no curated game list
- **THEN** the system allows votes for any active catalog game

#### Scenario: User votes outside curated set
- **WHEN** an authenticated user attempts to vote for an active game that is not in the session's curated game list
- **THEN** the system rejects the vote and preserves the user's previous valid vote for that session

#### Scenario: Admin removes option with votes
- **WHEN** an admin attempts to remove a curated game option that already has votes in the session
- **THEN** the system rejects that removal and explains that existing votes would be invalidated

### Requirement: Admin controls in React UI
The system SHALL expose session management and curation controls in the React frontend only to admin users.

#### Scenario: Admin opens calendar
- **WHEN** an authenticated admin opens the calendar
- **THEN** the system displays controls for creating sessions, editing session details, changing status, and curating eligible games

#### Scenario: Normal user opens calendar
- **WHEN** an authenticated non-admin user opens the calendar
- **THEN** the system hides admin controls while still allowing permitted voting and browsing actions
