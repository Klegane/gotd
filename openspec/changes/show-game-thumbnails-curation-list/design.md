## Context

`GameCurationPanel` renders the admin curation list used by the session detail page with `idPrefix="session-detail-game-curation"` and by the dashboard curation panel. The shared `Game` type already includes `thumbnailUrl` and `imageUrl`, and catalog/session UI elsewhere already renders game images with a fallback to `/placeholder-game.svg`.

The current curation list rows contain a checkbox plus game text. The implementation should add visual recognition without changing selection semantics, catalog loading, filtering, sorting, or persistence.

## Goals / Non-Goals

**Goals:**
- Show a compact thumbnail next to every game name in the curation list.
- Reuse existing image fields and placeholder behavior.
- Preserve current checkbox labels, row click behavior, search highlighting, and selected styling.
- Keep rows stable and readable across narrow management panels and mobile layouts.

**Non-Goals:**
- Do not add new image storage fields, database migrations, or catalog API changes.
- Do not replace the curation list with a card grid.
- Do not change how games are selected, saved, filtered, sorted, or authorized.
- Do not make thumbnails the accessible name for the option; the game name remains the readable label.

## Decisions

1. Render thumbnails inside `GameCurationPanel`.
   - Rationale: both session detail and dashboard curation use this shared component, so the visual treatment stays consistent.
   - Alternative considered: update only `SessionDetailView`. That would duplicate curation row markup or require a special case for one caller.

2. Use plain `<img>` with `src={game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"}` and `alt=""`.
   - Rationale: the app already uses this pattern for game cards and result rows, and the nearby text already names the game.
   - Alternative considered: use `next/image`. That would add configuration complexity for external BoardGameGeek image hosts without clear benefit for this small existing pattern.

3. Add a dedicated thumbnail class with fixed dimensions and `object-fit: contain`.
   - Rationale: curation rows need stable height and readable text in a narrow side panel.
   - Alternative considered: let the image size naturally. That risks layout shift and inconsistent row heights.

4. Keep the checkbox first in the label and place thumbnail between checkbox and copy.
   - Rationale: the selection control remains visually and semantically primary while adding recognition next to the game name.
   - Alternative considered: use the thumbnail as the first element. That would make the checkbox less scannable in a selection-heavy workflow.

## Risks / Trade-offs

- Missing or broken catalog images -> Use the existing placeholder fallback; browser-level broken remote images may still show if a remote URL fails after selection.
- More horizontal content in a side panel -> Use small fixed thumbnails and `minmax(0, 1fr)` copy so long names continue wrapping.
- Shared component affects dashboard curation too -> Accept as consistent behavior because both panels perform the same curation task.
