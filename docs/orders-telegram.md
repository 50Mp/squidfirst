# Squid first — manual orders and Telegram

Current routing (2026-11-19): one customer account has one Telegram topic containing that customer's orders, bills, status notices and conversation. This supersedes earlier General-only order routing described below. View-order results also return to the owning customer's topic. Website customer chat still contains only conversation; order controls never become customer chat bubbles. Existing unowned orders remain queued in account mode rather than falling back to General.

Current order cards: buttons are filtered by order state and payment verification. Status and view-order refreshes edit the canonical card, rather than posting another status card. New receipt media replaces/adds media in that same message. Canonical identities persist in telegram_order_cards, keyed by bot and order, and are revalidated against the current player topic. A definitely deleted message can be replaced; other edit failures stay queued. Old duplicate messages are preserved; stale buttons still pass transactional status validation.

Backend support for a customer website with a private-admin Telegram inbox. **One logged-in customer account = one persistent chat room, independent of its orders.** Admin order controls update website order state and never create customer chat bubbles. The UI is not built yet; there is no live checkout/chat page. No unverified or unspecified-zone products are published automatically. Raw supplier APIs are internal and require API_KEY; customer integrations use /auth, /shop, /orders and /chat only.

## Runtime configuration

Keep credentials in ignored .env. TELEGRAM_API_TOKEN_BOT is supported (TELEGRAM_BOT_TOKEN is a fallback alias). Never embed either bot token or API_KEY in the customer browser.

```dotenv
API_KEY=your-long-random-admin-secret
TELEGRAM_API_TOKEN_BOT=your-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-positive-private-chat-id
TELEGRAM_ADMIN_USER_ID=the-same-private-user-id
TELEGRAM_ENABLED=true
ORDERS_ENABLED=false
```

Use a dedicated bot and only one polling process per bot. A private admin must have pressed Start. The one-time local setup helper scripts/link-telegram.ts binds only a /start challenge from a private chat whose sender matches the chat ID. It does not send messages or delete webhooks. The token was validated and the user's private chat linked in this session; actual identifiers are not documented or printed.

ORDERS_ENABLED stays false until products, payment instructions and the customer storefront are ready. Enabling it also requires complete Telegram configuration. Bot polling/notifications and customer accounts/chat run all day; only price/FX collection is restricted to 15:00–16:00. Restart npm start after .env changes. A running Node process and network connection are required; machine reboot does not automatically start Node yet.

Enable private-chat Topics for this bot through BotFather. The worker checks the bot capability every minute. Each customer room maps to exactly one topic in the admin's private bot chat, created lazily on its first customer message. Topics disabled: messages remain queued; there is no fallback that mixes customers in General. Ambiguous topic creation failures mark the room needs_attention instead of blindly creating a duplicate. GET /admin/chat-rooms shows room/topic state for investigation. A bot change or unresolved topic creation requires manual mapping review before resuming that room.

## Publish reviewed products (admin only)

POST /admin/products, header x-api-key. JSON example (offer IDs come from internal catalog API):

```json
{
  "name": "Free Fire 33 Diamonds",
  "game_id": "free-fire",
  "zone": "th",
  "offer_ids": ["reviewed-source-package-id"],
  "markup_bps": 1000,
  "confirmed_equivalent": true
}
```

The admin explicitly confirms that these are equivalent packages with the same region, quantity, bonuses and conditions. Every offer must currently be active and its stored game/zone must match. Unspecified zones are rejected. Mapping does not infer region from a player Zone ID. Lowest active supported LAK cost from this reviewed set is used; default 1000 basis points = 10% markup. Selling price is computed from the unrounded LAK/FX amount, rounded upward to whole USD cents. Payment fees and minimum profit rules are not configured yet; 10% markup is not a guarantee of net profit.

GET /shop/products is public and returns only published product IDs, game, zone, customer price and required player fields. It does not expose supplier IDs, supplier URLs, cost or margin. Products without an eligible supplier or FX quote are hidden. Internal /games, /sources and /exchange-rates routes require API_KEY in the runtime.

## Customer API

Customers register with POST /auth/register or log in with POST /auth/login using JSON {"username":"customer_name","password":"a password of at least 12 characters"}. Usernames are 3–30 ASCII letters/digits/underscores and case-insensitive. Passwords use salted scrypt. The response sets an HttpOnly, SameSite=Lax session cookie; NODE_ENV=production adds Secure and requires HTTPS. GET /auth/me returns the account/room; POST /auth/logout revokes only that session. Sessions expire after 30 days. No email, email verification, password recovery or login UI is implemented yet.

