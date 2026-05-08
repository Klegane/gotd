## ADDED Requirements

### Requirement: React web frontend
The system SHALL implement the browser-facing user interface as a React web frontend.

#### Scenario: User-facing interface is implemented
- **WHEN** the application frontend is built
- **THEN** the user-facing pages and interactive voting/catalog interfaces are implemented with React components

### Requirement: Local durable database
The system SHALL persist users, sessions, catalog data, sync runs, voting sessions, and votes in a local database.

#### Scenario: Application restarts
- **WHEN** the application process or container restarts
- **THEN** the system retains previously stored users, catalog entries, voting sessions, and votes

#### Scenario: Multiple users vote on same day
- **WHEN** multiple authenticated users cast votes for the same daily voting session
- **THEN** the system stores each user's current vote without overwriting other users' votes

### Requirement: Environment-based configuration
The system SHALL read runtime configuration from environment variables rather than hard-coded local values.

#### Scenario: Required configuration is missing
- **WHEN** the application starts without required authentication, database, app URL, or BoardGameGeek configuration
- **THEN** the system fails fast or displays an operational configuration error without accepting votes

#### Scenario: Configuration is provided
- **WHEN** the application starts with all required environment values
- **THEN** the system uses those values for authentication callbacks, database storage, BoardGameGeek source, and local date handling

### Requirement: Dockerized local hosting
The system SHALL provide a Docker-based local deployment path for running the application on a local machine.

#### Scenario: Operator starts Docker Compose
- **WHEN** the operator starts the documented Docker Compose configuration with valid environment values
- **THEN** the application becomes available at the configured local URL and uses persisted local storage

#### Scenario: Container is recreated with same volume
- **WHEN** the application container is recreated while the persisted data volume remains
- **THEN** the system starts with the existing database state intact

### Requirement: Secret handling
The system SHALL keep OAuth secrets, session secrets, and local production configuration out of committed source files.

#### Scenario: Repository contains example configuration
- **WHEN** a developer inspects the committed configuration files
- **THEN** the repository includes placeholder example values only and does not include real Google OAuth secrets or session secrets
