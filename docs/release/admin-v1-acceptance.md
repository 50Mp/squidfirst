# Admin V1 trial acceptance

Updated 2026-11-24 (Asia/Bangkok). Scope: Tasks 1–4 of the approved Stitch implementation plan. Tasks 5–7 remain later releases. **Trial running; initial iPhone usability confirmed by owner; remaining acceptance checks pending. Not a production-readiness sign-off.**

## Verified

- Current canonical screen/route/API mapping: [screen-route-matrix](../design/screen-route-matrix.md). Primary color #2563EB; existing owner/manual workflow retained.
- Backend tests 54/54 after adding channel parity coverage; browser baseline 44/44; TypeScript and production build passed. Browser fixture uses isolated data, no `.env`, supplier purchase or Telegram transport.
- Additional channel parity integration test passed: web approve/start/reopen and Telegram accept/complete callbacks share one MOCK record; callback replay preserves revision, formatted bot status matches the admin read, and status actions create no public customer chat messages. This tests callback processing, not live Telegram delivery.
- Browser reconnect acceptance rerun passed: offline/online transition drains paginated history before marking messages read. Physical iPhone reconnect results remain pending.
- Responsive checks at 360/390/768/1280/1440; composer at 360x450; receipt image modal, PDF download failure/retry; public/internal separation, per-customer drafts, search persistence, stale reads and recovery.
- Independent review of d65fc6f..d2057f7 found five Important issues. Each reproduced before repair: private draft visibility after remount; false empty chat on initial failure; lost queue filters; unsaved LFX showing manual arithmetic; typing during pending send losing a subsequent draft. All regression checks and final suites passed after the repair pass. No Critical or Minor findings reported.
- PostgreSQL Docker container healthy. Local API restarted with backend and UI from the same build; `/health` returned ok.
- HTTPS `/admin-app/` returned 200 and referenced `index-B-STL1lB.js`; anonymous `/admin/v1/me` returned 401; `/shop/products`, `/auth/register`, `/games` returned tunnel fallback 404. Owner/non-owner auth covered in fixture. Owner subsequently confirmed opening the Mini App on a real iPhone; no separate live auth trace was collected.
- Encrypted backup `255e72fa-af36-44cf-b8ee-7ad60ee71db3` restored to a new ignored scratch directory. All 22 business table counts matched, 11 receipt files readable, and both Telegram transport queues empty. Scratch recovery starts no workers. Existing unit tests also verify receipt content, wrong-key rejection and refusal to overwrite a destination.
- No new real payment, supplier order or automated Telegram QA message created during this acceptance run. Real checkout remains disabled in existing configuration.

## Pending physical-device checks

Owner reported on 2026-11-24: Mini App opens on iPhone; send control, back navigation and slip viewer work. This is user-reported physical-device evidence. Exact model, iOS and Telegram versions were not supplied. It does not establish message delivery or status parity.

Remaining checks:

- Session reopening after expiration.
- Explicit safe-area and keyboard behavior across orientations.
- Network loss/reconnect and Web/Telegram status parity on an agreed MOCK order.

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
