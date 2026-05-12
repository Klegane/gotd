## Context

The current voting model stores one `Vote` per `(votingSessionId, userId)` and treats that row as the user's current vote. Session curation is represented as eligible game options, but options do not record whether they came from the creator or from a player proposal. Results are simple vote counts and there is no persisted concept of the game that was actually played.

This change crosses the database model, vote APIs, session creation/update flows, result summaries, and React voting UI. It also introduces a small points economy, so every point mutation must be auditable and idempotent.

## Goals / Non-Goals

**Goals:**

- Let sessions opt in or out of player game proposals.
- Let players submit game proposals when the session allows it.
- Prevent restrictive closed-proposal sessions with fewer than three creator options from being free for the creator.
- Allow multi-vote ballots for sessions with more than three eligible games.
- Allow repeated votes on the same game while preventing a player from voting for every eligible game.
- Let players spend accumulated priority points to boost one proposed game.
- Award points only when a player's priority proposal is not the game actually played.
- Settle point awards and bid costs from a recorded `playedGameId`, not from the vote winner alone.
- Keep a ledger so balances can be recalculated and audited.

**Non-Goals:**

- Automatically detecting the played game from external systems.
- Real-time collaborative voting updates.
- Multiple currencies or per-group point pools.
- Replacing favorites/vetoes with proposals; personal preferences remain separate.

## Decisions

### Session proposal policy

Add session-level proposal configuration to `VotingSession`:

- `allowPlayerProposals` defaulting to `true`.
- `proposalsLockedAt` or equivalent state for sessions where the creator/admin closes proposals.
- `playedGameId` for settlement.
- `pointsSettledAt` to make settlement idempotent.

Eligible games remain session-specific options, but options/proposals need richer metadata:

- Creator/admin curated options count toward the "creator offered at least three games" rule.
- Player proposals can add a game to the eligible set when proposals are open.
- A separate proposal record should track which user proposed which game, because several users may want credit for the same game.

Alternative considered: store only one `proposedByUserId` on each session option. This is simpler, but it fails when multiple users independently propose the same game and should each be eligible for point outcomes.

### Closed-proposal control cost

When a session is closed to player proposals and the creator/admin provides fewer than three creator options, the creator pays a control cost based on the missing option count. The initial implementation should use a configurable constant, for example:

```text
controlCost = (3 - creatorOptionCount) * CLOSED_PROPOSAL_MISSING_OPTION_COST
```

The cost should be charged with a ledger entry when the restrictive configuration becomes active. Non-admin creators must have enough available points; admins can still create or adjust sessions through explicit admin ledger adjustments if needed.

Alternative considered: allow the session but award everyone else bonus points. Charging the creator is more direct and easier for users to understand.

### Ballot and allocation model

Replace the single-vote row contract with:

- `VoteBallot`: unique per `(votingSessionId, userId)`.
- `VoteAllocation`: one row per `(ballotId, gameId)` with `voteCount`.
- Optional point bid fields or a related `PointBid` record for one bid-backed game per ballot.

For sessions with three or fewer eligible games, each player has one normal vote. For sessions with more than three eligible games:

```text
maxTotalVotes = eligibleGameCount - 1
maxDistinctGames = eligibleGameCount - 1
```

Repeated votes on one game are valid as long as total votes stay within the limit. A ballot is invalid if it allocates votes to every eligible game, even if the total count is within the limit.

Alternative considered: a fixed maximum such as three votes. The user explicitly wants a large limit, so `eligibleGameCount - 1` keeps the rule large and easy to explain while preserving the "cannot vote for everything" constraint.

### Priority proposal and point earning

Each user can mark at most one proposal per session as their priority proposal for DKP earning and bidding. Users may be allowed to suggest multiple games for the eligible list, but only the priority proposal can:

- Earn points if it is not played.
- Receive that user's point bid.

This avoids point farming by proposing many games in the same session.

Alternative considered: award points for every unplayed proposed game. That encourages noisy proposals and makes the point economy grow too quickly.

### Point bids and scoring

Result scoring uses:

```text
score = normalVoteCount + activePointBidAmount
```

There should be no low hard cap on bid amount beyond the user's available balance. A player who has accumulated enough points must be able to make a solo bid that wins a later session.

Point bid outcomes:

- If the bid-backed game is the recorded played game, spend 100% of the bid.
- If the bid-backed game is not played, lose a partial amount, initially half rounded up.
- If the session is cancelled before settlement, release bids without charging them.

Alternative considered: refund losing bids entirely. Partial loss better reflects that using priority influence has a cost even when it fails.

### Settlement from played game

Closing a session should allow the creator/admin to record the game actually played. Point settlement uses that `playedGameId`.

- A proposal that loses the vote but is played does not earn points.
- A proposal that wins the vote but is not played still earns points for its proposer.
- Settlement must be idempotent; re-running it must not duplicate ledger entries.

## Risks / Trade-offs

- Point farming through many proposals -> Mitigate with one point-eligible priority proposal per user/session.
- Confusing UI with votes and point bids together -> Mitigate by separating "normal votes" from "priority bid" controls and showing score breakdowns.
- Data migration from one vote row to ballot allocations -> Mitigate by creating one ballot and one allocation per existing vote during migration.
- Settlement mistakes if the wrong played game is recorded -> Mitigate by showing a confirmation and retaining a ledger audit trail; post-settlement edits require explicit admin correction.
- Closed-proposal costs could block legitimate small sessions -> Mitigate with admin override/adjustment and clear messaging before saving.

## Migration Plan

1. Add new tables/columns without deleting old vote data.
2. Backfill each existing `Vote` into one `VoteBallot` and one `VoteAllocation` with count `1`.
3. Update read paths to use ballots/allocations while keeping old data only for migration safety.
4. Update write paths to submit full ballot payloads.
5. Remove or deprecate the old single-vote uniqueness assumption after verification.
6. Add point ledger with zero initial balance for existing users.
7. Deploy UI changes after API responses include ballot limits, proposal policy, point balance, and score breakdowns.

Rollback strategy: keep the original `Vote` table until ballot reads and writes are verified. If rollback is needed before old writes are removed, continue reading the original single-vote data.

## Open Questions

- What exact constants should be used for points earned per unplayed priority proposal and closed-proposal control cost?
- Should admins be allowed to settle points without recording a played game, or should `playedGameId` be mandatory for every closed session?
- Can a player change their priority proposal after votes or bids exist, or should that be locked once they bid points?
