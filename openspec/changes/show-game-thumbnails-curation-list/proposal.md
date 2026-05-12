## Why

Session game curation currently lists games by name and metadata only, which makes large catalogs harder to scan and can force admins to rely on memory. Showing each game's thumbnail beside its name helps curators visually identify games faster in the session detail management panel.

## What Changes

- Add a small game thumbnail to each row in the session detail game curation list.
- Use the existing catalog image fields, preferring `thumbnailUrl`, then `imageUrl`, then the existing placeholder asset.
- Keep checkbox behavior, search highlighting, filtering, sorting, selection state, and save behavior unchanged.
- Ensure the row layout remains stable and readable on desktop and mobile.

## Capabilities

### New Capabilities
- `session-game-curation-thumbnails`: Covers visual thumbnails in session game curation rows so admins can identify games by image while selecting eligible games.

### Modified Capabilities

## Impact

- Affected code: `src/components/GameCurationPanel.tsx`, `src/app/globals.css`, and focused component/UI tests if available.
- Affected UI: session detail curation panel with `idPrefix="session-detail-game-curation"` and the shared dashboard curation panel that uses the same component.
- Affected APIs/data: none expected because `Game` already includes `thumbnailUrl` and `imageUrl` from catalog responses.
