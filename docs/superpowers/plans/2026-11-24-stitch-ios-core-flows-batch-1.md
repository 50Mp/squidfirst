# Stitch iOS Core Flows Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three owner-approved iPhone-first Stitch screens—Orders, Order Details, and Customer Chat—without changing any existing screen.

**Architecture:** Google Stitch project `9946906478898127464` remains the visual source of truth. Generate each screen independently with the existing `Squid First iOS Minimal Light` design-system asset, inspect its screenshot and HTML, and record the exact screen/file IDs locally before continuing to the next screen.

**Tech Stack:** Google Stitch MCP, Stitch design-system asset `assets/947ca27b20114406acd82304a904f510`, local `.stitch` metadata and exported HTML/PNG

**Spec:** `.stitch/DESIGN.md`

## Global Constraints

- Device-first target is iPhone at 390 logical pixels; every generated screen must use `MOBILE`.
- Color mode is light only; do not generate dark variants.
- Use design-system asset `assets/947ca27b20114406acd82304a904f510`; generation prompts describe content and layout, not colors or fonts.
- Cards have no border and no shadow by default; shadows are limited to sheets and popovers.
- Touch targets are at least 44×44 logical pixels and Thai labels must remain readable without horizontal scrolling.
- Do not call `apply_design_system` on any existing screen; this batch adds exactly three screens to the 170-screen baseline.
- Use realistic Thai operations copy and keep one clear primary action per screen.

## Review Focus

- Generated typography must use separate `Inter` and `sans-serif` fallbacks, never the invalid combined family name `Inter, -apple-system, sans-serif`.
- A generated screen must not inherit the old dark Aether Ops canvas; body and surfaces must remain light.
- Long customer names, package names, order IDs, and chat messages must wrap safely at 390px without clipping.
- Status chips and icon-only actions must retain 44px tap areas and understandable labels.
- The final inventory must contain exactly three new `MOBILE` screens while every pre-existing screen ID remains present and unchanged.

---

### Task 1: Generate the Orders screen

**Files:**
- Create: `.stitch/designs/<orders-screen-id>.html`
- Create: `.stitch/designs/<orders-screen-id>.png`
- Modify: `.stitch/metadata.json`

**Interfaces:**
- Consumes: approved design-system asset and 170-screen baseline inventory
- Produces: one new `MOBILE` Orders screen ID with downloadable HTML and screenshot

- [ ] **Step 1: Capture the baseline inventory**

Run `list_screens` and record all 170 pre-existing screen IDs before generation.

- [ ] **Step 2: Generate the Orders screen**

Use `generate_screen_from_text` with `deviceType: MOBILE`, the approved design-system asset, and a Thai iPhone order-list prompt containing segmented status filters, search/filter controls, compact summaries, realistic order rows, and the four-item bottom navigation with Orders active.

- [ ] **Step 3: Verify and export the Orders screen**

Expected: Thai title `ออเดอร์`, `deviceType: MOBILE`, no desktop table/sidebar, light canvas, no default card shadow/border, valid font tokens, and 44px controls. Save the returned HTML and screenshot under `.stitch/designs/`.

- [ ] **Step 4: Record the Orders screen**

Add its exact screen ID, title, source file IDs, and verification status to `.stitch/metadata.json`.

### Task 2: Generate the Order Details screen

**Files:**
- Create: `.stitch/designs/<order-details-screen-id>.html`
- Create: `.stitch/designs/<order-details-screen-id>.png`
- Modify: `.stitch/metadata.json`

**Interfaces:**
- Consumes: design-system asset and the list-to-detail navigation context from Task 1
- Produces: one new `MOBILE` Order Details screen for order `#SQ-98435`

- [ ] **Step 1: Generate the Order Details screen**

Use `generate_screen_from_text` with a Thai iPhone detail prompt containing order/customer/game/package identifiers, slip review, status timeline, cost/profit breakdown, customer chat preview, and a sticky status-appropriate primary action.

- [ ] **Step 2: Verify and export the Order Details screen**

Expected: Thai title `รายละเอียดออเดอร์`, visible order `#SQ-98435`, clear back navigation, light canvas, valid font tokens, no desktop table/sidebar, and a 44px sticky primary action. Save HTML and screenshot.

- [ ] **Step 3: Record the Order Details screen**

Add its exact screen ID, title, source file IDs, and verification status to `.stitch/metadata.json`.

### Task 3: Generate the Customer Chat screen

**Files:**
- Create: `.stitch/designs/<customer-chat-screen-id>.html`
- Create: `.stitch/designs/<customer-chat-screen-id>.png`
- Modify: `.stitch/metadata.json`

**Interfaces:**
- Consumes: design-system asset and order/customer context from Task 2
- Produces: one new `MOBILE` Customer Chat screen linked visually to `#SQ-98435`

- [ ] **Step 1: Generate the Customer Chat screen**

Use `generate_screen_from_text` with a Thai iPhone conversation prompt containing order context, incoming/outgoing messages, timestamps, one system event, receipt attachment preview, and a safe-area composer with attachment and send actions.

- [ ] **Step 2: Verify and export the Customer Chat screen**

Expected: Thai title `แชทลูกค้า`, visible order context, readable message wrapping, light canvas, valid font tokens, no global desktop navigation, and 44px composer actions. Save HTML and screenshot.

- [ ] **Step 3: Record the Customer Chat screen**

Add its exact screen ID, title, source file IDs, and verification status to `.stitch/metadata.json`.

### Task 4: Verify Batch 1 and gate implementation

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-stitch-ios-core-flows-batch-1.md`
- Modify: `.superpowers/sdd/2026-11-24-stitch-ios-core-flows-batch-1/progress.md`

**Interfaces:**
- Consumes: all three generated screen IDs and the baseline inventory
- Produces: a verified 173-screen inventory and an owner-review package for the later React implementation plan

- [ ] **Step 1: Verify project inventory**

Run `list_screens`. Expected: 173 total screens, exactly the three planned new `MOBILE` screens, and all 170 baseline IDs still present.

- [ ] **Step 2: Verify design-system integrity**

Run `list_design_systems`. Expected: target asset remains light, Inter-based, and primary `#2563EB`.

- [ ] **Step 3: Present all three screenshots for owner review**

Show Orders, Order Details, and Customer Chat together with the generated component notes and any Stitch suggestions.

- [ ] **Step 4: Keep product implementation gated**

Do not modify React product code until the owner approves Batch 1 or supplies concrete screen revisions.
