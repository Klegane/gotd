## ADDED Requirements

### Requirement: Active veto limit
The system SHALL limit each authenticated user to a finite number of active vetoed games.

#### Scenario: User marks a veto within the limit
- **WHEN** an authenticated user has fewer than the maximum active vetoes and marks an active catalog game as vetoed
- **THEN** the system stores the vetoed preference for that user and game

#### Scenario: User exceeds the veto limit
- **WHEN** an authenticated user already has the maximum active vetoes and marks another game as vetoed
- **THEN** the system rejects the request without changing existing preferences

#### Scenario: User frees a veto slot
- **WHEN** an authenticated user clears a vetoed preference or changes it to favorite
- **THEN** the system releases that active veto slot for another game

### Requirement: Session veto snapshots
The system SHALL freeze a participant's vetoes for a voting session before those vetoes affect session scoring.

#### Scenario: First ballot freezes vetoes
- **WHEN** a participant submits their first ballot for a voting session
- **THEN** the system snapshots that participant's current vetoed games for that session

#### Scenario: Later preference changes do not alter session vetoes
- **WHEN** a participant changes global veto preferences after their vetoes have been snapshotted for a session
- **THEN** the system keeps the existing session veto snapshot unchanged

#### Scenario: Session close freezes non-voting participants
- **WHEN** a session is closed or settled and an active non-declined participant has no veto snapshot
- **THEN** the system snapshots that participant's current vetoed games for that session

#### Scenario: Declined invitee does not apply vetoes
- **WHEN** an invited user has declined a session
- **THEN** the system does not apply that user's vetoes to that session's scoring

### Requirement: Veto-adjusted scoring
The system SHALL include frozen veto penalties in session result scoring.

#### Scenario: Veto penalty lowers score
- **WHEN** a game has frozen vetoes from active participants
- **THEN** the system subtracts the configured veto penalty per veto from that game's normal votes plus bid points

#### Scenario: Vetoed game remains eligible
- **WHEN** a game has one or more frozen vetoes
- **THEN** the system keeps the game visible, votable, proposable, and eligible to be recorded as played

#### Scenario: Results expose veto breakdown
- **WHEN** session results are returned
- **THEN** each result item includes normal votes, bid points, veto count, veto penalty, and final score

### Requirement: Veto tie protection
The system SHALL prefer less-vetoed games when final scores are tied.

#### Scenario: Non-vetoed game beats vetoed tie
- **WHEN** a vetoed game and a non-vetoed game have the same final score
- **THEN** the system ranks the non-vetoed game ahead of the vetoed game

#### Scenario: Equal veto counts remain tied
- **WHEN** tied games have the same frozen veto count
- **THEN** the system keeps those games tied
