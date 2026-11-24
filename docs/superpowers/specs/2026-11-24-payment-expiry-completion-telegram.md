# Payment Expiry and Completion-Only Telegram Spec

## Approved behavior

- A new order remains `awaiting_payment` for 15 minutes from `orders.created_at`.
- At exactly 15 minutes, an order still in `awaiting_payment` becomes `cancelled` automatically.
- A receipt accepted before the expiry transition moves the order to `payment_review` and prevents automatic cancellation.
- Receipt submission and expiry must lock the same order row so only one transition wins.
- `awaiting_payment` remains visible in the admin application and customer order status. It is not delivered to Telegram.
- Order creation, receipt upload, payment approval, acceptance, processing, issue, resume, reopen, cancellation and refund do not create Telegram order notifications.
- Transition to `completed` queues the order card for Telegram. Idempotency prevents duplicate deliveries; completing again after a reopen updates the saved card.
- Existing unsent non-completion order jobs are suppressed on startup. Messages already sent to Telegram are not deleted.
- The expiry worker runs immediately after server startup and then at most five seconds apart until shutdown.

## Safety and persistence

- Automatic cancellation increments `revision` and writes an internal system status message.
- Automatic cancellation never marks payment verified, never refunds money and never queues Telegram delivery.
- Expiry is based on database timestamps and works after process restarts.
- The currently seeded real orders are allowed to expire under the same rule; no special-case production mutation is added.

## Acceptance

- Deterministic tests cover 14:59, exactly 15:00, receipt-before-expiry, expiry-before-receipt, restart sweep and Telegram outbox gating.
- Backend typecheck, all backend tests, relevant browser tests, production build and health checks pass before release.
