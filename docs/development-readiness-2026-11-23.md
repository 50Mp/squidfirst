# Squid first — Development readiness review
Date: 2026-11-23 (Asia/Bangkok)

## Decision
Ready to develop the four core admin menus incrementally. The complete Stitch collection is not yet an implementation-ready release specification. This review examined local source, tests, and saved Stitch handoff artifacts; it did not visually re-audit every live Stitch screen or exercise production services.

## Existing foundation
- React/Vite admin with overview, orders, customer chat/profile, sources, FX, games/zones, products/pricing, settings, audit, backups.
- Telegram owner authentication, CSRF/Origin checks, revision conflicts and idempotent operations.
- Existing order/chat/Telegram service integration and recovery tests.
- Source/LFX collection window 15:00 <= time < 16:00 UTC+7 and manual rate mode.
- Four canonical Mobile entry screens recorded in docs/stitch-mobile-completeness-2026-11-23.md.
- Desktop and Mobile canvas areas are separated; broken custom group frames were removed. Actual browser visibility still requires user confirmation.

## Gaps to resolve before implementing the corresponding flow
1. Refunds (high priority): src/orders.ts currently changes a valid refund action directly to refunded. Stitch proposes pending refund followed by completed refund with reference, transfer time and attachment. Add server states, validation, evidence storage, audit and Telegram behavior together before shipping that UI.
2. Currency and financial reporting (high priority): existing API reports USD and order-created-at cohort estimated gross profit. Stitch examples use THB with fees, promotions, net profit and ledger vouchers. Keep USD as the established selling currency; define any THB display conversion and stored rate before adding the reports. Do not relabel existing gross profit as net profit.
3. Canonical handoff: map each intended route/dialog/state to one approved screen ID per device and the same API contract. The 168 visible canvas screens include variants, states and documents rather than 168 distinct required production pages.
4. Multi-admin: database types mention operator but login and session checks explicitly accept only the configured owner. Team invitations, permissions, assignments and collision handling remain future implementation.
5. Design alignment: the application imports light.css, which still uses #0000FF, while the approved latest Stitch primary is #2563EB. Align tokens and implement both mobile and desktop layouts from selected canonical references.
6. Additional modules: current App routes do not expose promotion/campaign administration, full ledger/vouchers, or finance/chat export flows. Define their storage/API behavior before connecting visual actions.
7. Games: current UI explicitly keeps PUBG Mobile and Roblox pending source package/zone/top-up verification.

## Verification performed
- npm run check: passed.
- npm run check:admin: passed.
- npm run build: passed.
- npm test: 49 passed, 1 failed (admin-auth).
- Focused rerun: node --import tsx --test tests/admin-auth.test.ts passed.
- Likely test timing collision: signed() derives query_id only from user ID and second-resolution date; the second login uses current second minus one and may duplicate the earlier login when the test crosses a second. The replay protection correctly rejects duplicate input. This hypothesis needs deterministic clock/unique test data verification; no production auth fix was made.
- No live Telegram, bank transfer, supplier order, production database migration, PostgreSQL integration check, or browser end-to-end suite was run in this review.

## Recommended development order
1. Confirm canonical route/state-to-screen mapping and shared #2563EB tokens.
2. Implement the four core menus on the current APIs, with mobile and desktop acceptance checks.
3. Implement pending-refund/evidence server contract, UI and Telegram parity.
4. Add properly defined financial reporting and exports.
5. Add multi-admin and other optional modules after the owner-only workflow is accepted.

## Release gate
All automated checks must pass deterministically. Verify the same mock order from payment review to completion/reopen/issue/refund and customer chat on both admin web and Telegram; confirm unauthorized access denied, backups recover in isolation, sources/FX obey the time window, and production/mock data stay separate.
