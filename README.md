# Daily Board Game Vote

React web app for choosing the board game of the day with Google login, a local SQLite database, BoardGameGeek catalog import, and Docker-based local hosting.

The app now supports a session calendar: users can vote in today's session or future planned sessions, browse past results, manage a profile, mark personal favorite/vetoed games, use curated game lists for specific sessions, invite players, propose games when a session allows it, and spend priority points when their proposals keep missing the table.

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

Admins can create scheduled sessions, cancel or close them, choose whether player game proposals are open, and limit a session to a selected subset of active catalog games.

## Session Voting

Each session has a proposal policy:

- Open proposals let authenticated players add games from the active catalog to that session.
- Closed proposals keep the game list under creator/admin control. If the creator closes proposals while offering fewer than three creator/admin options, the session charges a control cost of 2 priority points per missing option.

Voting uses one ballot per player and session. Sessions with three or fewer available games allow one vote. Sessions with more than three games allow multiple vote allocations, including repeated votes on the same game, but the ballot can never vote for every available game.

Priority points work like lightweight Dragon Kill Points. A player can mark one of their own proposals as priority and bid available points on it. Results combine normal votes and bid points, then subtract frozen veto penalties. When the played game is recorded, priority proposals that were not played earn points, winning bids are fully spent, and losing bids lose a partial amount.

## Profiles, Vetos, Invitations, and Notifications

Users can open `/profile` to set a nickname, review favorites and vetoes, see current priority points, inspect point history, and browse upcoming invitations and past played sessions.

Each user can keep up to three active vetoes. A veto does not remove a game from voting, but once frozen for a session it subtracts 2 points from that game's score and prevents the game from winning tied scores against less-vetoed alternatives. Vetoes freeze when a player first submits a ballot, and remaining active participant vetoes freeze when the session is closed or settled.

Session creators and admins can invite registered users and mark attendance. The main screen includes a notification button for invitations, session updates, messages, settlement, and point changes.

## Optional Google Maps Autocomplete

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` before rebuilding Docker to enable Google Maps address autocomplete for new locations. Leave it empty to use manual address entry.
