# Manual orders and private-admin Telegram bridge

Confirmed: customers order and chat through the store website; a private Telegram chat receives admin work; admin manually checks uploaded payment receipts, fulfills games and updates statuses. Customer replies must never include internal notes, suppliers or costs. Work here adds the server interfaces; the storefront UI and live Telegram credentials are separate required integration steps, not claimed implemented by these APIs.

Use curated published products with explicit verified zone and reviewed equivalent supplier offer IDs. Reject unspecified zones. Choose the lowest active LAK offer from that reviewed set; snapshot supplier, FX and retail price when creating the order. Default markup 10%, editable per product, server-calculated with integer arithmetic. Original catalog APIs are internal and require API_KEY in the runtime; public /shop routes expose only product/retail details.

Order access is a client-generated random bearer token whose hash is stored. Require an idempotency key and reject replay with different request/owner. Receipt uploads accept JPEG/PNG/PDF bytes, maximum 5MB, private storage and authenticated retrieval. Order/chat/payment actions work all day; ingestion's 15–16 schedule remains unchanged.

Persist orders, public/internal messages, receipts and Telegram outbox transactionally. Only explicit /reply commands send public messages; /note stays internal. Authorize exact private chat and exact Telegram sender ID. Deduplicate Telegram updates and callbacks. Fulfillment completion requires confirmed payment. Delivery retries may repeat notifications after an ambiguous network failure; order IDs remain stable. Customers poll public order/message APIs.

Telegram adapter uses Bot API long polling (no public tunnel needed locally), optional explicit TELEGRAM_ENABLED flag, bot token and positive private admin chat/user IDs. No live sends until configured. Dedicated bot required; do not reset existing webhooks automatically. Keep credential/body redaction; never include order bearer tokens in Telegram or public responses. Public shop exposes no raw catalog offer IDs.
