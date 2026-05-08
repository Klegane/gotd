# Daily Board Game Vote

React web app for choosing the board game of the day with Google login, a local SQLite database, BoardGameGeek catalog import, and Docker-based local hosting.

The app now supports a session calendar: users can vote in today's session or future planned sessions, browse past results, mark personal favorite/vetoed games, and use admin-curated game lists for specific sessions.

## Development

```powershell
npm install
npm run db:generate
npm run db:migrate:dev
npm run dev
```

The app expects the variables from `.env.example`. For Docker and Google OAuth setup, see `docs/local-deployment.md`.

## Admin Setup

Add one or more Google account emails to `ADMIN_EMAILS` in `.env` to enable session planning controls:

```text
ADMIN_EMAILS=admin@example.com,another-admin@example.com
```

Admins can create scheduled sessions, cancel or close them, and limit a session to a selected subset of active catalog games.

## Optional Google Maps Autocomplete

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` before rebuilding Docker to enable Google Maps address autocomplete for new locations. Leave it empty to use manual address entry.
