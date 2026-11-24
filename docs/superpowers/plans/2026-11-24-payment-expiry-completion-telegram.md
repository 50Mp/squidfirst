# Payment Expiry and Completion-Only Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cancel unpaid orders after 15 minutes and send order notifications to Telegram only when fulfillment completes.

**Architecture:** `OrderService` owns the transactional expiry and outbox rules. A small abortable maintenance loop invokes expiry immediately at startup and every five seconds. Telegram delivery remains durable through the existing outbox, but only a `completed` transition may enqueue an order card.

**Tech Stack:** TypeScript, Node.js timers, PostgreSQL/PGlite, Fastify, Node test runner, existing Telegram outbox.

**Spec:** `docs/superpowers/specs/2026-11-24-payment-expiry-completion-telegram.md`

## Global Constraints

- Expiry is exactly 15 minutes from `created_at` while status remains `awaiting_payment`.
- Use row locks and transactions; do not add an in-memory per-order timer.
- Do not delete already-sent Telegram messages.
- Do not enqueue Telegram jobs for any status except `completed`.
- Preserve customer-visible order status and the existing admin workflow.

## Review Focus

- Receipt and expiry racing for the same order: exactly one transition wins.
- Restart after an order is already older than 15 minutes: startup sweep cancels it.
- Duplicate completion callbacks: one idempotent completion job/card.
- Reopen then complete: no Telegram processing notification; recompletion updates the existing completed card.
- Old pending order/receipt/status jobs: suppress without touching sent deliveries or customer chat jobs.

---

### Task 1: Transactional payment expiry

**Files:**
- Modify: `src/orders.ts`
- Create: `tests/order-expiry.test.ts`

**Interfaces:**
- Produces: `OrderService.expireAwaitingPayment(now?: Date): Promise<string[]>`
- Consumes: existing `orders`, `order_messages`, row locks and revision semantics.

- [ ] **Step 1: Write failing boundary and race tests** for 14:59, exactly 15:00, receipt-before-expiry and expiry-before-receipt.
- [ ] **Step 2: Run** `node --import tsx --test tests/order-expiry.test.ts` and confirm failure because the method does not exist.
- [ ] **Step 3: Implement** `expireAwaitingPayment(now = new Date())` using one transaction, `FOR UPDATE SKIP LOCKED`, `cancelled`, revision increment and internal status messages.
- [ ] **Step 4: Re-run the focused test** and confirm all expiry cases pass with no Telegram jobs.
- [ ] **Step 5: Commit** the transactional expiry slice.

### Task 2: Abortable startup and interval sweep

**Files:**
- Create: `src/order-maintenance.ts`
- Create: `tests/order-maintenance.test.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `OrderService.expireAwaitingPayment(now?)` from Task 1.
- Produces: `runOrderMaintenance(service, signal, intervalMs?: number): Promise<void>`.

- [ ] **Step 1: Write a failing maintenance test** proving immediate invocation, repeated invocation and abort without a dangling timer.
- [ ] **Step 2: Run the focused test** and confirm failure because the runner does not exist.
- [ ] **Step 3: Implement the maintenance loop** with an immediate sweep and an abortable five-second delay.
- [ ] **Step 4: Wire it into server startup/shutdown** independently of Telegram configuration.
- [ ] **Step 5: Re-run focused tests** and commit the worker slice.

### Task 3: Completion-only Telegram outbox

**Files:**
- Modify: `src/orders.ts`
- Modify: `tests/orders.test.ts`
- Modify: `tests/admin-channel-parity.test.ts`
- Create: `tests/order-notifications.test.ts`

**Interfaces:**
- Consumes: existing `enqueue`, action idempotency and `telegram_outbox` claim/delivery.
- Produces: only `status:{status:'completed'}` order jobs; startup suppression of unsent non-completion jobs.

- [ ] **Step 1: Write failing outbox tests** proving create, receipt and all non-completion actions queue nothing while completion queues one job.
- [ ] **Step 2: Add failing migration coverage** proving old unsent non-completion jobs become `suppressed` and sent jobs are unchanged.
- [ ] **Step 3: Run focused tests** and confirm expected failures against current enqueue behavior.
- [ ] **Step 4: Remove non-completion enqueue calls**, enqueue only after a successful `completed` transition and suppress legacy unsent jobs during initialization.
- [ ] **Step 5: Re-run focused tests** and commit the notification slice.

### Task 4: Release verification and production activation

**Files:**
- Modify: `docs/release/admin-v1-acceptance.md`

**Interfaces:**
- Consumes: Tasks 1–3 and the existing production runtime.
- Produces: same-version build/runtime evidence and recorded acceptance results.

- [ ] **Step 1: Run** `npm test`, `npm run check`, `npm run check:admin`, `npm run build` and relevant Playwright suites.
- [ ] **Step 2: Build and restart the API** with the existing `.env`, without changing `ORDERS_ENABLED=false`.
- [ ] **Step 3: Verify** `/health`, automatic cancellation of overdue seeded orders, no new Telegram delivery for cancellations, and no pending non-completion outbox jobs.
- [ ] **Step 4: Record evidence** in the release acceptance document and commit it.
