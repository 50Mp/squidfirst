# Core Admin Stitch Implementation Plan

**Goal:** Implement the four approved core menus with real existing APIs, a shared #2563EB theme, and responsive Mobile/Web layouts.
**Architecture:** Extend the existing React/Vite screens and API hooks. Preserve authentication, order transitions, one-customer-one-chat behavior, receipts, polling and source/FX guards. Use the four canonical Stitch screens recorded in the readiness review; adapt financial examples to the established USD and gross-profit contracts.
**Spec:** docs/development-readiness-2026-11-23.md, approved by the user to begin on 2026-11-23.

## Constraints and review focus
- No production messages, supplier purchases, bank transfers, secrets, or database migrations.
- No invented analytics, latency, closed-chat counts, badges or successful financial operations.
- Keep fullscreen conversation, Enter/Shift+Enter, draft preservation, zoom and pull-refresh behavior.
- Show retry on failed reads and retain clear indication when displaying previous data.
- Do not display zero as a successful result while a read is loading or failed.
- Keep navigation and actions usable at 360px, 390px, 768px and 1280px.
- Retain current owner-only authorization; unsupported future modules do not get active buttons.

## Tasks
1. [x] Add focused browser acceptance coverage for queue navigation, order UID copy, chat unread filter, store links, error retry and primary theme. Reproduce the current missing behavior.
2. [x] Align shared theme, shell and reusable cards with the canonical screens; preserve mobile navigation and desktop sidebar.
3. [x] Implement overview urgency, real summary cards, queue/chats and shortcuts; implement order cards, URL-driven filters, safe detail entry and copy feedback.
4. [x] Implement chat list summary/filter/cards and grouped store hub with actual source/FX data and existing settings routes.
5. [x] Make the auth test use unique signed query IDs so replay checks do not collide with an independent login across a wall-clock second.
6. [x] Run TypeScript checks, build, unit tests and the isolated browser suite; inspect representative Mobile/Web renders and record limits.

Verification: backend/admin TypeScript and build passed; 50 unit/integration-style embedded-database tests and 18 isolated browser tests passed. Independent review found an older-queue pagination issue; SQL filters and a failing-then-passing regression resolved it, followed by review confirmation. No live service integration tests or production restart were performed.

Execution is in the current workspace without Git (no repository present). Keep source backups and review artifacts locally. The user already authorized implementation and verification; do not repeat approval questions.
