## Why

El voto diario ya cubre la eleccion rapida del juego, pero el grupo necesita planificar mas alla del dia actual: ver que se jugo, preparar sesiones futuras y limitar opciones cuando una partida concreta tiene restricciones reales. Las preferencias personales tambien ayudan a que la votacion tenga en cuenta gustos, favoritos y vetos sin convertir cada decision en una conversacion manual.

## What Changes

- Add a calendar view that shows past voting results, today's session, and future planned sessions.
- Allow authenticated users to vote in future sessions before the session date.
- Add scheduled session details, including local date, start time, optional end time, title, notes, and voting status.
- Add an admin role that can create, edit, and cancel planned sessions.
- Add admin curation for a specific session so voting can be restricted to a smaller selected set of games.
- Add user-level favorite games and vetoed games.
- Surface each user's favorites and vetoes in the voting UI without deleting games from the shared catalog.
- Preserve existing daily voting behavior for sessions that do not have custom scheduling or curated game lists.

## Capabilities

### New Capabilities

- `session-calendar`: Covers calendar browsing, past results, future sessions, scheduled times, and future-session voting.
- `admin-session-management`: Covers admin role behavior, session creation/editing/cancellation, and per-session curated game selections.
- `user-game-preferences`: Covers each user's favorite and vetoed games and how those preferences affect the voting experience.

### Modified Capabilities

- None.

## Impact

- Affected code: React dashboard/calendar UI, voting APIs, session APIs, admin-only APIs, database models/migrations, and tests.
- Affected data: new persisted session scheduling fields, user role field, session-game restriction records, and user game preference records.
- Affected behavior: voting becomes available for planned future sessions, while the current daily vote remains the default entry point.
- Affected operations: local admins need a documented way to assign or bootstrap the first admin user.
