# Admin V1 trial acceptance

Updated 2026-11-24 (Asia/Bangkok). Scope: Tasks 1–4 of the approved Stitch implementation plan. Tasks 5–7 remain later releases. **Trial running; initial iPhone usability confirmed by owner; remaining acceptance checks pending. Not a production-readiness sign-off.**

## Verified

- Current canonical screen/route/API mapping: [screen-route-matrix](../design/screen-route-matrix.md). Primary color #2563EB; existing owner/manual workflow retained.
- Backend tests 54/54 after adding channel parity coverage; browser baseline 44/44; TypeScript and production build passed. Browser fixture uses isolated data, no `.env`, supplier purchase or Telegram transport.
- Additional channel parity integration test passed: web approve/start/reopen and Telegram accept/complete callbacks share one MOCK record; callback replay preserves revision, formatted bot status matches the admin read, and status actions create no public customer chat messages. This tests callback processing, not live Telegram delivery.
- Browser reconnect acceptance rerun passed: offline/online transition drains paginated history before marking messages read. Owner also confirmed on a real iPhone that the unsent draft survives network loss and chat loads again after reconnecting.
- Additional browser session check passed: clearing the browser session cookies triggers real API 401 responses, locks the admin UI, and a fresh signed fixture Telegram bootstrap restores access. This does not substitute for waiting out a physical iPhone session.
- Responsive checks at 360/390/768/1280/1440; composer at 360x450; receipt image modal, PDF download failure/retry; public/internal separation, per-customer drafts, search persistence, stale reads and recovery.
- Independent review of d65fc6f..d2057f7 found five Important issues. Each reproduced before repair: private draft visibility after remount; false empty chat on initial failure; lost queue filters; unsaved LFX showing manual arithmetic; typing during pending send losing a subsequent draft. All regression checks and final suites passed after the repair pass. No Critical or Minor findings reported.
- PostgreSQL Docker container healthy. Local API restarted with backend and UI from the same build; `/health` returned ok.
- HTTPS `/admin-app/` returned 200 and referenced `index-B-STL1lB.js`; anonymous `/admin/v1/me` returned 401; `/shop/products`, `/auth/register`, `/games` returned tunnel fallback 404. Owner/non-owner auth covered in fixture. Owner subsequently confirmed opening the Mini App on a real iPhone; no separate live auth trace was collected.
- Encrypted backup `255e72fa-af36-44cf-b8ee-7ad60ee71db3` restored to a new ignored scratch directory. All 22 business table counts matched, 11 receipt files readable, and both Telegram transport queues empty. Scratch recovery starts no workers. Existing unit tests also verify receipt content, wrong-key rejection and refusal to overwrite a destination.
- No new real payment, supplier order or automated Telegram QA message created during this acceptance run. Real checkout remains disabled in existing configuration.

## Design-system deployment and Tunnel cutover — 2026-11-24

- Approved iOS Minimal Light tokens are deployed at `https://admin.cffirst.com/admin-app/`. The public document returned 200, referenced `assets/index-qiaCLweM.css`, and that production CSS contains `--sf-primary:#2563eb`.
- Design-system acceptance passed 9/9; the core responsive browser suites passed 18/18; backend/admin TypeScript checks and the production build passed. The full backend suite passed 54/54 outside the restricted sandbox.
- The remotely-managed `squid-first-local` ingress remains limited to `^/(admin-app|admin/v1)/.*$` at `http://127.0.0.1:3000`, followed by the 404 fallback. Anonymous `/admin/v1/me` returned 401; `/shop/products` and `/` returned 404.
- Tunnel credentials were rotated after the old host reconnected following a connection-only cleanup. The ignored local `data/cloudflare/tunnel.token` now holds the replacement token; the disclosed intermediate token and the old-host token can no longer establish connections.
- The connector on this PC was restarted with the replacement token. Cloudflare reported the tunnel healthy with exactly one Windows connector and four edge connections; the prior host connector and the superseded local process connection were cleaned up and did not return during post-cutover verification.
- Rollback for application code remains a normal rebuild/restart. Tunnel credential rollback must not restore an old token; retrieve the current token from Cloudflare and write it only to the ignored token file before restarting the verified local connector.

## Payment expiry and completion-only Telegram — 2026-11-24

- Unpaid orders now expire transactionally at exactly 15 minutes from `created_at`. The startup maintenance runner sweeps immediately, repeats every five seconds, and stops through the server abort signal. Boundary, receipt-first and expiry-first tests passed 4/4 including the maintenance runner.
- Telegram order jobs are now created only for a successful `completed` transition. Creation, customer order messages, receipt upload, approve, accept, start, issue, resume, reopen, cancel and refund create no order job. Duplicate completion is idempotent; completing again after reopen creates a new completed update for the existing card. Focused notification/channel tests passed 4/4.
- Initialization suppresses legacy unsent order jobs unless they are a completed status job. Already-sent rows and customer-chat transport remain unchanged.
- Backend and admin TypeScript checks passed; the production backend/admin build passed. Admin Playwright acceptance passed 15/15, including the owner order lifecycle and responsive 360/390/768/1280/1440 checks.
- The full backend run reached 58/60. The two failures reproduce on the pre-change baseline and when isolated: the backup worker fixture records `failed` instead of `completed`, and the persistence fixture calls `close()` on an already-closed PGlite database. All new expiry, maintenance and notification tests passed. These two baseline failures remain open and are not counted as feature regressions.
- Production restarted from the same build as PID 25056 with the existing `.env`; `ORDERS_ENABLED=false` remains unchanged. Local `/health` returned `ok`. Cloudflare `/admin-app/` returned 200 with `assets/index-BmHh8DiC.js`, and anonymous `/admin/v1/me` returned 401.
- The immediate production sweep cancelled the 10 overdue real seeded orders. Verification found 0 overdue `awaiting_payment`, 10 overdue `cancelled`, 0 pending/sending non-completion outbox jobs, 0 cancellation jobs and the same 10 previously sent outbox rows. No Telegram message was sent for automatic cancellation.
- Telegram credentials are valid (`getMe` 200 for `SquidfirstBot`), no webhook is configured and the pending update count was zero. Inbound long polling still reports Telegram 409 conflicts. A controlled diagnostic stopped this PC's API before polling and still received 409 after 5.6 seconds, proving another bot instance outside this PC is using the same token. Local process inspection found no second squidfirst bot. This conflicts with inbound callbacks until the old instance is stopped or the bot token is rotated; outbound Bot API access remains available. No live QA message was sent.

