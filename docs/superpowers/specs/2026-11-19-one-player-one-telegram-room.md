# One player account, one Telegram topic for orders and chat

User selected one shared topic per player, superseding the earlier General-only order delivery rule. Use the owning customer account from the order record to locate its permanent room. Send new orders, receipts, status notices and view-order results to that same Telegram topic. Keep account details in the topic and retain the existing customer-details button on both order cards and customer messages.

Reuse existing topic creation coordination for order-first customers as well as chat-first customers. Do not infer ownership from a player UID or mutable notification payload. When customer chat mode is enabled, orders without a verified owning account remain queued; they must not fall back to General. Legacy standalone service mode without customer chat retains its existing destination.

Telegram order status controls still write internal audit entries and the order status only; customer-visible chat contains actual conversation messages. General chat is never relayed. Existing Telegram messages are preserved; resend the latest three-player mock batch into the respective rooms to demonstrate routing.

Validation covers order/receipt/status topic delivery, old General-card view routing, missing customer ownership, topic reuse, callback authorization, and customer chat separation.

Verified: full suite 30 passed; typecheck/build passed. Runtime configuration now points to @SquidfirstBot (a different bot from the original setup). Enabled Threaded Mode on the configured bot and backed up the previous mock topic mappings in ignored data/mock-room-bot-migration.json before creating its three player topics. Resent the existing batch without creating new orders. Visually verified each player's own order/bill and mock conversation in that player's topic. Both order and chat deliveries are sent for all three players; API health is 200. Evidence: evidence/player-orders-and-chat-shared-room.jpg. Existing Telegram messages and stored customer history were preserved.
