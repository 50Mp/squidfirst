# Admin UX continuity — 23 November 2026

## Delivered behavior

1. Order-list return preserves status, submitted search, MOCK filter, cursor page and in-tab scroll/focus. Details carry an internal `return_to` route, so reloading a detail preserves its return filter/page. Browser Back and the visible Back button both work. Scroll positions and unsent chat text are not persisted across a full page reload.
2. Active order states have one primary next action, selected from the server's allowed actions: approve, accept, start, complete or resume. Issue and reopen are secondary; cancel/refund sit under **การดำเนินการอื่น** and retain confirmation and revision/idempotency safeguards. No automatic supplier purchase or bank refund is introduced.
3. `GET /admin/v1/navigation` returns global pending real review orders, unread customer rooms and unread messages for the authenticated reader. Counts are independent of list pagination. The order badge excludes MOCK; the chat badge counts rooms. Polling pauses in background with existing event polling, and a room-read refreshes badges immediately. Failed counts retain a stale marker; an unknown/stale zero displays `?`.
4. Admin chat shows up to three issue-order shortcuts scoped by that exact customer ID. The profile link provides the rest. An order opened here returns to the same room and its in-tab unsent draft. No order ID is appended to customer chat messages, and admin status actions remain separate from conversation text.
5. At viewport widths >=1200px, Orders uses independently scrollable list/detail panes, visible selection and a detail placeholder. Narrower screens show only the current list or full detail. Existing fullscreen chat and composer sizing are retained, including a 360x450 viewport with issue context visible.

## Verification scope

- TypeScript/backend and admin checks; production Vite build.
- Backend aggregate regression includes >100 customer rooms, reader-specific read positions, public/customer message filtering and MOCK exclusion. HTTP tests deny anonymous navigation reads.
- Browser cases cover mobile browser Back, explicit Back, reloaded-detail filters, desktop live pane scroll, one primary action, stale positive/zero badges, and actual chat-to-issue-order-to-chat navigation with retained draft.
- Existing status/slip, authentication, reconnect, internal notes, source/FX, product conflicts, responsive layout, pinch and pull-refresh regressions remain in the suite.
- Independent review identified reload-context, live-pane-scroll and stale-zero issues; targeted fixes were confirmed by the reviewer.

This source delivery does not restart production services, run live payments/supplier transactions, send real Telegram messages or change owner permissions. The backend must be upgraded with the UI for the new authenticated navigation endpoint.

## Read-failure follow-up

FX settings are hidden when their initial read fails. Cached settings remain visible but their controls, preview and save are unavailable during loading or after a failed refresh; retry retains the unsaved draft. The rate-history section also distinguishes failed/unfinished reads from a confirmed empty history.

Customer order history now shows loading or a retryable read error instead of claiming there are no orders. An empty history is rendered only after a successful response. Three browser regression cases cover initial FX failure/recovery, cached FX failure with retained draft, and customer-history failure/recovery. No backend contract changed in this follow-up.
