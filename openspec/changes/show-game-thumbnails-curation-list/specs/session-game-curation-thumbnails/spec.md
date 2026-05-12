## ADDED Requirements

### Requirement: Curation rows show game thumbnails
The system SHALL display a compact game thumbnail beside each game name in the session game curation list.

#### Scenario: Game has a thumbnail URL
- **WHEN** a curator views the session detail game curation list and a listed game has `thumbnailUrl`
- **THEN** the row displays that thumbnail next to the game name

#### Scenario: Game only has a full image URL
- **WHEN** a curator views the session detail game curation list and a listed game has `imageUrl` but no `thumbnailUrl`
- **THEN** the row displays the full image URL as the thumbnail source next to the game name

#### Scenario: Game has no catalog image
- **WHEN** a curator views the session detail game curation list and a listed game has neither `thumbnailUrl` nor `imageUrl`
- **THEN** the row displays the existing placeholder game image next to the game name

### Requirement: Thumbnail display preserves curation behavior
The system SHALL preserve existing curation list selection and discovery behavior when thumbnails are displayed.

#### Scenario: Selecting a game row with a thumbnail
- **WHEN** a curator toggles a game in the curation list
- **THEN** the selected game IDs update exactly as they did before thumbnails were added

#### Scenario: Filtering and sorting games with thumbnails
- **WHEN** a curator searches, filters, or sorts games in the curation list
- **THEN** the list still filters and sorts by the existing game data while each visible row keeps its thumbnail next to the game name

#### Scenario: Accessible game names remain text based
- **WHEN** assistive technology reads a curation row
- **THEN** the game name remains available from the row text and the thumbnail does not replace or obscure that text label
