# Squid first core admin implementation

The four approved main menus now use a shared white/#2563EB theme, mobile bottom navigation and a desktop sidebar. Data and mutations use the existing authenticated API. This delivery updates source and build artifacts locally; it does not authorize bank transfers, supplier purchases or new Telegram messages.

## Screen mapping

| Route | Mobile Stitch screen | Web reference |
| --- | --- | --- |
| `/` | `286614df1ad24d4596786fa3d4082396` | `00a6d2a9779844fca89ae475255fec62` |
| `/orders` | `beb71683567a44ff810445ed3f11e741` | `413f4a34e6c54a75b6272e9d2aecadca` |
| `/chats` | `62738ab1d11d4ed389259548d612189d` | `9753ce991f9d4511b53cf91c4e4aa895` |
| `/store` | `d7fa95f30ae54fb785c5df37da66b0b5` | Responsive adaptation of the same store hub |

The implementation adapts the selected layouts to supported API behavior. Sample automatic fulfillment, batch finance actions, THB analytics, promotions, VIP/customer lifetime value, latency statistics and additional games are not presented as live capabilities.

## Behavior

- Overview: manual slip-review priority, USD sales/completed orders, estimated gross profit, actionable status queues, unread customer rooms and management shortcuts.
- Orders: URL-preserved status/search/MOCK selection, readable cards, game zone, selectable/copyable UID, existing detail/slip workflow and cursor pagination. Copy failure keeps the UID visible for manual copying.
- Chats: customer search, unread filter, room counts based on the returned search results, account cards, direct chat/profile access. Existing fullscreen conversation, internal notes, Enter/Shift+Enter, draft retention and reconnect history remain intact.
- Store: actual enabled source count, selected manual/LFX rate and timestamp, stale LFX warning, ingestion window, grouped links to existing product/pricing/source/FX/game/payment/audit/backup screens. Screen refresh reads saved data; it does not bypass the ingestion window.
- Read failure: retry action, no successful-empty message until a read succeeds, and a notice when previous data remains displayed.

## API addition and regression

`GET /admin/v1/orders` accepts optional `active_only` and `include_mock` booleans. Omitted parameters preserve previous behavior. Both filters apply in SQL before cursor pagination. Overview separately fetches `status=payment_review&limit=1` (the newest review within that class), so terminal or MOCK records cannot hide a real pending review. The regression seeds 35 newer completed orders and one newer MOCK review above an older real review.

## Verification

TypeScript checks and production build pass. All 50 embedded-database/backend tests and 18 isolated browser tests pass. The browser acceptance suite covers the four routes at 360, 390, 768 and 1280px, UID clipboard behavior, filters, failed-read retry, order status/slip actions, owner access, fullscreen chat, reconnect, pinch handling and pull refresh. Local artifacts/logs are excluded from Git.

The auth test now generates independent query IDs while retaining deliberate replay rejection coverage. Unit test concurrency is bounded to two processes to avoid memory exhaustion from many simultaneous embedded PostgreSQL instances.

## Limits

Pending refund/evidence, full financial ledger/exports/promotions, team roles, PUBG and Roblox source verification remain the separate follow-up work listed in the readiness review. The current owner-only authentication and established manual refund action are preserved. Build/test verification does not establish live production payment, supplier, Telegram or database integration readiness.
