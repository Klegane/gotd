## 1. Data Model and Migration

- [x] 1.1 Add user nickname and normalized nickname fields with validation-friendly indexes.
- [x] 1.2 Add session participant/invitation model with unique user/session constraint and status fields.
- [x] 1.3 Add session veto snapshot model with unique user/session/game constraint.
- [x] 1.4 Add user notification model with read state and contextual foreign keys.
- [x] 1.5 Backfill historical participant rows from existing ballots for closed/past sessions.
- [x] 1.6 Regenerate Prisma client and validate the schema.

## 2. Meaningful Veto Backend

- [x] 2.1 Add named constants for max active vetoes and veto penalty points.
- [x] 2.2 Enforce active veto limit when setting a game preference to vetoed.
- [x] 2.3 Add helpers to report veto capacity for a user.
- [x] 2.4 Snapshot a user's current vetoes when their first ballot is submitted for a session.
- [x] 2.5 Snapshot missing vetoes for active non-declined participants during close or settlement.
- [x] 2.6 Update result aggregation to apply veto penalties and expose veto breakdown.
- [x] 2.7 Update leader/tie logic to prefer fewer frozen vetoes when scores tie.

## 3. Invitations and Attendance

- [x] 3.1 Add services for inviting users to a session and updating participant records.
- [x] 3.2 Add services for invited users to accept, decline, or mark maybe.
- [x] 3.3 Add creator/admin attendance marking for attended and absent users.
- [x] 3.4 Include participant status and attendance metadata in session detail responses.
- [x] 3.5 Add API routes for session invitations, responses, and attendance updates.
- [x] 3.6 Ensure declined users are excluded from profile upcoming sessions and veto fallback snapshots.

## 4. Profile Backend

- [x] 4.1 Add profile read service with identity, nickname, preferences, veto capacity, sessions, point balance, and ledger history.
- [x] 4.2 Add profile update service for nickname changes and clearing.
- [x] 4.3 Add authenticated profile API routes.
- [x] 4.4 Use nickname-first display names in session votes, proposals, messages, invitations, and notifications.

## 5. Notifications Backend

- [x] 5.1 Add notification creation helpers with self-notification avoidance.
- [x] 5.2 Create notifications for new invitations.
- [x] 5.3 Create notifications for relevant session updates, cancellations, and settlement.
- [x] 5.4 Create notifications for session messages sent by other users.
- [x] 5.5 Create notifications for priority point ledger entries.
- [x] 5.6 Add notification list, mark-read, and mark-all-read API routes.
- [x] 5.7 Add lightweight deduplication or grouping for repeated message notifications when practical.

## 6. User Interface

- [x] 6.1 Add a profile page with nickname edit, veto capacity, favorites, vetoes, upcoming invited sessions, past played sessions, point balance, and point history.
- [x] 6.2 Add profile navigation from the authenticated header or main dashboard.
- [x] 6.3 Add invitation controls to session creation/editing for creators/admins.
- [x] 6.4 Add invitation response controls for invited users.
- [x] 6.5 Add attendance controls to session settlement/admin areas.
- [x] 6.6 Update result UI to show normal votes, bid points, veto penalty, final score, and veto tie context.
- [x] 6.7 Add a main-screen notification button with unread count and notification panel.
- [x] 6.8 Poll notifications while the main screen is open and refresh read state after user actions.

## 7. Tests and Documentation

- [x] 7.1 Add tests for veto limit enforcement and veto capacity reporting.
- [x] 7.2 Add tests for veto snapshot timing and immutability after preference changes.
- [x] 7.3 Add tests for veto-adjusted scoring and tie behavior.
- [x] 7.4 Add tests for invitation authorization, response changes, declined filtering, and attendance marking.
- [x] 7.5 Add tests for profile API summaries and nickname validation.
- [x] 7.6 Add tests for notification creation, list filtering, and read state.
- [x] 7.7 Add component tests for profile, invitation controls, notification panel, and veto score breakdown.
- [x] 7.8 Update README or local deployment docs with the new veto, profile, invitation, and notification behavior.
