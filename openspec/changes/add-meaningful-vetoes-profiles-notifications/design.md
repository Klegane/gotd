## Context

The app already has authenticated users, per-user favorite/veto labels, session calendars, session chat, multi-vote ballots, point bids, and an auditable priority point ledger. Vetoes currently affect only presentation, and there is no participant/invitation model, profile page, or persisted notification inbox.

This change makes the social model more explicit: users can spend a scarce veto slot to protect themselves from a game, sessions can identify who is expected to participate, and users get a personal place to review preferences, sessions, and point history.

## Goals / Non-Goals

**Goals:**

- Make vetoes scarce and meaningful without letting one user globally ban a game.
- Freeze vetoes per session so late preference edits cannot manipulate a live result.
- Show veto impact transparently in result score breakdowns.
- Give users a profile page for nickname, preferences, invitations, played sessions, point balance, and point ledger history.
- Add session invitations/participation as the basis for future-session visibility, attendance, notification targeting, and fallback veto snapshots.
- Add a main-screen notification button and persisted unread/read notifications.

**Non-Goals:**

- Real-time push notifications or browser/device push.
- Private direct messaging between users.
- Public user profile pages for anonymous browsing.
- Hard vetoes that make games impossible to select.
- Replacing priority points; points remain positive influence, vetoes become limited negative protection.

## Decisions

### Keep favorites and vetoes as preferences, but enforce an active veto limit

Continue storing favorite/veto labels in `UserGamePreference`, but enforce a server-side `MAX_ACTIVE_VETOES` constant when a user marks a game as vetoed. The initial value should be `3`.

Setting a game to favorite or clearing a veto releases the veto slot. The catalog/profile UI should show the number of used and remaining veto slots.

Alternative considered: give users a monthly veto budget or points cost per veto. A small fixed slot count is easier to understand and avoids mixing the point economy with basic comfort boundaries.

### Snapshot session vetoes instead of reading live preferences during scoring

Add a session veto snapshot table, for example `VotingSessionVetoSnapshot`, with:

- `votingSessionId`
- `userId`
- `gameId`
- `source` such as `first_ballot`, `participant_freeze`, or `admin_rebuild`
- `capturedAt`
- unique `(votingSessionId, userId, gameId)`

The first time a user submits a ballot for a session, copy that user's current vetoed games into snapshots for that session if no snapshot exists for the user/session. Later preference changes do not mutate those snapshot rows.

At session close/settlement, freeze missing veto snapshots for active participants who did not vote. Active participants are users who accepted an invitation, were marked as attending, or are otherwise present in the session participant list with a non-declined status. Declined invitees should not apply veto penalties.

Alternative considered: read current preferences every time results are computed. That is simpler but allows strategic last-minute veto changes after a user sees which game is leading.

### Score vetoes as a transparent penalty, not a hidden ban

Result scoring should become:

```text
score = normalVotes + bidPoints - vetoPenalty
vetoPenalty = frozenVetoCount * VETO_PENALTY_POINTS
```

Use `VETO_PENALTY_POINTS = 2` initially. Expose `normalVotes`, `bidPoints`, `vetoCount`, `vetoPenalty`, and `score` in result responses.

Tie behavior should prefer games with fewer frozen vetoes. If two games have the same score and one has zero vetoes while another has one or more, the non-vetoed game leads. If tied games have the same veto count, keep the tie.

Alternative considered: require a vetoed game to clear a fixed victory margin. A numeric penalty plus veto-count tie-breaker is easier to display and easier to combine with point bids.

### Add session participants/invitations as one model

Add a `VotingSessionParticipant` table rather than separate invitation and attendance tables. Suggested fields:

- `votingSessionId`
- `userId`
- `invitedByUserId`
- `status`: `invited`, `accepted`, `declined`, `maybe`, `attended`, `absent`
- timestamps for invitation, response, and attendance updates
- unique `(votingSessionId, userId)`

Creators/admins can invite registered users when creating or editing a future session. Users can update their response. Creators/admins can mark actual attendance during settlement or after the session.

