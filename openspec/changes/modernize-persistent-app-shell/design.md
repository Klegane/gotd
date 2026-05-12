## Context

The app currently renders the authenticated header inside the home page, while other authenticated pages define their own local structure or rely on page-specific headers. `src/app/layout.tsx` only provides HTML/body and providers, so global navigation, profile access, notifications, and visual framing are not guaranteed after the user navigates to `/games`, `/games/[id]`, `/sessions/[id]`, or `/profile`.

The visual system also evolved feature by feature. Many elements work functionally, but spacing, hierarchy, surfaces, controls, and page composition do not yet feel like one cohesive product. This change should treat the app as a real operational tool for recurring game sessions: polished, calm, quick to scan, and consistent across dense views.

## Goals / Non-Goals

**Goals:**

- Introduce a shared authenticated app shell that owns the persistent header, primary navigation, notifications, profile link, and auth controls.
- Make the header remain available while users move between pages and while they scroll through long pages, using a sticky top position where viewport space allows.
- Establish a purple-led theme through CSS design tokens and apply it consistently to buttons, links, focus states, selected states, badges, and key actions.
- Redesign existing pages and components into a cohesive modern interface without changing core product workflows.
- Improve responsive behavior for mobile, tablet, and desktop layouts.
- Keep accessibility basics intact: keyboard focus, semantic navigation, readable contrast, and non-overlapping text.

**Non-Goals:**

- Replacing the authentication provider or changing authorization rules.
- Adding a component library dependency.
- Reworking database schemas, voting logic, notification semantics, or session business rules.
- Creating a marketing landing page.
- Rebranding beyond visual polish and a purple primary color.

## Decisions

1. Use a Next.js App Router shared shell instead of duplicating headers per page.

   The root layout should keep global providers, while a new server-aware app shell component fetches the current session once and decides whether to render the authenticated chrome. Authenticated pages get the same header and navigation automatically. Setup and unauthenticated states can remain simpler but should still use the same visual tokens.

   Alternative considered: keep the header in each page and extract only a small component. That would reduce initial refactor size, but it preserves the current drift where pages can omit notifications, auth, or navigation.

2. Make the header sticky, not permanently fixed.

   Sticky positioning keeps the header visible during long workflows without permanently stealing viewport space or requiring manual content offset calculations. It is a standard modern app pattern when the header contains navigation, account state, and notifications. On very small screens, the header can collapse into compact navigation while retaining access to core actions.

   Alternative considered: fixed header. Fixed headers can feel more app-like, but they introduce overlap risks and are less forgiving with dynamic notification panels and mobile browser chrome.

3. Create a token-driven CSS system around purple primary color.

   `globals.css` should define semantic tokens such as `--color-primary`, `--color-primary-strong`, `--color-surface`, `--color-border`, `--color-danger`, and `--shadow-soft`. Components should use these tokens instead of hard-coded page-specific colors. Purple should lead brand and primary actions, while success, warning, danger, and neutral states keep distinct colors for meaning.

   Alternative considered: rewrite with Tailwind or a UI kit. That may be attractive later, but the current app already uses CSS classes and can be brought to a high standard without adding dependency or migration noise.

4. Preserve dense operational workflows instead of adding marketing-style decoration.

   Dashboards, session detail, profile, and catalog pages should prioritize scanability, stable controls, predictable panels, and clear state. The redesign should avoid oversized hero sections, decorative blobs, nested cards, and one-note gradients.

   Alternative considered: a more editorial visual refresh. That would look dramatic but would make repeated voting/session-management workflows slower and less standard for this type of app.

5. Apply polish through reusable primitives, then page-specific cleanup.

   The implementation should first establish shell, layout primitives, buttons, panels, inputs, tables/lists, badges, and empty states. Existing components can then be adjusted to consume the primitives and tokens. This reduces visual inconsistency without requiring a risky full rewrite.

   Alternative considered: redesign each page independently. That can move quickly at first, but it tends to create another inconsistent design layer.

## Risks / Trade-offs

- Sticky header may reduce vertical space on mobile -> Use compact header sizing, wrapping-safe controls, and mobile navigation patterns.
- Moving header responsibility into a shared shell may affect tests that expect page-local header text -> Update tests around shared shell behavior and page-specific content.
- A broad CSS refactor can accidentally change dense component layouts -> Make visual changes in passes and verify key pages at desktop and mobile widths.
- Purple primary color can overwhelm the interface if overused -> Use purple for primary actions, active states, focus, and brand accents; keep surfaces mostly neutral.
- Notification popovers in a sticky header can overlap content -> Constrain popover width, z-index, and mobile layout; ensure it can close and mark items read.

## Migration Plan

1. Add the shared app shell component and move authenticated header content into it.
2. Remove duplicated header/navigation from authenticated pages and wrap page content in consistent page containers.
3. Introduce theme tokens and update global button, input, panel, badge, and layout styles.
4. Update major pages/components in focused passes: home dashboard, session detail, profile, game catalog/detail, admin/session forms, notification panel.
5. Update tests for the new shell and adjusted class/text structure.
6. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

Rollback is straightforward because this is a UI-only change: revert the shell component, restore page-local headers, and revert CSS/component presentation changes. No data migration is involved.
