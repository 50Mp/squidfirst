# Stitch iOS Minimal Light Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the approved iPhone-first, light-only, minimal Squid First design system in Google Stitch and validate it on one new Mobile Operations Dashboard before broader rollout.

**Architecture:** Keep Google Stitch project `9946906478898127464` as the visual source of truth. Upload `.stitch/DESIGN.md`, create a project-level design-system asset, and generate one new mobile screen with that asset; existing screens remain unchanged until the sample is visually accepted.

**Tech Stack:** Google Stitch MCP, Stitch DESIGN.md, React/Vite admin implementation in later phases

**Spec:** `.stitch/DESIGN.md`

## Global Constraints

- Device-first target is iPhone at 390 logical pixels; Stitch generation must use `MOBILE`.
- Color mode is light only; do not generate dark variants.
- Preserve the existing project palette: primary `#2563EB`, background `#F8FAFC`, surface `#FFFFFF`, quiet surface `#F1F5F9`, primary text `#0F172A`.
- Cards have no border and no shadow by default; shadows are limited to sheets and popovers.
- Use Inter plus Noto Sans Thai in design output; production code later uses the iOS system-font stack with Thai fallback.
- Do not apply the new asset to the existing 168 screens during the sample phase.

## Review Focus

- Stitch may inherit the old dark Aether Ops theme; the sample must render with a light canvas and white surfaces.
- Generated screens may reintroduce card borders and shadows; inspect the screenshot and HTML for those patterns.
- Thai labels may overflow at 390px; verify wrapping and 44px minimum touch targets.
- The generated screen may be tagged desktop despite the prompt; verify `deviceType` is `MOBILE`.
- Creating the asset must not mutate existing screen instances; compare the project screen inventory before and after.

---

### Task 1: Create the project-level Stitch design system

**Files:**
- Read: `.stitch/DESIGN.md`
- Modify: `.stitch/metadata.json`

**Interfaces:**
- Consumes: approved DESIGN.md and Stitch project ID `9946906478898127464`
- Produces: a Stitch design-system `assetId` recorded in `.stitch/metadata.json`

- [x] **Step 1: Upload the approved DESIGN.md**

Use `upload_design_md` with `projectId: 9946906478898127464` and the base64-encoded UTF-8 file.

- [x] **Step 2: Create the design-system asset**

Use the returned screen instance `id` and `sourceScreen` with `create_design_system_from_design_md`, setting `deviceType: MOBILE`.

- [x] **Step 3: Verify the asset**

Run `list_design_systems` for the project. Expected: a new asset named `Squid First iOS Minimal Light` with light mode and primary `#2563EB`.

- [x] **Step 4: Record the asset ID**

Update `.stitch/metadata.json` with the exact returned `assetId` and status `active-sample-phase`.

### Task 2: Generate one Mobile Operations Dashboard sample

**Files:**
- Modify: `.stitch/metadata.json`

**Interfaces:**
- Consumes: the design-system asset from Task 1
- Produces: one new Stitch `MOBILE` sample screen ID and screenshot for review

- [x] **Step 1: Capture the current screen count**

Run `list_screens`. Expected baseline: 168 product screens before the rollout; 169 total after the DESIGN.md source document is uploaded and before the sample is generated.

- [x] **Step 2: Generate the sample**

Use `generate_screen_from_text` with `deviceType: MOBILE`, the new design-system asset, and a prompt for an iPhone Operations Dashboard using the approved palette and stroke/shadow budget.

- [x] **Step 3: Verify generated metadata**

Run `get_screen` on the new screen. Expected: `deviceType: MOBILE`, a title identifying it as the iOS Minimal Light sample, and downloadable HTML/screenshot assets.

- [x] **Step 4: Inspect visual and HTML output**

Expected: background `#F8FAFC`, primary `#2563EB`, white surfaces, no dark canvas, no default card borders, no default card shadows, and 44px minimum interactive targets.

- [x] **Step 5: Record the sample**

Add the new screen ID/title to `.stitch/metadata.json` without modifying existing screen records.

### Task 3: Gate the broader rollout

**Files:**
- Modify later: `.stitch/metadata.json`
- Modify later: selected Stitch mobile screens only after owner approval

**Interfaces:**
- Consumes: owner feedback on the Task 2 sample
- Produces: an approved shortlist of existing screens for incremental application

- [ ] **Step 1: Present the sample for owner review**

Show the generated screenshot and summarize typography, color, spacing, stroke, and shadow behavior.

- [x] **Step 2: Keep existing screens unchanged until approval**

Verify the only new screen instance is the DESIGN.md source and sample output; do not call `apply_design_system` yet.

- [ ] **Step 3: Define the next batch after approval**

Select at most three core mobile flows—Operations Home, Orders, and Order Details—for the first incremental apply/edit cycle.

## Current Results

- Design-system asset: `assets/947ca27b20114406acd82304a904f510`
- Sample screen: `projects/9946906478898127464/screens/d5331699295f43b497b546a572dab403`
- Sample title: `Squid First — ภาพรวม (iOS Operations Dashboard)`
- Verified device: `MOBILE`, 780×1848 export representing a 390×924 iPhone viewport
- Existing product screens changed: none
