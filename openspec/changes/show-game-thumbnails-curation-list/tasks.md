## 1. Component Markup

- [x] 1.1 Add a decorative image element to each `GameCurationPanel` row using `game.thumbnailUrl ?? game.imageUrl ?? "/placeholder-game.svg"`.
- [x] 1.2 Keep the row label, checkbox IDs, selection toggling, and highlighted game name behavior unchanged.
- [x] 1.3 Confirm the thumbnail appears in the session detail curation panel with `idPrefix="session-detail-game-curation"`.

## 2. Styling

- [x] 2.1 Update curation list row grid styles to include checkbox, fixed-size thumbnail, and flexible text copy.
- [x] 2.2 Add a thumbnail class with stable dimensions, `object-fit: contain`, border radius, and the existing neutral image background.
- [x] 2.3 Verify long game names and metadata wrap cleanly in narrow management panels and mobile layouts.

## 3. Verification

- [x] 3.1 Add or update focused tests for thumbnail source fallback, including thumbnail URL, image URL, and placeholder cases.
- [x] 3.2 Run the relevant test suite for curation/session UI.
- [ ] 3.3 Perform a visual smoke check of the session detail curation list to confirm thumbnails display beside names without disrupting selection.
