## Why

La eleccion diaria de juegos de mesa suele repartirse entre chats, memoria y acuerdos informales, lo que dificulta ver opciones reales y conservar el historial de votaciones. Esta aplicacion centralizara el catalogo disponible, la autenticacion de usuarios y las votaciones diarias en una instalacion local y facil de levantar.

## What Changes

- Add a React web application where authenticated users can see the available board games and vote for the game they want to play each day.
- Add Google sign-in for the frontend so votes are tied to a known user identity.
- Add a local database for users, imported games, daily voting sessions, votes, and historical results.
- Add a BoardGameGeek integration to import or refresh the list of available board games from a configured BGG user collection.
- Add a local Docker-based deployment path for running the app and database on a local machine.
- Add basic operational controls for configuring Google OAuth, BoardGameGeek source user, database storage, and application URL.

## Capabilities

### New Capabilities

- `google-authentication`: Covers Google login, logout, session handling, and access control for voting features.
- `board-game-catalog`: Covers importing, refreshing, storing, and displaying games retrieved from BoardGameGeek.
- `daily-game-voting`: Covers daily vote creation, vote casting, vote changes, result visibility, and vote history.
- `local-persistence-deployment`: Covers the local database, persisted runtime state, configuration, and Dockerized local hosting.

### Modified Capabilities

- None.

## Impact

- Affected code: new React frontend app, backend API, authentication middleware, BoardGameGeek sync service, database models/migrations, and Docker configuration.
- Affected APIs: Google OAuth/OpenID Connect for user login and BoardGameGeek collection endpoints for board game data.
- Affected dependencies: React web framework, OAuth/session tooling, database driver/ORM, XML parsing, job/retry utilities, and Docker Compose.
- Affected systems: local host machine, local database volume, Google Cloud OAuth client configuration, and outbound network access to BoardGameGeek.
