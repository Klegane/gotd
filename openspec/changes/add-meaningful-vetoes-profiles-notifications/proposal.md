## Why

Vetoes are currently only personal labels, so they do not protect players from games they strongly want to avoid. The app also lacks a personal home for identity, preferences, invitations, point history, and activity updates, which makes session planning feel scattered once the group starts using future sessions and chat.

## What Changes

- Limit each user to a small number of active vetoes, initially three.
- Make vetoes affect session results without globally removing games: each frozen participant veto applies a score penalty and prevents the vetoed game from winning ties.
- Freeze session-affecting vetoes when a participant first votes in a session, with a fallback freeze at session close/settlement for participants who were invited but did not vote.
- Add a user profile page where authenticated users can edit their nickname, view favorites, view vetoes, see current priority points, inspect point ledger history, see upcoming invited sessions, and see past played sessions.
- Add session invitations/participation so future sessions can target specific players and profiles can distinguish invited sessions from the general calendar.
- Add main-screen notifications for relevant activity such as new invited sessions, new session messages, invitation changes, session updates/cancellations, point ledger changes, and settlement outcomes.
- Add notification read/unread state and a compact notification button on the main screen.

## Capabilities

### New Capabilities

- `meaningful-vetoes`: Covers limited active vetoes, veto freeze snapshots, veto penalties in session scoring, and tie protection.
- `user-profiles`: Covers editable nicknames, preference summaries, upcoming invited sessions, past played sessions, point balance, and point ledger history.
- `session-invitations`: Covers inviting users to sessions, participant status, and invitation visibility for profiles and notifications.
- `notifications`: Covers persisted user notifications, read/unread state, and activity triggers.

### Modified Capabilities

- None. Existing implemented preferences, sessions, messages, voting, and priority points are extended through new capability specs because there are no archived base specs in `openspec/specs/`.

## Impact

- Database: add user nickname/profile fields, session invitation/participant records, veto snapshot records, and notification records; extend preference validation for active veto limits.
- Voting services: include frozen veto penalties in result scoring and expose score breakdowns.
- Session services: freeze vetoes during first ballot submission and during final close/settlement fallback; create notification events for relevant activity.
- Profile APIs/UI: add authenticated profile read/update endpoints and a profile page.
- Notification APIs/UI: add list/mark-read endpoints and a main-screen notification button/panel.
- Tests: cover veto limits, veto freeze timing, scoring penalties, tie behavior, profile summaries, invitation filtering, point history, and notification creation/read state.
