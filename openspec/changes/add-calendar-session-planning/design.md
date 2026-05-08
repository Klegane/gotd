## Context

The current application has one implicit daily voting session per local date, an authenticated React dashboard, Google-backed users, a local SQLite database, and a BoardGameGeek-backed catalog. This change turns voting sessions into scheduled calendar entries while keeping the existing "today" flow as the default path for simple days.

The feature spans data modeling, authorization, API shape, and UI. It also introduces a lightweight admin role and user-specific game preferences, so all privileged changes must be enforced server-side and covered by tests.

## Goals / Non-Goals

**Goals:**

- Show a calendar-oriented view of past, current, and future voting sessions.
- Let users vote for future sessions before the scheduled date.
- Let admins create, edit, cancel, and curate scheduled sessions.
- Let admins restrict a specific session to a smaller selected set of active catalog games.
- Let users mark games as favorite or vetoed and see those preferences while voting.
- Preserve existing daily voting behavior for users who only care about today's vote.

**Non-Goals:**

- Recurring session rules, external calendar sync, or calendar invite generation.
- Complex permission management beyond `admin` and normal `user`.
- Ranked-choice voting, weighted votes, or automatic recommendation algorithms.
- Letting one user's veto automatically remove a game from everyone else's voting options.

## Decisions

### Use `VotingSession` as the calendar session entity

Extend the existing `VotingSession` model instead of creating a parallel event model. Add schedule fields such as `title`, `notes`, `localDate`, `localStartTime`, `localEndTime`, `status`, `createdByUserId`, and timestamps for admin edits. The current daily session remains a valid `VotingSession`; if no planned session exists for today, the app can still create the default daily session.

Alternatives considered:

- Add a separate `CalendarEvent` table linked to voting sessions. This separates planning from voting, but it creates extra lifecycle states and joins for little first-pass value.
- Keep one unique session per local date. This is simpler but blocks multiple planned sessions on the same day and makes "sessions" less useful as a calendar concept.

### Support multiple sessions per day

Remove the hard assumption that `localDate` is globally unique. Use the session id as the voting target and add a nullable unique daily key only for the automatically-created default daily session if needed. This preserves the current one-click daily flow while allowing an admin to schedule several sessions on the same date.

Alternatives considered:

- Keep the unique `localDate` constraint and store only one start time per day. This is easier to migrate but too restrictive for planned game nights.

### Add explicit session status

Use simple string statuses: `draft`, `open`, `closed`, and `cancelled`.

- `draft`: visible to admins, not votable by normal users.
- `open`: visible and votable.
- `closed`: visible with final results, no more voting.
- `cancelled`: visible as cancelled, no voting.

The existing today's session should default to `open`.

### Use server-enforced admin roles

Add `role` to `User`, defaulting to `user`. Configure bootstrap admins through a comma-separated `ADMIN_EMAILS` environment variable; when a Google-authenticated user's email matches, the local user is promoted to `admin`. Admin APIs must still read the role from the database on every request.

Alternatives considered:

- Make the first logged-in user admin. Convenient, but risky if the first login is accidental.
- Hard-code an admin email. Simple locally, but it leaks environment-specific configuration into source.

### Model curated session game options separately

Add `VotingSessionGameOption` with `votingSessionId`, `gameId`, `addedByUserId`, and timestamps. If a session has no option rows, all active catalog games are eligible. If it has option rows, only those active games are eligible.

To avoid surprising users, admins should not be able to remove a curated option after votes exist for that game in the session. Adding more options remains allowed.

Alternatives considered:

- Store curated game ids as JSON on `VotingSession`. This is quick but weak for constraints, joins, and validation.
- Copy full game records into each session. This protects historical names but creates duplication before there is a proven need.

### Model favorites and vetoes as per-user preferences

Add `UserGamePreference` with `userId`, `gameId`, `preference`, and timestamps. The unique key is `(userId, gameId)`, and valid values are `favorite` and `vetoed`. Setting a new preference replaces the old one; clearing a preference deletes the row.

Preferences affect presentation and personal context, not global catalog availability. The voting UI should highlight favorites, mark vetoed games, and avoid hiding vetoed games unless the user explicitly filters them.

### Add session-specific voting APIs

Keep `/api/voting/today` for backwards-compatible default behavior, and add session-targeted APIs:

- `GET /api/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/vote`
- `GET /api/sessions/:id/results`
- `POST /api/admin/sessions`
- `PATCH /api/admin/sessions/:id`
- `POST /api/admin/sessions/:id/cancel`
- `PUT /api/admin/sessions/:id/games`
- `PUT /api/preferences/games/:gameId`
- `DELETE /api/preferences/games/:gameId`

All routes remain protected by Google session checks. Admin routes additionally require `role = admin`.

### Calendar UI first, daily vote still fast

Replace the single dashboard with a React experience that has a session calendar/list and a selected session panel. The default selection should be today's open session when available; otherwise the nearest upcoming session. Users can still vote with minimal clicks, while the calendar makes past and future sessions discoverable.

## Risks / Trade-offs

- Removing the unique date assumption can affect existing queries -> introduce session-id-based helpers first, then adapt today's helper to select or create the default session.
- Admin curation can invalidate existing votes -> block removal of games that already have votes for the session.
- Local time handling can drift if stored only as UTC -> store local date and local time strings using `APP_TIMEZONE`, and only derive UTC if needed for ordering or future integrations.
- Preferences can be mistaken for global bans -> label them as personal favorites/vetoes and keep admin curation as the only shared eligibility control.
- `ADMIN_EMAILS` changes require clear documentation -> update `.env.example` and local deployment docs.

## Migration Plan

1. Add database fields and tables for user roles, scheduled sessions, session game options, and user game preferences.
2. Backfill existing users with role `user` and existing voting sessions with title/status defaults.
3. Adjust voting services to operate by session id while preserving `/api/voting/today`.
4. Add admin authorization helpers and admin session APIs.
5. Add preference APIs and include preference metadata in catalog/session responses.
6. Build the React calendar/session UI and admin controls.
7. Add tests for migrations, authorization, session scheduling, curated eligibility, future votes, and preferences.

Rollback should avoid deleting existing votes. If rollback is required, keep the database volume intact and stop using the new routes/UI; destructive schema rollback should be manual only.

## Open Questions

- Should normal users see draft future sessions, or only admins?
- Should admins be able to close a session manually, or should closed status be based only on scheduled end time?
- Should vetoed games be visually deprioritized only for the current user, or should aggregate veto counts be visible to everyone?
