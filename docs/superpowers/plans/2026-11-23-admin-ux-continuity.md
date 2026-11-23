# Admin UX continuity implementation plan

User approved all five proposed improvements: restore order-list context, one primary next action, real notification badges, problematic-order context in chat, and desktop list/detail workspace.

## Decisions
- Keep React/Vite, hash routing, existing owner auth, USD, manual fulfillment and existing server-approved transitions.
- Remember order filter/search/cursor in the URL and scroll/focus in tab memory. No credentials or chat text go into storage. Returning from chat-linked order details goes back to that chat.
- Use one primary next action per active order state. Keep issue/reopen secondary; cancellation/refund remain behind a clearly labelled secondary disclosure and their existing confirmation.
- Aggregate review-order and unread-room counts on the server, independently of paginated lists. Review badge excludes MOCK; chat badge counts rooms, not messages. Failures show an unavailable/stale state rather than a false zero.
- Show only that customer's problematic orders in admin chat, with a link to the order and an independent profile link. Do not append IDs to chat messages or change customer-visible order text.
- Desktop >=1200px shows independently scrollable list/detail panes. Mobile uses the same data with full-screen drill-down and preserved return context.

## Tasks
- [x] Add server aggregate/read-isolation tests and browser tests for return context, primary action, live badges and linked issue orders.
- [x] Add navigation state helpers and responsive order workspace; preserve browser back and current receipt/order workflows.
- [x] Add primary-action component and true server badge aggregate.
- [x] Add per-customer issue context to chat without reducing composer visibility.
- [x] Run type checks/build, full backend and isolated browser suites; independent review and focused fixes.

Delivery target: commit and push only reviewed code to 50Mp/squidfirst main; exclude secrets/runtime artifacts. No production restart or real Telegram send is part of this work. Verify the published commit matches local HEAD.

Review findings fixed: reloaded-detail return context, desktop live pane scroll and visible stale-zero badge. The chat browser test now exercises an actual issue-order link. Backend suite: 51 passed. Browser suite: 23 cases, including a 360x450 chat with issue context.