Profile "upcoming invited sessions" should include future sessions where the current user has a non-declined participant row. Profile "past played sessions" should include closed/past sessions where the user is marked `attended`; if attendance has not been explicitly marked, a submitted ballot can be used as a fallback participation signal.

Alternative considered: infer all participation from ballots. That fails for people who RSVP or attend without voting, and it prevents invitation notifications before voting starts.

### Store profile-specific display identity on the user

Add profile fields to `User`, starting with:

- `nickname`
- `normalizedNickname`

Nickname should be optional, user-editable, length-limited, and unique after normalization. Display name resolution should prefer nickname, then OAuth name, then email.

Alternative considered: reuse OAuth `name` only. OAuth names are not always stable or recognizable to the group, and users asked specifically for nicknames.

### Build profile from existing ledgers and new participant data

Add profile read/update services and routes:

- `GET /api/profile`
- `PATCH /api/profile`

The profile response should include:

- user identity and nickname
- favorite games
- vetoed games and remaining veto slots
- priority point balance
- point ledger entries ordered newest first
- upcoming invited sessions
- past played sessions

The point ledger should remain append-only; profile history is a read view over `PriorityPointLedger`.

### Persist notifications as user-targeted rows

Add `UserNotification` with:

- `userId`
- `type`
- `title`
- `body`
- `href`
- optional `actorUserId`, `votingSessionId`, `sessionMessageId`, `ledgerEntryId`
- `readAt`
- `createdAt`

Create notifications transactionally with the action that caused them where practical. Initial triggers:

- session invitation created
- invited session updated or cancelled
- new message in a session the user is invited to or participating in, excluding the author
- point ledger entry created
- session settled/closed for invited participants
- invitation response changed for creators/admins when useful

Add routes:

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

Alternative considered: compute notifications on the fly from sessions/messages/ledger rows. Persisted rows make read/unread state straightforward and avoid expensive cross-table diffs in the main dashboard.

### Keep notifications polled, not pushed

Use lightweight polling when the main screen is open, similar to the existing session message polling. The notification button should show unread count and open a compact panel/list. Each notification should link to the relevant session/profile destination when possible.

Alternative considered: WebSockets or server-sent events. The app is local/small-group oriented and already uses polling for chat; push infrastructure would add complexity before it is needed.

## Risks / Trade-offs

- Veto penalties may feel too strong or too weak -> keep `MAX_ACTIVE_VETOES` and `VETO_PENALTY_POINTS` as named constants and expose score breakdowns so the group can tune them.
- Non-attending users could affect results through invitations -> count veto snapshots only for active/non-declined participants, and let creators/admins mark attendance.
- Frozen snapshots can confuse users who change preferences later -> show "vetoes for this session were captured at..." in result details when relevant.
- Notification volume can become noisy -> avoid self-notifications, deduplicate obvious repeated events, and group message notifications per session if needed.
- Nickname uniqueness can cause edge cases -> validate server-side with clear errors and keep OAuth name as fallback.
- Attendance defaults can be wrong -> allow creator/admin correction and keep ballot fallback only for profile display, not as a permanent attendance claim.

## Migration Plan

1. Add nullable `nickname` and `normalizedNickname` fields to users.
2. Add participant, veto snapshot, and notification tables with indexes for user/session lookups.
3. Backfill participant rows from existing ballots for historical sessions with status `attended`.
4. Enforce active veto limits in preference writes.
5. Add snapshot creation during first ballot submission and session close/settlement fallback.
6. Update result aggregation to include veto penalty and tie behavior.
7. Add profile and notification APIs.
8. Add profile page, invitation controls, notification button/panel, and result breakdown UI.

Rollback should keep new tables intact but stop reading veto snapshots and notifications if the feature is disabled. Existing votes, point ledger entries, messages, and preferences should not be destructively modified.

## Open Questions

- Should regular users be allowed to invite other users to sessions they created, or should invitations be admin-only for the first implementation?
- Should message notifications be one per message, or grouped per session until the user opens the session?
- Should declined users remain visible to creators in attendance controls after the session closes?
