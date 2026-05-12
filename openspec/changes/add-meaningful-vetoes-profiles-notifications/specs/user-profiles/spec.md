## ADDED Requirements

### Requirement: Editable nickname
The system SHALL allow each authenticated user to manage their own display nickname.

#### Scenario: User sets valid nickname
- **WHEN** an authenticated user submits a valid nickname
- **THEN** the system stores the nickname and uses it as the user's preferred display name

#### Scenario: User submits invalid nickname
- **WHEN** an authenticated user submits a nickname that fails validation or uniqueness checks
- **THEN** the system rejects the update without changing the current nickname

#### Scenario: User clears nickname
- **WHEN** an authenticated user clears their nickname
- **THEN** the system falls back to the OAuth name or email for display

### Requirement: Profile preference summary
The system SHALL show the authenticated user's favorite and vetoed games on their profile.

#### Scenario: User opens profile preferences
- **WHEN** an authenticated user opens their profile
- **THEN** the system lists that user's favorite games and vetoed games

#### Scenario: Profile shows veto capacity
- **WHEN** an authenticated user opens their profile
- **THEN** the system shows how many veto slots are used and how many remain

### Requirement: Profile session summary
The system SHALL show relevant future and past sessions on the authenticated user's profile.

#### Scenario: Upcoming invited sessions
- **WHEN** an authenticated user opens their profile
- **THEN** the system lists future sessions where the user has a non-declined invitation or participant record

#### Scenario: Past played sessions
- **WHEN** an authenticated user opens their profile
- **THEN** the system lists past sessions where the user is marked attended or has a historical ballot participation fallback

### Requirement: Profile point summary
The system SHALL show the authenticated user's priority point balance and ledger history.

#### Scenario: User views point balance
- **WHEN** an authenticated user opens their profile
- **THEN** the system shows the user's current priority point balance calculated from ledger entries

#### Scenario: User views point history
- **WHEN** an authenticated user opens their profile
- **THEN** the system lists that user's priority point ledger entries with amount, reason, date, and related session or game context when available
