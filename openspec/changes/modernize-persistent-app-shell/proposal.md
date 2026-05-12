## Why

The application has grown from a voting screen into a multi-page product with profiles, notifications, game catalog, session detail pages, and admin workflows, but the navigation and visual language still feel page-local and unfinished. A persistent app shell and a more deliberate design system will make the product feel modern, easier to navigate, and more trustworthy for regular use.

## What Changes

- Move the authenticated home header into a reusable app shell that stays consistent across authenticated pages.
- Make primary navigation, profile access, authentication, and notifications available from the shared header instead of only the home page.
- Apply a modern visual system across the web app, using purple as the primary brand color while preserving clear status colors for success, warning, and destructive actions.
- Standardize page spacing, typography, surfaces, buttons, form fields, lists, panels, empty states, and responsive behavior.
- Improve mobile and desktop layouts so dense workflows remain scannable without feeling amateur or visually noisy.
- Keep setup and unauthenticated login screens focused, but align them with the new theme.

## Capabilities

### New Capabilities

- `persistent-app-shell`: Covers shared authenticated navigation, static/sticky header behavior, notification/profile access, active page indication, and responsive navigation.
- `modern-visual-design-system`: Covers purple primary theming, typography, spacing, controls, surfaces, responsive page composition, and app-wide visual consistency.

### Modified Capabilities

- None. There are no archived base specs in `openspec/specs/`; this change introduces product-level UI requirements through new capability specs.

## Impact

- Layout: update `src/app/layout.tsx` and authenticated pages to use a shared app shell instead of duplicating top-level headers.
- Components: add or refactor shared navigation/header components and align existing dashboard, profile, catalog, session, calendar, and detail components with the design system.
- Styling: refactor `src/app/globals.css` into a coherent token-based theme with purple primary color, consistent states, and responsive layout primitives.
- UX: ensure notifications and profile access are available globally for authenticated users and that the header remains visible during navigation and scrolling where appropriate.
- Tests: update component and route/page tests that depend on header placement or text, and add coverage for shared shell rendering and notification access.