## Post-pull Mobile catalog checks — 2026-11-24

- Continued from `a1f38e6` using the incoming iOS Minimal Light UI. Previous local UI drafts remain preserved in the pre-pull stash and were not restored over the incoming code.
- Fresh backend tests passed 61/61; backend/admin TypeScript checks passed. The final browser suite passed 59/59 using `SQUID_LOCAL_BUILD=1` and the build under ignored `artifacts/local-preview/admin-ui/dist`.
- Reproduced and repaired blank successful reads for sellable-game and source-only catalogs. Empty results now explain the missing packages; failed reads retain retry/error notices. A source game metadata refresh failure cannot silently become a successful empty state.
- Added TH/ID/other-game fixtures: zone and search filters combine correctly and unrelated game packages stay out of the list. Supported-game image checks require visible loaded image pixels; unknown games retain the SVG fallback in cards and details.
- A fresh independent review found one Important issue involving cached source-game metadata. Its regression failed before repair and passed afterward, followed by the green 59/59 browser suite. No Critical or Minor findings were reported. The review deferred the full-suite outcome to the executor; the final suite result above resolves that check.
- Local visual samples for the empty source catalog and selected ID zone were inspected. The loopback-only design preview is available at `http://localhost:3103/preview` while its process runs, with a separate in-memory database, fake owner credentials and no Telegram or supplier transport. Restarting resets the sample data.
- This continuation did not import the repository snapshot into the live database or restart/deploy the production services. The remaining physical Telegram acceptance still requires the separate test endpoint/bot described in the Mobile plan.

## Pending physical-device checks

Owner reported on 2026-11-24: Mini App opens on iPhone; send control, back navigation and slip viewer work. This is user-reported physical-device evidence. Exact model, iOS and Telegram versions were not supplied. It does not establish message delivery or status parity.

Owner subsequently confirmed the iPhone offline/reconnect scenario: the draft remains and chat returns after restoring connectivity. This completes that physical-device check; it does not establish retry delivery semantics for a message sent while offline.

Remaining checks:

- Session reopening after expiration.
- Web/Telegram status parity on an agreed MOCK order.

Owner confirmed portrait/landscape checks on iPhone: send/status controls and text remain visible and usable in chat and orders. Device model and OS version remain unspecified.

Live parity handoff selected existing MOCK Player 1 order `76043ad713`. Owner reports matching processing status in Telegram and Mini App. Independent database check found the record completed at revision 7, with audit entries for reopen followed by complete, both attributed to `miniapp` (2026-11-24 05:16:40/42 UTC). The observed record therefore supports Mini App reopen/complete but does not independently confirm a live Telegram callback. Clarification of which surface was used is pending; this live callback acceptance remains open. No live status mutation was performed by the agent. Direct control of the owner's open Telegram tab was unavailable due to a computer-use runtime failure.

Chromium emulation does not verify the remaining physical-device items.

## Rollback and availability

The PC, Docker, Internet and Cloudflare connector must remain running. Launchers are not Windows services. Preserve `.env`, PostgreSQL volume, receipts and encrypted backups. Secrets never belong in Git.

Code rollback target before this implementation: d65fc6f. In an isolated checkout, install locked dependencies and rebuild that revision; stop only the verified API process, then start its backend and UI together against preserved storage. No schema changes were introduced in this implementation. Do not restore scratch queues to production.

Isolated rollback rehearsal passed on 2026-11-24: exported d65fc6f without changing the active checkout; dependency lock matched; prior backend/UI rebuilt successfully. Prior server booted against restored scratch data with workers disabled and returned health ok. Because disabling Telegram also disables admin registration in the normal server, its compiled app was additionally started with a fake owner configuration and no transport workers on loopback port 3102. The prior UI bundle returned 200 and anonymous admin access returned 401. The rehearsal process was stopped; live port 3000 remained healthy. This verifies rebuilding and booting the previous app/data together; an actual production process swap was not performed.

## Implementation decisions

- Continued in the previously authorized main workspace to keep local trial configuration; explicit staging avoids unrelated files. Cost: concurrent edits require careful dirty-file checks.
- Retained supported manual-owner contracts instead of sample automation, analytics, team auth or unverified games. Cost: prototype-only modules remain unavailable until their contracts exist.
- Unsaved manual→LFX selection has no authoritative LFX rate in the current FX DTO. Calculator requests saving/reloading that mode before showing a result. Cost: one save step before that preview.
- Original review deferred only physical Telegram device behavior; it remains a release acceptance gate. No deferred Minor code findings.
