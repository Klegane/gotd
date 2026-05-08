## 1. Application Setup

- [x] 1.1 Scaffold the full-stack TypeScript React web application structure with frontend pages/components and backend API routes.
- [x] 1.2 Add package scripts for development, build, start, linting, tests, and database migrations.
- [x] 1.3 Add environment validation for app URL, auth secrets, Google OAuth values, BoardGameGeek username, database path, and app timezone.
- [x] 1.4 Add `.env.example` with placeholder values and ensure real secrets remain untracked.

## 2. Local Persistence

- [x] 2.1 Add SQLite ORM configuration using a persisted local database path suitable for Docker volumes.
- [x] 2.2 Create migrations for users, OAuth accounts/sessions, games, catalog sync runs, voting sessions, and votes.
- [x] 2.3 Add uniqueness constraints for BoardGameGeek game ids, daily voting session dates, and one vote per user per session.
- [x] 2.4 Add database startup checks and a basic application health endpoint.

## 3. Google Authentication

- [x] 3.1 Configure Google OAuth/OpenID Connect using server-side auth middleware.
- [x] 3.2 Persist or update local user records from successful Google authentication callbacks.
- [x] 3.3 Implement login, logout, and authenticated session rendering in React components.
- [x] 3.4 Protect voting, catalog, sync, and history APIs from unauthenticated access.
- [x] 3.5 Add tests for authenticated access, unauthenticated rejection, and logout behavior.

## 4. BoardGameGeek Catalog

- [x] 4.1 Implement a BoardGameGeek XML API2 client for the configured user collection.
- [x] 4.2 Add XML parsing for BoardGameGeek collection items and detail enrichment, including id, name, year, image or thumbnail, players, time, weight, and game metadata.
- [x] 4.3 Implement queued-response handling, retry delay, throttling backoff, failure recording, and last-successful catalog preservation.
- [x] 4.4 Upsert imported games by BoardGameGeek id and mark missing games inactive only after a successful sync.
- [x] 4.5 Add a protected catalog refresh API and sync status response.
- [x] 4.6 Build the authenticated React catalog UI with active games, empty state, refresh action, and latest sync status.
- [x] 4.7 Add tests with mocked BoardGameGeek success, queued, throttled, and failed responses.

## 5. Daily Voting

- [x] 5.1 Implement daily voting session creation and lookup using the configured local timezone.
- [x] 5.2 Implement vote casting and vote changing with one current vote per user per daily session.
- [x] 5.3 Reject votes for inactive, missing, or unknown games while preserving existing valid votes.
- [x] 5.4 Implement vote totals, tied-game detection, and no-votes result handling.
- [x] 5.5 Implement voting history APIs for previous daily sessions and their results.
- [x] 5.6 Build the primary React daily voting UI with game selection, current vote state, results, and history access.
- [x] 5.7 Add tests for daily session uniqueness, vote replacement, invalid game rejection, results, ties, and history.

## 6. Dockerized Local Deployment

- [x] 6.1 Add a production Dockerfile for building and running the application.
- [x] 6.2 Add Docker Compose configuration with a persisted data volume for the local database.
- [x] 6.3 Document Google OAuth redirect URI setup for localhost and LAN-style app URLs.
- [x] 6.4 Document local startup, catalog refresh, database backup, and container restart expectations.
- [x] 6.5 Verify Docker Compose startup with valid environment values.
- [x] 6.6 Verify persisted data survives application container recreation with the same volume.

## 7. Final Verification

- [x] 7.1 Run formatting, linting, type checks, and the automated test suite.
- [ ] 7.2 Perform an end-to-end local smoke test for login, catalog refresh, voting, results, history, and logout.
- [x] 7.3 Review the implemented behavior against all OpenSpec requirements for this change.
