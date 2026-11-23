# Account-room correction implementation

Spec: ../specs/2026-11-18-customer-rooms.md

- [x] Reproduce public status events appearing as customer messages, then make them internal-only.
- [x] Implement account registration/login/opaque sessions and one unique room per account.
- [x] Bind production orders to account ownership across sessions; deprecate order-bound chat route.
- [x] Implement customer room messages, Telegram topic mapping and isolated plain-text admin replies; keep admin order controls in General.
- [x] Add private 📋 view-order control without customer chat side effects.
- [x] Test account/cookie origin isolation, session rotation, room reuse, message idempotency and topic separation; independent review.
- [x] Final suite/build, PostgreSQL rollback verification and runtime restart.
- [x] Enable private Threaded Mode in BotFather and verify live Bot API Topics capability. No live test account/topic/message created.

Verification: 23 tests pass; typecheck and build pass. Independent review found no important issues. PostgreSQL transaction verified account/session reuse, order ownership across logins, room privacy, internal notes/status events and topic mapping, then rolled back all test records. Runtime now uses Accounts/CustomerChat and rejects unauthenticated /chat. Admin room list is protected; zero accounts/rooms retained and 237 catalog packages unchanged. Live Bot getMe still reports has_topics_enabled=false, so customer topic delivery is pending the requested BotFather setting; worker waits rather than mixing customers into General. Customer UI and real order acceptance remain disabled/not built as previously documented.

Later setup completion: enabled **Threaded Mode** under **Threads Settings** in the BotFather Mini App for @squidfirst_orders_bot. Live getMe now reports has_topics_enabled=true. Screenshot: evidence/telegram-threaded-mode-enabled.jpg. Other bot modes/permissions were not changed. No customer messages or test topics were created. On resuming after the limit reset, Docker Desktop and the local API were stopped; restart uses the existing Compose service and volume.

Runtime restoration verified: Docker startup failed on an inaccessible stale Secrets Engine socket. Preserved its directory (containing only engine.sock) under a timestamped backup name; Docker Desktop then started successfully. Existing squid-first-db-1 is healthy and API /health returns 200. Database still contains 237 packages; unauthenticated /chat returns 401; authenticated admin room list is empty. Read-only live getMe confirms has_topics_enabled=true. The earlier false capability result above is superseded. No ingestion was run outside the configured window, and no Telegram messages or customer topics were created during verification.
