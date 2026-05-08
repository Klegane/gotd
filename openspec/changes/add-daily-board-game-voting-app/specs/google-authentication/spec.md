## ADDED Requirements

### Requirement: Google sign-in
The system SHALL allow users to authenticate with Google before accessing voting and catalog features.

#### Scenario: Unauthenticated visitor opens the app
- **WHEN** a visitor without an active session opens the application
- **THEN** the system presents a Google sign-in path and does not allow voting actions

#### Scenario: User completes Google sign-in
- **WHEN** Google returns a successful authentication callback for a user
- **THEN** the system creates or updates a local user record linked to the user's stable Google identity and starts an authenticated session

### Requirement: Session lifecycle
The system SHALL maintain authenticated sessions and allow users to sign out.

#### Scenario: Authenticated user signs out
- **WHEN** an authenticated user requests sign-out
- **THEN** the system invalidates the current session and returns the user to an unauthenticated state

#### Scenario: Expired or invalid session calls a protected API
- **WHEN** a request without a valid active session calls a protected API
- **THEN** the system rejects the request without changing application data

### Requirement: Protected application actions
The system SHALL require a valid authenticated session for all actions that read private app state or mutate catalog and voting data.

#### Scenario: Authenticated user views voting page
- **WHEN** a user with a valid session opens the daily voting page
- **THEN** the system displays the current catalog and voting state available to that user

#### Scenario: Unauthenticated user attempts to vote
- **WHEN** a request without a valid session attempts to create or change a vote
- **THEN** the system denies the request and no vote is stored
