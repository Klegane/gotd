# Local Deployment

## Google OAuth

Create a Google OAuth web client and add one redirect URI for the URL that users will open:

```text
http://localhost:3000/api/auth/callback/google
```

For LAN access, use the same host name or IP address in `APP_URL` and in the Google redirect URI:

```text
http://192.168.1.50:3000/api/auth/callback/google
```

Google may require HTTPS for some non-localhost setups. In that case, put a local reverse proxy with HTTPS in front of the app and use that HTTPS URL for `APP_URL`.

## Environment

Create `.env` from `.env.example` and fill in:

```text
APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<random-secret-at-least-32-characters>
NEXTAUTH_SECRET=<same-as-auth-secret>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
BGG_USERNAME=<boardgamegeek-username>
BGG_USER_ID=<optional-boardgamegeek-user-id>
BGG_COLLECTION_URL=<optional-full-geekcollection-url>
DATABASE_URL=file:/data/app.db
APP_TIMEZONE=Europe/Madrid
BGG_INCLUDE_EXPANSIONS=false
ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<optional-google-maps-browser-key>
```

`BGG_COLLECTION_URL` can point at a full `geekcollection.php?ajax=1&action=collectionpage...` URL. When it is set, the app imports game ids, names, and published years from that HTML collection response without needing a BoardGameGeek token. If it is not set, the app builds the same no-token collection request from `BGG_USERNAME` and optional `BGG_USER_ID`.

`ADMIN_EMAILS` is a comma-separated list of Google account emails that should become admins, for example `ana@example.com,erik@example.com`. The app promotes matching users when they sign in or when their session is loaded.

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is optional. When it is present at build time, new location address fields use Google Maps Places autocomplete. Keep this key restricted in Google Cloud to the Maps JavaScript API and to the local hostnames you use. If the variable is empty, the app keeps a manual address input.

Generate a local secret with:

```powershell
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

## Start

```powershell
docker compose up --build
```

Open the configured `APP_URL`, sign in with Google, and press `Refresh BGG` to import the configured BoardGameGeek collection.

## Calendar, Admin Sessions, and Preferences

Authenticated users can browse the calendar, open a past or future session, and vote in any session with status `open`. Results are stored per session, so two sessions on the same local date keep separate votes and winners.

Admins see extra calendar controls:

- Create planned sessions with date, start time, optional end time, title, notes, and status.
- Edit or cancel existing sessions.
- Close a session to prevent further voting.
- Choose whether player proposals are open or closed.
- Restrict a session to a smaller set of active catalog games. If no games are selected, every active catalog game is eligible.
- Record the played game so priority points and bids are settled.

Every user can mark games as favorite or vetoed. Favorites are personal labels. Vetoes are limited to three active games per user and do not remove games from other users' ballots, but frozen session vetoes apply a score penalty and tie protection in results.

Users can open the profile page to set a nickname, review favorites and vetoes, see point balance and point history, and browse upcoming invited sessions and past played sessions. Session creators and admins can invite registered users and mark attendance. The home page notification button shows unread invitations, session updates, chat messages, settlement results, and point changes.

## Proposals, Multi-Vote Ballots, and Priority Points

When proposals are open, any authenticated player can propose active catalog games for that session. A player can also mark one of their own proposals as the priority proposal for that session.

When proposals are closed, only creator/admin options are available. If the session has fewer than three creator/admin options, closing proposals costs 2 priority points per missing option. The UI shows this cost before saving.

Ballot limits depend on the number of available games:

- Three or fewer games: each player has one vote.
- More than three games: each player can allocate up to one fewer vote than the number of available games.
- Repeated votes on the same game are allowed in larger sessions.
- A ballot can never include every available game.

Priority point scoring is added on top of normal votes. Players can bid available points only on their own priority proposal. The result score is normal votes plus bid points.

Settlement happens when a creator or admin records the game that was actually played. A priority proposal earns points only when that proposed game was not played. If the bid's game was played, all bid points are spent. If the bid's game was not played, half of the bid, rounded up, is lost.

## Correcting Settlement Mistakes

Settlement is designed to be idempotent: recording a played game after points have already been settled only updates the played-game field and does not create more ledger rows.

If the wrong game was settled and points must be corrected, make a database backup first. Then insert manual adjustment rows in `PriorityPointLedger` with a unique `idempotencyKey`, a clear `reason` such as `admin_adjustment`, the affected `userId`, optional `votingSessionId` and `gameId`, and a positive or negative `amount`. Do not edit historical settlement rows in place; append adjustments so the audit trail remains readable.

## Google Maps Address Autocomplete

Address autocomplete uses the Google Maps JavaScript Places library only when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured before `docker compose up --build`. Google Maps Platform requires billing to be enabled. Google documents free monthly usage caps for core SKUs, including Places Autocomplete requests, but usage beyond those caps or different SKU combinations can be billed. Use Google Cloud quotas and budget alerts if you enable it.

## Backups

The SQLite database lives in the Docker volume mounted at `/data/app.db`. To make a quick backup:

```powershell
docker compose stop app
docker run --rm -v sdd-project_app-data:/data -v ${PWD}:/backup alpine cp /data/app.db /backup/app.db.backup
docker compose start app
```

## Restart Persistence

Container recreation keeps voting history as long as the `app-data` volume remains:

```powershell
docker compose up --force-recreate app
```

Removing the volume deletes local users, catalog data, votes, and history.
