## 1. Data Model and Migration

- [x] 1.1 Add session proposal policy fields to `VotingSession`, including player proposal flag, played game, and point settlement timestamp.
- [x] 1.2 Add proposal metadata models or fields to distinguish creator/admin options from player proposals.
- [x] 1.3 Add ballot and allocation models to support one ballot per user/session with multiple game allocations.
- [x] 1.4 Add priority point ledger and point bid persistence with session/game context and reason codes.
- [x] 1.5 Write a migration that backfills existing single votes into ballots with one allocation each.
- [x] 1.6 Generate and validate the Prisma client after schema changes.

## 2. Server Domain Logic

- [x] 2.1 Add priority point constants and helpers for balance calculation, available balance, ledger creation, and idempotency keys.
- [x] 2.2 Implement session proposal policy validation, including closed-proposal control cost calculation.
- [x] 2.3 Implement player proposal creation, duplicate proposal handling, and eligible option reuse.
- [x] 2.4 Implement ballot limit calculation for sessions with three-or-fewer and more-than-three eligible games.
- [x] 2.5 Implement full ballot replacement with validation for total votes, distinct games, repeated votes, eligible games, and closed sessions.
- [x] 2.6 Replace result summarization with score breakdowns for normal votes, point bids, total score, and leaders.
- [x] 2.7 Implement priority proposal selection with one point-eligible proposal per user/session.
- [x] 2.8 Implement point bidding validation against available balance and priority proposal ownership.
- [x] 2.9 Implement played-game recording and idempotent point settlement for awards, full bid spend, and partial bid loss.
- [x] 2.10 Update session state and calendar DTOs to return proposal policy, current ballot, limits, point balance, bids, and score breakdowns.

## 3. API Routes

- [x] 3.1 Update session creation and admin update APIs to accept proposal policy fields and creator/admin game options.
- [x] 3.2 Add or update an API for authenticated players to propose games for an open-proposal session.
- [x] 3.3 Update the session vote API to accept a full ballot allocation payload instead of a single `gameId`.
- [x] 3.4 Add or update an API for selecting a priority proposal and submitting a point bid.
- [x] 3.5 Add an authorized API for session creators/admins to record the played game and settle points.
- [x] 3.6 Ensure all new APIs reject unauthenticated, unauthorized, invalid game, closed session, and overspend cases without mutating existing valid state.

## 4. React UI

- [x] 4.1 Update session creation/editing controls to choose whether player proposals are open or closed.
- [x] 4.2 Show closed-proposal control cost before saving sessions with fewer than three creator/admin options.
- [x] 4.3 Add player proposal controls in the dashboard and session detail views when proposals are open.
- [x] 4.4 Replace single vote buttons with ballot controls that allow repeated votes and show remaining vote capacity.
- [x] 4.5 Show the user's current ballot in calendar/session summaries without assuming one selected game.
- [x] 4.6 Add priority proposal and point bid controls with current point balance and validation feedback.
- [x] 4.7 Update result panels to show normal votes, bid points, total score, and tied leaders.
- [x] 4.8 Add creator/admin controls to record the played game and settle points when closing a session.

## 5. Tests

- [x] 5.1 Add unit tests for ballot limit calculation, repeated vote validation, and "cannot vote for all games" rejection.
- [x] 5.2 Add unit tests for score summaries combining normal votes and point bids.
- [x] 5.3 Add unit tests for proposal policy validation and closed-proposal control costs.
- [x] 5.4 Add unit tests for point ledger balance, overspend rejection, bid spend, partial bid loss, and idempotent settlement.
- [x] 5.5 Add route tests for proposing games, replacing ballots, bidding points, and recording played games.
- [x] 5.6 Add React tests for multi-vote controls, proposal controls, result breakdowns, and settlement controls.
- [x] 5.7 Add migration/backfill verification for existing single-vote data.

## 6. Documentation and Verification

- [x] 6.1 Document proposal policy, multi-vote limits, point earning, point bidding, and settlement behavior.
- [x] 6.2 Document operational guidance for correcting settlement mistakes through admin ledger adjustments.
- [x] 6.3 Run typecheck, lint, and automated tests.
- [x] 6.4 Perform a local smoke test covering session creation, proposals, multi-vote ballots, point bids, played-game settlement, and point balances.
