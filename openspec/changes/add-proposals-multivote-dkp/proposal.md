## Why

La votacion actual decide una sesion con un unico voto por jugador, pero no resuelve bien dos situaciones habituales: sesiones con muchas opciones viables y juegos que un jugador propone repetidamente sin llegar a jugarse. Este cambio busca que la votacion exprese mejor preferencias amplias y que el sistema compense de forma transparente a quienes ceden varias sesiones seguidas.

## What Changes

- Add per-session configuration for whether players may propose games beyond the creator/admin curated options.
- Allow session creators/admins to create closed-proposal sessions, while applying a points cost or penalty when they offer fewer than three creator options.
- Replace single-game voting with multi-vote ballots for sessions with more than three eligible games.
- Allow players to place multiple votes on the same game while preventing any player from voting for every available game.
- Add player proposals as first-class session options, distinct from creator/admin curated options.
- Add DKP-style priority points that players earn when their proposed game is not ultimately played.
- Add point bids that increase a proposed game's score enough for long-ignored proposals to eventually win with a solo voter.
- Add point settlement when a session is closed and the actually played game is recorded.
- Charge all bid points when the bid-backed game is played, and charge a partial loss, such as half the bid, when it is not played.
- **BREAKING**: The vote data model and APIs will no longer represent a user's session vote as a single `gameId`; callers must handle ballots with multiple vote allocations and optional point bids.

## Capabilities

### New Capabilities

- `session-game-proposals`: Covers per-session proposal settings, creator/admin options, player proposals, and penalties for restrictive closed-proposal sessions.
- `multi-vote-ballots`: Covers multi-vote ballot limits, repeated votes on one game, vote replacement, result calculation, and API/UI behavior for ballots.
- `dkp-priority-points`: Covers earning, bidding, spending, partial bid loss, played-game settlement, balances, and audit history for priority points.

### Modified Capabilities

- None.

## Impact

- Affected code: Prisma schema/migrations, voting service, session APIs, admin session APIs, React dashboard/session detail UI, result summaries, tests, and local docs.
- Affected data: vote records need to support multiple allocations per player/session; session options need proposal metadata; users need point balances or a point ledger; sessions need a recorded played game and settlement state.
- Affected APIs: session state responses, vote endpoints, session creation/update endpoints, curation/proposal endpoints, and result payloads.
- Affected behavior: results combine normal votes and point bids; closing a session can settle points based on the played game, not only the vote winner.
