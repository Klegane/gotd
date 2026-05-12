## 1. App Shell Structure

- [x] 1.1 Add a shared authenticated app shell component that renders product identity, primary navigation, notifications, profile access, and auth controls.
- [x] 1.2 Wire the app shell through the App Router layout/page structure so authenticated top-level pages no longer duplicate the home header.
- [x] 1.3 Add active-route navigation states for dashboard, games, profile, and session-related destinations.
- [x] 1.4 Make the header sticky with safe z-index, content offset, and mobile-friendly wrapping behavior.

## 2. Purple Design System

- [x] 2.1 Refactor global CSS tokens around a purple primary palette plus neutral, success, warning, and danger semantic colors.
- [x] 2.2 Standardize button, link, focus, badge, panel, list, empty-state, and notification surface styles.
- [x] 2.3 Standardize form controls, segmented controls, checkboxes, inputs, textareas, and disabled/loading states.
- [x] 2.4 Normalize typography scale, page containers, spacing rhythm, shadows, borders, and responsive breakpoints.

## 3. Page And Component Refresh

- [x] 3.1 Update the home dashboard layout to use the new shell and modern layout primitives.
- [x] 3.2 Update session detail views, voting panels, participant panels, result summaries, messages, and admin/session forms.
- [x] 3.3 Update game catalog and game detail pages, including preference controls and curation panels.
- [x] 3.4 Update profile and notification UI so they match the shared system and work cleanly from the persistent header.
- [x] 3.5 Update setup and unauthenticated login screens to share the new visual theme without showing authenticated navigation.

## 4. Responsive And Accessibility Pass

- [x] 4.1 Verify mobile, tablet, and desktop layouts for header, dashboard, catalog, session detail, and profile pages.
- [x] 4.2 Fix any text overlap, unstable control sizing, unreadable contrast, or keyboard focus issues introduced by the redesign.
- [x] 4.3 Ensure notification popovers and compact navigation remain reachable and do not hide critical page actions.

## 5. Tests And Verification

- [x] 5.1 Add or update tests for shared shell rendering, active navigation, global notifications access, and authenticated/unauthenticated shell behavior.
- [x] 5.2 Update affected component tests for new structure or labels without weakening behavior assertions.
- [x] 5.3 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 5.4 Run OpenSpec validation for `modernize-persistent-app-shell`.
