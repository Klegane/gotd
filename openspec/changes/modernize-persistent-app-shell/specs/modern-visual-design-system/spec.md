## ADDED Requirements

### Requirement: Purple primary theme
The system SHALL use purple as the primary brand and action color across the application while preserving distinct semantic colors for success, warning, danger, and neutral states.

#### Scenario: User sees primary actions
- **WHEN** the application renders primary buttons, active navigation, focus accents, selected states, or brand highlights
- **THEN** those elements use the purple primary theme consistently

#### Scenario: User sees destructive or status actions
- **WHEN** the application renders destructive actions, warnings, success states, or neutral metadata
- **THEN** those states use colors that remain visually distinct from the purple primary theme

### Requirement: Cohesive layout system
The system SHALL apply consistent page containers, spacing, panels, grids, and responsive constraints across dashboard, catalog, detail, profile, and admin workflows.

#### Scenario: User moves between pages
- **WHEN** an authenticated user navigates between major application pages
- **THEN** page spacing, content width, section rhythm, and panel styling feel consistent

#### Scenario: User views dense workflow pages
- **WHEN** a page contains calendars, results, forms, participant lists, messages, or game lists
- **THEN** the layout prioritizes scanability and stable controls over decorative or marketing-style presentation

### Requirement: Modern component styling
The system SHALL standardize the visual treatment of buttons, links, form fields, badges, tabs, lists, empty states, dialogs/panels, and notification surfaces.

#### Scenario: User interacts with controls
- **WHEN** the user hovers, focuses, selects, disables, or submits controls
- **THEN** visual states are clear, accessible, and consistent across components

#### Scenario: User reads structured content
- **WHEN** the user scans sessions, games, results, participants, preferences, profile data, or notifications
- **THEN** repeated items use consistent hierarchy, spacing, metadata, and action placement

### Requirement: Typography and hierarchy
The system SHALL use consistent typography scales and heading hierarchy appropriate to app workflows rather than oversized landing-page treatment.

#### Scenario: User views compact panels
- **WHEN** the application renders cards, sidebars, tables, forms, or dashboard panels
- **THEN** headings and body text fit their containers without overlap or excessive hero-scale sizing

#### Scenario: User views page-level content
- **WHEN** the application renders page titles or section headings
- **THEN** the hierarchy clearly distinguishes page, section, item, and metadata text

### Requirement: Responsive visual quality
The system SHALL maintain readable, non-overlapping, professional layouts across mobile and desktop viewports.

#### Scenario: User resizes the viewport
- **WHEN** the viewport changes between mobile, tablet, and desktop sizes
- **THEN** text, buttons, panels, navigation, forms, and lists adapt without overlapping or causing incoherent layout shifts

#### Scenario: User views long labels or dynamic content
- **WHEN** a game name, nickname, session title, notification, or button label is longer than expected
- **THEN** the UI wraps, truncates, or resizes according to the component pattern without breaking the layout
