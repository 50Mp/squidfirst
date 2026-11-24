# Admin V1 trial acceptance

Updated 2026-11-24 (Asia/Bangkok). Scope: Tasks 1–4 of the approved Stitch implementation plan. Tasks 5–7 remain later releases. **Trial running; physical iPhone acceptance pending. Not a production-readiness sign-off.**

## Verified

- Current canonical screen/route/API mapping: [screen-route-matrix](../design/screen-route-matrix.md). Primary color #2563EB; existing owner/manual workflow retained.
- Backend tests 53/53; browser tests 44/44; TypeScript and production build passed. Browser fixture uses isolated data, no `.env`, supplier purchase or Telegram transport.
- Responsive checks at 360/390/768/1280/1440; composer at 360x450; receipt image modal, PDF download failure/retry; public/internal separation, per-customer drafts, search persistence, stale reads and recovery.
- Independent review of d65fc6f..d2057f7 found five Important issues. Each reproduced before repair: private draft visibility after remount; false empty chat on initial failure; lost queue filters; unsaved LFX showing manual arithmetic; typing during pending send losing a subsequent draft. All regression checks and final suites passed after the repair pass. No Critical or Minor findings reported.
- PostgreSQL Docker container healthy. Local API restarted with backend and UI from the same build; `/health` returned ok.
- HTTPS `/admin-app/` returned 200 and referenced `index-B-STL1lB.js`; anonymous `/admin/v1/me` returned 401; `/shop/products`, `/auth/register`, `/games` returned tunnel fallback 404. Owner/non-owner auth covered in fixture; live signed Telegram owner bootstrap awaits phone test.
- Encrypted backup `255e72fa-af36-44cf-b8ee-7ad60ee71db3` restored to a new ignored scratch directory. All 22 business table counts matched, 11 receipt files readable, and both Telegram transport queues empty. Scratch recovery starts no workers. Existing unit tests also verify receipt content, wrong-key rejection and refusal to overwrite a destination.
- No new real payment, supplier order or automated Telegram QA message created during this acceptance run. Real checkout remains disabled in existing configuration.

## Pending physical-device checks

Owner selected iPhone. Record actual model, iOS and Telegram version and results before acceptance:

- Real Telegram initData/session and reopening after expiration.
- Keyboard, safe areas, send control, back navigation, slip viewer.
- Network loss/reconnect and Web/Telegram status parity on an agreed MOCK order.

Chromium emulation does not verify these items. User handoff requested; results not yet supplied.

## Rollback and availability

The PC, Docker, Internet and Cloudflare connector must remain running. Launchers are not Windows services. Preserve `.env`, PostgreSQL volume, receipts and encrypted backups. Secrets never belong in Git.

Code rollback target before this implementation: d65fc6f. In an isolated checkout, install locked dependencies and rebuild that revision; stop only the verified API process, then start its backend and UI together against preserved storage. No schema changes were introduced in this implementation. Do not restore scratch queues to production. A full application rollback rehearsal is **not yet verified**; scratch data recovery is verified separately.

## Implementation decisions

- Continued in the previously authorized main workspace to keep local trial configuration; explicit staging avoids unrelated files. Cost: concurrent edits require careful dirty-file checks.
- Retained supported manual-owner contracts instead of sample automation, analytics, team auth or unverified games. Cost: prototype-only modules remain unavailable until their contracts exist.
- Unsaved manual→LFX selection has no authoritative LFX rate in the current FX DTO. Calculator requests saving/reloading that mode before showing a result. Cost: one save step before that preview.
- Original review deferred only physical Telegram device behavior; it remains a release acceptance gate. No deferred Minor code findings.
