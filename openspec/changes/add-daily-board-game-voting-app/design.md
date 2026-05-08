## Context

The repository currently contains only OpenSpec artifacts, so this change introduces the first application architecture. The product will run on a local machine, preferably through Docker, while still needing outbound access to Google for authentication and BoardGameGeek for game catalog data.

BoardGameGeek exposes public collection data through both XML API2 and the browser collection page. The implementation can import from a no-token `geekcollection.php?ajax=1&action=collectionpage...` response, while retaining XML API2 fallback behavior. BGG collection responses can be throttled or unavailable, so the application must treat imports as backend sync jobs with retries and local caching, not as blocking frontend requests.

## Goals / Non-Goals

**Goals:**

- Provide a local React web app where Google-authenticated users vote on one board game per day.
- Store users, catalog data, voting sessions, votes, and results in a local persistent database.
- Import available games from a configured BoardGameGeek collection and preserve the last successful catalog locally.
- Provide a Docker-based local deployment with environment-driven configuration.
- Keep the first implementation simple enough for a home/local deployment while leaving a path to a larger database later.

**Non-Goals:**

- Building a public SaaS or multi-tenant deployment.
- Managing BoardGameGeek accounts or authenticating as a BGG user.
- Supporting multiple independent gaming groups in the first version.
- Implementing complex ranked-choice voting, scheduling, or recommendation algorithms.
- Shipping native mobile applications.

## Decisions

### Use a React full-stack TypeScript web app

Use a single TypeScript web application with a React frontend, preferably Next.js, for React pages/components and backend API routes. This keeps authentication callbacks, session checks, voting APIs, catalog sync, and the UI in one deployable container while satisfying the React requirement.

Alternatives considered:

- Separate React SPA and API service: more flexible, but adds deployment and cross-origin complexity that is unnecessary for a local first app.
- Static frontend with serverless backend: does not fit a local Docker-hosted deployment well.

### Use Google OAuth through server-side auth middleware

Use a mature OAuth/OpenID Connect integration, such as Auth.js with the Google provider, instead of hand-rolling OAuth. The backend will own callback handling, session creation, session validation, and logout. The frontend will call protected server APIs and render login state from the server session.

Alternatives considered:

- Client-only Google sign-in tokens: faster to prototype, but pushes more trust and token verification work into custom code.
- Username/password accounts: simpler locally, but does not satisfy the Google login requirement.

### Use SQLite as the first local database

Use SQLite with an ORM/migration tool and store the database file in a Docker volume, for example `/data/app.db`. SQLite is enough for a small group voting app, is easy to back up, and avoids operating a second database container.

Core tables:

- `users`: local user profile linked to Google identity.
- `accounts` and `sessions`: OAuth provider records and active sessions, if the auth library requires them.
- `games`: imported BoardGameGeek games, keyed by BGG id, with name, year, thumbnail/image URL, metadata, active flag, and sync timestamps.
- `catalog_sync_runs`: import status, started/completed timestamps, source username, counts, and last error.
- `voting_sessions`: one row per local date with status and winner metadata.
- `votes`: one row per user per voting session, pointing to a game.

Important constraints:

- `games.bgg_id` must be unique.
- `voting_sessions.local_date` must be unique.
- `(votes.voting_session_id, votes.user_id)` must be unique so each user has one current vote per day.

Alternatives considered:

- Postgres in Docker Compose: stronger concurrency and easier future analytics, but more operational weight for a local home app.
- JSON files: easy initially, but fragile for concurrent voting, history, and auth sessions.

### Import BoardGameGeek collections through a backend sync service

The backend will import from the configured BoardGameGeek collection without requiring a BGG token. If `BGG_COLLECTION_URL` is set, the app will request that exact `geekcollection.php` AJAX URL and parse board game ids, names, and years from the returned HTML. Otherwise it builds the same browser collection request from `BGG_USERNAME` and optional `BGG_USER_ID`, initially targeting owned board games and excluding expansions by default.

If the browser collection response cannot produce games, the backend can fall back to the XML API2 collection endpoint:

`/xmlapi2/collection?username=<bggUser>&own=1&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`

The sync service will:

- Run on explicit refresh from an authenticated user and optionally on startup if no catalog exists.
- Parse BoardGameGeek HTML or XML server-side and upsert games by BGG id.
- Enrich imported games from each public BoardGameGeek game page by parsing `GEEK.geekitemPreload`, because the no-token XML detail endpoint can reject unauthenticated requests in some environments.
- Mark games absent from the latest successful import as inactive rather than deleting them, preserving vote history.
- Handle `202` responses by retrying with delay.
- Back off on `500` and `503`, with at least several seconds between BGG requests.
- Keep the last successful catalog visible if BGG is unavailable.

Alternatives considered:

- Calling BGG directly from the browser: exposes integration details, complicates CORS, and cannot reliably persist or retry imports.
- Importing the full BGG ranks CSV: useful for discovery, but the requested source is a specific available-games request and a collection better represents availability.

### Center the frontend on the daily voting flow

The first screen after login will be the current day's voting experience: available games, current selection, and results/history access. Unauthenticated users see a direct Google sign-in path. The UI should not be a marketing landing page.

### Docker Compose owns local runtime configuration

Provide a Dockerfile and Docker Compose file that run the app with a persisted data volume. Runtime configuration lives in `.env`, with a committed `.env.example` documenting required values:

- `APP_URL`
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BGG_USERNAME`
- `DATABASE_URL` or `DB_PATH`
- `APP_TIMEZONE`

For LAN access, the configured Google OAuth redirect URI must match the hostname and scheme users will use. If the app is accessed beyond `localhost`, HTTPS or a local reverse proxy may be required depending on the Google OAuth client configuration.

## Risks / Trade-offs

- Google OAuth is awkward for purely local LAN deployments -> document exact redirect URI setup and keep `APP_URL` the single source of truth.
- BoardGameGeek may throttle, queue, or temporarily fail collection exports -> use server-side retries, import status, and last-successful catalog caching.
- SQLite has limited write concurrency -> acceptable for small groups; unique constraints and short transactions reduce contention.
- Imported BGG data can change or disappear -> upsert by BGG id and deactivate missing games instead of deleting them.
- Daily voting depends on local dates -> use a configured app timezone and store both local date and timestamps.
- Docker volume loss would lose history -> document backup/export for the SQLite file.

## Migration Plan

1. Scaffold the React web app, backend routes, auth integration, ORM, migrations, and Docker files.
2. Add the initial database schema and migration for users, auth records, games, sync runs, voting sessions, and votes.
3. Implement Google login/logout and protect all voting/catalog API routes.
4. Implement BGG catalog sync with XML parsing, retries, import status, and local upserts.
5. Implement daily voting APIs and UI.
6. Add Docker Compose, `.env.example`, startup instructions, and a basic health check.
7. Verify local run, container restart persistence, auth flow, BGG refresh, and vote history.

Rollback is straightforward while there is no existing production code: stop the container and remove the generated app files. Database rollback should preserve the Docker volume unless the user explicitly chooses to delete local voting history.

## Open Questions

- Which BoardGameGeek username should be the default catalog source?
- Should vote totals be visible during the day or only after a manual/automatic close?
- What timezone and daily cutoff should define "today" for the group?
- Should ties remain tied, use a deterministic tie-breaker, or trigger a runoff vote?
- Will users access the app only from the host machine, or from other devices on the LAN?