The same customer account returns to the same room/order history after login on another device. Cross-account access is rejected. Browser writes must come from PUBLIC_ORIGIN (default http://127.0.0.1:3000), including an Origin header with cookie authentication; no wildcard CORS is enabled. Non-browser integrations can use the opaque authenticated session token as Bearer but should never expose admin API_KEY or bot token.

Create order with POST /orders from the authenticated customer session, also sending a unique 16–100 character Idempotency-Key and JSON:

```json
{"product_id":"published-product-id","player":{"UID":"123456"}}
```

Mobile Legends also requires "Zone ID" as a separate field. Same idempotency key with a different customer or payload returns conflict. Repeating an identical request returns the same order even after logging in again. Orders belong to the customer account, not to the particular session or chat message. Old standalone token behavior remains only for isolated compatibility tests; production wires Accounts and rejects anonymous tokens.

| Method/path | Purpose |
|---|---|
| GET /orders/:id | Public order snapshot, status and receipt metadata; no chat transcript |
| GET /chat?after=0 | Own account's persistent room and public messages; next_cursor for polling |
| POST /chat/messages | JSON {"text":"message","client_message_id":"unique-client-id"}; accepted durably before Telegram delivery |
| POST /orders/:id/messages | Returns 410 in production; use the account's /chat instead |
| POST /orders/:id/receipts | Raw PNG/JPEG/PDF bytes with matching Content-Type, at most 5MB |
| GET /orders/:id/receipts/:fileId | Authenticated receipt download; no public file URL |

Order creation snapshots retail price, player and zone separately from private supplier/cost/FX data. Prices do not change on an existing order when the source catalog changes. The UI polls /orders/:id for state and /chat separately for conversation. State transitions are internal audit entries, never chat messages. Chat returns up to 200 messages after a supplied cursor; client message IDs prevent accidental duplicate posts. Clients must render chat messages as text, not HTML. Receipt bytes have signature/MIME checks and are stored under data/order-files with generated names; they are not parsed/executed. These files must be included in production backups separately from PostgreSQL.

Public write routes have per-process/IP rate limits; customer messages are also bounded per order. For multiple API instances, add a shared rate-limit store at deployment. Product listing currently returns at most 200 published products; pagination is not implemented yet.

## Admin Telegram controls

- New order: supplier and cost are shown privately to the authorized admin only.
- New receipt: document is sent to admin; submitting it changes status to payment_review, never automatically confirms payment.
- Confirm received payment: moves payment_review → paid and records payment_verified.
- 📥 รับงาน: moves paid → accepted, only after payment confirmation.
- ⏳ กำลังเติม: moves accepted → processing. Complete remains unavailable until processing.
- Complete: allowed only from processing after payment confirmation.
- ↩️ กลับไปกำลังเติม: completed → processing to correct a mistaken completion. Requires payment verification, keeps the payment record, and cannot reopen refunded/cancelled orders. The control appears on completed order cards; the change is internal order history, not a customer chat message.
- Issue / resume / cancel / refund controls validate the current state. "คืนเงินจริงแล้ว" records a manual refund already performed; it does not transfer money. Do not click until repayment actually occurred.
- 📋 ดูออเดอร์ displays private details to the admin; it does not post in customer chat or change status.
- Inside a mapped customer topic, ordinary admin text goes only to that customer's website chat. No /reply command is needed.
- Inside that topic, /note <text> stores an internal note and never reaches the customer.
- General Telegram conversation is ignored. General supports /note <order UUID> <text> for private order notes; order-linked /reply is not used in production.
- Order cards, receipts and status-control notifications stay in General, separate from customer discussion topics. Customer does not see admin controls, supplier details or internal notes.

Only the configured private chat AND configured sender are accepted, even if another person knows an order ID. Updates/callbacks are deduplicated; ownership tokens never go to Telegram. Outbox delivery is retried; an ambiguous Telegram timeout may result in a repeated notification with the same order ID. At most 10 attempts, then failed. GET /admin/telegram/outbox and GET /admin/orders/:id require API_KEY for investigation; there is no retry UI yet. Notification delivery is not exactly-once.

Pending/unconfirmed orders can be cancelled. Verified payments require a refund workflow rather than marking unpaid cancellation. Payment verification, fulfillment and refund are manual admin actions; no supplier purchase API, bank integration or automated refund is implemented.

## Verification

Tests use local/in-memory databases and simulated Telegram updates: ownership and source isolation, verified zone selection, price snapshots, idempotency, receipt download ownership, internal/public messages, callback rules and update replay. Live messaging should be tested with a clearly marked test order only after the admin and storefront are ready. No real customer order or Telegram test notification was created by setup.

References: [Telegram Bot API](https://core.telegram.org/bots/api), [privacy-mode reply delivery](https://core.telegram.org/bots/faq#what-messages-will-my-bot-get).
