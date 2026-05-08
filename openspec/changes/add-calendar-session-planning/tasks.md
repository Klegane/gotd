## 1. Data Model and Migration

- [x] 1.1 Add user role support with default `user` and admin bootstrap from `ADMIN_EMAILS`.
- [x] 1.2 Extend `VotingSession` with schedule fields, status, title, notes, admin ownership, and update metadata.
- [x] 1.3 Remove the one-session-per-date assumption while preserving a default daily session path.
- [x] 1.4 Add `VotingSessionGameOption` with session/game uniqueness and relational constraints.
- [x] 1.5 Add `UserGamePreference` with user/game uniqueness and favorite/vetoed state.
- [x] 1.6 Create and verify Prisma migrations against the existing local SQLite database.

## 2. Authorization and Session Services

- [x] 2.1 Add server helpers for current-user role checks and admin-only request enforcement.
- [x] 2.2 Refactor voting services to load, summarize, and cast votes by explicit session id.
- [x] 2.3 Preserve `/api/voting/today` behavior by selecting or creating today's default open session.
- [x] 2.4 Implement session eligibility logic using active catalog games or curated session options.
- [x] 2.5 Prevent voting in draft, closed, or cancelled sessions.
- [x] 2.6 Prevent curated option removal when the game already has votes in that session.

## 3. Calendar and Admin APIs

- [x] 3.1 Add protected calendar range API for sessions between `from` and `to` local dates.
- [x] 3.2 Add protected session detail API including games, current vote, results, and preference metadata.
- [x] 3.3 Add protected session-specific vote API for current and future sessions.
- [x] 3.4 Add admin API to create scheduled sessions.
- [x] 3.5 Add admin API to edit session schedule details and status.
- [x] 3.6 Add admin API to cancel sessions.
- [x] 3.7 Add admin API to set or update curated game options for a session.

## 4. Preference APIs

- [x] 4.1 Add protected API to set a user's game preference to favorite or vetoed.
- [x] 4.2 Add protected API to clear a user's game preference.
- [x] 4.3 Include the current user's preferences in catalog and voting session responses.
- [x] 4.4 Validate that preferences can only reference known catalog games.

## 5. React Frontend

- [x] 5.1 Replace the single-session dashboard with a calendar/list plus selected-session voting panel.
- [x] 5.2 Show past results, today's vote, and future planned sessions in the calendar.
- [x] 5.3 Allow voting and vote changes for any open selected session.
- [x] 5.4 Render session status, scheduled start/end times, title, and notes.
- [x] 5.5 Add admin-only controls for creating, editing, closing/cancelling sessions, and curating games.
- [x] 5.6 Add favorite/veto controls on game cards.
- [x] 5.7 Visually mark favorites and vetoed games without hiding shared catalog availability.

## 6. Documentation and Configuration

- [x] 6.1 Add `ADMIN_EMAILS` to `.env.example` with placeholder values.
- [x] 6.2 Document how to bootstrap admin users in local deployment docs.
- [x] 6.3 Document calendar/session behavior, future voting, curation, and personal preferences in the README or local docs.

## 7. Testing and Verification

- [x] 7.1 Add tests for admin role bootstrap and admin-only route rejection.
- [x] 7.2 Add tests for calendar range queries, multiple sessions on one date, and default today behavior.
- [x] 7.3 Add tests for future voting, vote replacement, closed/cancelled rejection, and curated eligibility.
- [x] 7.4 Add tests for curation safety when removing games with existing votes.
- [x] 7.5 Add tests for favorite/veto preference creation, replacement, clearing, and response metadata.
- [x] 7.6 Run Prisma generation, migrations, typecheck, lint, build, and automated tests.
- [x] 7.7 Perform a local Docker smoke test for admin scheduling, future voting, curation, preferences, results, and logout.
