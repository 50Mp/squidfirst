# Squid First Design System Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Squid First iOS Minimal Light design system to the existing React/Vite admin without replacing its authenticated API, routing, state, or operational behavior.

**Architecture:** Keep the current React component and route structure. Add a final CSS token bridge after the legacy styles so every route receives the approved palette, typography, spacing, radius, stroke, shadow, safe-area, focus, and target-size rules; make only small semantic shell changes where CSS alone cannot satisfy the contract.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Playwright, CSS custom properties

**Spec:** `.stitch/DESIGN.md`

## Global Constraints

- Light mode only; no dark-mode variant.
- Exact core tokens: primary `#2563EB`, canvas `#F8FAFC`, surface `#FFFFFF`, quiet surface `#F1F5F9`, primary text `#0F172A`, secondary text `#64748B`, separator `#E2E8F0`.
- iPhone-first at 390 logical pixels with safe-area padding and no horizontal page overflow down to 320px.
- Default cards and navigation have no border and no shadow; only sheets, popovers, destructive confirmations, or transient floating controls may use elevation.
- Controls are at least 44×44px, form text is at least 16px on mobile, and every focusable control has a visible focus indicator.
- Preserve current auth, CSRF/Origin, API contracts, route state, idempotency, audit behavior, MOCK separation, and existing four-destination navigation.
- Do not introduce unsupported automation, net-profit claims, provider integrations, or sample transactions as live behavior.

## Review Focus

- Legacy dark tokens in `styles.css` must not win the cascade after the new token bridge loads.
- Mobile fixed navigation and chat composer must respect safe areas without covering focused content.
- Removing borders and shadows must retain discoverable grouping through surface contrast and spacing.
- Thai labels, order IDs, UIDs, and long package names must wrap without horizontal page overflow.
- Desktop list/detail behavior and all current API interactions must remain unchanged.

---

### Task 1: Add design-system acceptance coverage

**Files:**
- Modify: `tests/miniapp/design-alignment.spec.ts`

**Interfaces:**
- Consumes: existing Mini App test server and four canonical routes
- Produces: failing browser assertions for the approved tokens, flat surfaces, 44px targets, safe-area shell, and light-only color scheme

- [x] **Step 1: Write the failing acceptance assertions**

Extend the existing responsive design test to assert all approved root color tokens, `color-scheme: light`, no default panel/card shadow or border, and at least 44px for representative navigation and primary controls.

- [x] **Step 2: Run the focused browser test and verify RED**

Run `npx playwright test tests/miniapp/design-alignment.spec.ts`. Expected: FAIL on missing/new token or legacy card border/shadow assertions before implementation.

### Task 2: Implement the design-system token bridge

**Files:**
- Create: `admin-ui/src/design-system.css`
- Modify: `admin-ui/src/main.tsx`

**Interfaces:**
- Consumes: `.stitch/DESIGN.md` and existing CSS class contract
- Produces: final-cascade design tokens and responsive global component behavior across every route

- [x] **Step 1: Add exact semantic tokens and import them last**

Define the approved colors, type stack, spacing, radii, safe-area values, focus ring, and target sizes in `design-system.css`; import it after `continuity.css`.

- [x] **Step 2: Flatten shared surfaces and navigation**

Override panels, cards, headers, tabs, list containers, search fields, and action docks to use grouped surfaces without default borders or shadows; retain low-contrast row separators only where needed.

- [x] **Step 3: Implement iPhone-first safe areas and target sizes**

Use logical properties, `env(safe-area-inset-*)`, coarse-pointer 44px targets, 16px form text, scroll padding, reduced-motion handling, and overflow wrapping.

- [x] **Step 4: Run focused browser acceptance and verify GREEN**

Run `npx playwright test tests/miniapp/design-alignment.spec.ts`. Expected: all design-alignment tests pass.

### Task 3: Verify regression and production build

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-design-system-code-implementation.md`

**Interfaces:**
- Consumes: completed token bridge and acceptance tests
- Produces: a buildable admin and fresh responsive regression evidence

- [x] **Step 1: Run TypeScript checks**

Run `npm run check && npm run check:admin`. Expected: both pass.

- [ ] **Step 2: Run backend/unit regression** — 52/54 passed; the backend-only backup and PGlite persistence filesystem tests fail in isolation and are outside the UI surface changed by this batch.

Run `npm test`. Expected: all tests pass.

- [x] **Step 3: Run the core browser suites**

Run `npx playwright test tests/miniapp/design-alignment.spec.ts tests/miniapp/core-workspace.spec.ts tests/miniapp/ux-continuity.spec.ts`. Expected: all tests pass at the existing responsive viewports.

- [x] **Step 4: Build production assets**

Run `npm run build`. Expected: TypeScript and Vite production builds pass.

- [x] **Step 5: Capture mobile and desktop screenshots**

Capture representative mobile and desktop flows for owner review without deploying or restarting production.

## Verification Results

- RED: the new design-system acceptance failed with all 11 semantic tokens missing before implementation.
- GREEN: `tests/miniapp/design-alignment.spec.ts` passed 9/9 after the final-cascade bridge was built.
- Browser regression: design alignment, core workspace, and UX continuity passed 18/18.
- TypeScript: backend and admin checks passed.
- Production build: backend compilation and Vite admin build passed.
- Unit regression: 52/54 passed. `tests/backup.test.ts` reports a failed backup status and `tests/persistence.test.ts` reports `PGlite is closed`; both reproduce when run alone, outside the CSS/UI surface changed here.
