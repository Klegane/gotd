## ADDED Requirements

### Requirement: Priority point ledger
The system SHALL store all priority point changes in an auditable ledger.

#### Scenario: User balance is calculated
- **WHEN** the system needs a user's priority point balance
- **THEN** the system calculates the balance from that user's ledger entries

#### Scenario: Point change is recorded
- **WHEN** the system awards, spends, partially charges, refunds, or administratively adjusts priority points
- **THEN** the system records a ledger entry with user, amount, reason, and related session or game context

#### Scenario: Non-admin action would overspend points
- **WHEN** a non-admin user action would make the user's available priority point balance negative
- **THEN** the system rejects the action and does not create a ledger entry

### Requirement: Priority proposal per session
The system SHALL allow each authenticated player to have at most one point-eligible priority proposal per session.

#### Scenario: Player marks priority proposal
- **WHEN** an authenticated player marks one of their session proposals as the priority proposal
- **THEN** the system records that proposal as the only point-eligible proposal for that player and session

#### Scenario: Player changes priority proposal before bidding
- **WHEN** an authenticated player changes their priority proposal before placing a point bid
- **THEN** the system replaces the previous priority proposal with the new one

#### Scenario: Player attempts multiple priority proposals
- **WHEN** an authenticated player attempts to keep more than one priority proposal in the same session
- **THEN** the system rejects the change or replaces the previous priority proposal so only one remains

### Requirement: Point bids
The system SHALL allow authenticated players to bid available priority points on their priority proposal for an open session.

#### Scenario: Player bids points on priority proposal
- **WHEN** an authenticated player bids available priority points on their priority proposal
- **THEN** the system records the bid and includes those points in the proposed game's result score

#### Scenario: Player bids more than available balance
- **WHEN** an authenticated player attempts to bid more priority points than their available balance
- **THEN** the system rejects the bid and preserves the previous valid bid, if any

#### Scenario: Player bids on non-priority game
- **WHEN** an authenticated player attempts to bid priority points on a game that is not their priority proposal
- **THEN** the system rejects the bid and preserves the previous valid bid, if any

#### Scenario: Solo bidder has enough points
- **WHEN** one authenticated player bids enough priority points on their priority proposal to exceed all other games' scores
- **THEN** the system identifies that proposed game as the leading result even if no other player votes for it

### Requirement: Played-game settlement
The system SHALL settle priority point awards and bid costs from the game actually recorded as played.

#### Scenario: Proposed game is not played
- **WHEN** a session is settled and a player's priority proposal is not the recorded played game
- **THEN** the system awards that player the configured unplayed-proposal points

#### Scenario: Proposed game is played despite losing vote
- **WHEN** a session is settled and a player's priority proposal is the recorded played game even though it did not have the highest score
- **THEN** the system does not award unplayed-proposal points for that proposal

#### Scenario: Proposed game wins vote but is not played
- **WHEN** a session is settled and a player's priority proposal has the highest score but is not the recorded played game
- **THEN** the system awards unplayed-proposal points for that proposal

#### Scenario: Winning bid-backed game is played
- **WHEN** a session is settled and a player's bid-backed priority proposal is the recorded played game
- **THEN** the system spends the full bid amount from that player's priority point balance

#### Scenario: Bid-backed game is not played
- **WHEN** a session is settled and a player's bid-backed priority proposal is not the recorded played game
- **THEN** the system charges the configured partial bid loss and releases the remaining bid amount

#### Scenario: Session is settled twice
- **WHEN** settlement is requested for a session that has already been settled
- **THEN** the system does not create duplicate point awards or bid charges

### Requirement: Settlement administration
The system SHALL require an authorized creator or admin to record the played game before settling points for a completed session.

#### Scenario: Authorized user records played game
- **WHEN** the session creator or an admin records an eligible played game for a session
- **THEN** the system stores the played game and can settle priority point outcomes for that session

#### Scenario: Unauthorized user records played game
- **WHEN** an authenticated user who is neither the session creator nor an admin attempts to record the played game
- **THEN** the system rejects the request without changing the session or point ledger

#### Scenario: Played game is not eligible
- **WHEN** an authorized user attempts to record a played game that was not eligible for the session
- **THEN** the system rejects the request without settling priority points
