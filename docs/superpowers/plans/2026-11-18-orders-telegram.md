# Orders and Telegram implementation plan

Spec: ../specs/2026-11-18-orders-telegram.md

- [x] Failing tests: curated zone checks, pricing snapshots, ownership, idempotency, private notes and payment transitions.
- [x] orders.ts: schema and transactional service, bounded public queries and private receipt metadata.
- [x] order-routes.ts: private admin publishing and customer product/order/chat/receipt API.
- [x] telegram.ts: authorized commands/callback processing, durable outbox and polling adapter; simulated outbound transport tests.
- [x] Integrate optional worker into server, configure environment, document routes and setup. User supplied TELEGRAM_API_TOKEN_BOT and completed the one-time private /start challenge; credentials never printed.
- [x] Run suite/typecheck/build, independent review, PostgreSQL migration and HTTP checks. Report storefront/live Telegram limitations plainly.

Verification: 21 tests pass; typecheck and build pass. Independent review identified expired callback acknowledgements blocking the cursor; regression reproduced and fixed. Additional regression reproduced database failure during failure-recording crashing the delivery worker; fixed. PostgreSQL transaction tested actual pricing, idempotency, receipts, payment confirmation/completion and outbox-to-order mapping, then rolled back all test data. API restarted, internal routes require API_KEY, public shop route is available, checkout returns 503 with ORDERS_ENABLED=false. Bot's live authenticated update cursor persisted after receiving the admin Start event. Zero orders/outbound deliveries remain; no Telegram test notification sent. Catalog retains 237 packages. Customer storefront/checkout/chat UI, published reviewed product mappings and payment instructions are still not implemented/configured and real order creation remains disabled.
