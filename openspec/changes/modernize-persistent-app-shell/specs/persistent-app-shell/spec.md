## ADDED Requirements

### Requirement: Shared authenticated app shell
The system SHALL render a shared authenticated app shell for authenticated application pages, including the product identity, primary navigation, notification access, profile access, and authentication controls.

#### Scenario: Authenticated user navigates away from home
- **WHEN** an authenticated user opens a page such as `/games`, `/sessions/{id}`, or `/profile`
- **THEN** the same app header controls are available without relying on the home page header

#### Scenario: Unauthenticated user views login flow
- **WHEN** an unauthenticated user opens the application
- **THEN** the system presents the login experience without exposing authenticated navigation actions

### Requirement: Persistent header behavior
The app shell header SHALL remain available during normal page navigation and SHALL use sticky positioning during long page scrolls where the viewport supports it.

#### Scenario: User scrolls a long authenticated page
- **WHEN** an authenticated user scrolls through a long dashboard, catalog, profile, or session detail page
- **THEN** the header remains reachable at the top of the viewport or through the compact mobile header controls

#### Scenario: Header content changes across routes
- **WHEN** an authenticated user navigates between application pages
- **THEN** notification, profile, auth, and navigation controls remain stable while page-specific content changes below the shell

### Requirement: Primary navigation
The app shell SHALL provide primary navigation to the main dashboard, games catalog, profile, and any other top-level authenticated destinations that are part of regular use.

#### Scenario: User changes top-level section
- **WHEN** an authenticated user selects a primary navigation item
- **THEN** the system navigates to the selected section while preserving access to the shared header controls

#### Scenario: User views current section
- **WHEN** an authenticated user is on a top-level section
- **THEN** the navigation visually identifies the active section

### Requirement: Global notifications access
The app shell SHALL expose the notification button globally for authenticated users and preserve unread count behavior outside the home page.

#### Scenario: User receives unread notifications on a non-home page
- **WHEN** an authenticated user is on a page other than home and has unread notifications
- **THEN** the header displays notification access with the unread state

#### Scenario: User opens notifications from shared header
- **WHEN** an authenticated user opens the notification panel from the shared header
- **THEN** the user can view notifications and mark them read without leaving the current page

### Requirement: Responsive shell
The app shell SHALL adapt navigation and actions for mobile, tablet, and desktop viewports without overlapping text or hiding required actions.

#### Scenario: User opens the app on a narrow viewport
- **WHEN** the viewport is mobile-sized
- **THEN** the header presents compact navigation and actions that remain readable and reachable

#### Scenario: User opens the app on a wide viewport
- **WHEN** the viewport is desktop-sized
- **THEN** the header presents navigation and actions in a scannable horizontal layout
