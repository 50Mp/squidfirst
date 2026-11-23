# Squid first — screen / route / API matrix

Baseline d65fc6f · 23 November 2026 · Stitch project 9946906478898127464.
Current metadata, HTML and screenshots for 11 canonical references were retrieved and visually inspected in this execution. Local source artifacts are under `.stitch/2026-11-23/phase-one-source/` and remain excluded from Git.

## First-release flow ownership

| Flow / device | Canonical screen | Route / component | API | States and next task |
| --- | --- | --- | --- | --- |
| Overview Mobile | 286614df1ad24d4596786fa3d4082396 | `/`, `screens/overview.tsx` | `/overview`, `/orders`, `/customers` | implemented; preserve urgent-first cards, USD gross-profit terminology and real counts; Task 2 visual acceptance |
| Overview Web | 00a6d2a9779844fca89ae475255fec62 | same route; responsive shell | same | needs visual alignment for supported cards; charts/net-profit/latency are backend gaps for later releases |
| Orders Mobile | beb71683567a44ff810445ed3f11e741 | `/orders`, `orders.tsx`, `components/order-card.tsx` | `/orders`, `/navigation` | implemented: loading/error/retry/empty, status/search/MOCK/cursor, UID copy; bulk execution later |
| Orders Web | 413f4a34e6c54a75b6272e9d2aecadca | `order-workspace.tsx` | same | implemented list/detail; maintain real USD/manual controls rather than fake automation |
| Order detail Mobile | a4ab4dde589b41b88d7bb488d0083bef | `/orders/:id`, `OrderDetail`, `order-actions.tsx` | `/orders/:id`, `/actions` | implemented; no VIP, validated IGN, auto-provider result or net margin without data |
| Slip Mobile | 0e7532b364404d7ca7d36022c80c8b61 | detail receipt panel, `receipts.tsx` | authenticated order receipt URL | manual review, image/PDF/open/close/error; OCR/SlipOK and auto top-up are later backend gaps |
| Chats Mobile | 62738ab1d11d4ed389259548d612189d | `/chats`, `chat-list.tsx`, `chat-card.tsx` | `/customers`, `/navigation` | implemented; unread means unread, not assigned/closed case; closed-case counts later |
| Conversation Mobile | b198eda757044b8abce15ef97b5d4a9e | `/chats/:id`, `chats.tsx` | `/chat`, `/read`, customer-scoped issue `/orders` | needs visual alignment of public/internal composer choice; draft/send/retry/room isolation already implemented |
| Conversation Web | 9753ce991f9d4511b53cf91c4e4aa895 | fullscreen room + existing profile route | same | supported room layout; team/LINE/AI/VIP are later, not active first-release controls |
| Store Mobile | d7fa95f30ae54fb785c5df37da66b0b5 | `/store`, `store-hub.tsx` | `/sources`, `/fx` | implemented grouped menus and real saved-data summary; latency and auto fulfillment labels omitted |
| FX Mobile | c8f86d84730746f0af0c4b337318158b | `/store/fx`, `store.tsx` | `/fx`, `/fx/history`, `/fx/preview` | needs visual alignment: local USD→LAK example calculator; real saved rate/manual override, error/disabled/retry/history already present |

## Related first-release routes without a distinct canonical screenshot in this selected set

These routes reuse the approved shared style tokens. Do not claim pixel-identical acceptance from a title alone.

| Route | Component | API and acceptance owner |
| --- | --- | --- |
| `/customers/:id` | `Customer` | customer profile and per-customer `/orders`; Task 3 loading/error/empty/retry/isolation |
| `/store/sources` | `Sources` | source toggles + sync jobs; Task 3 stale/error/retry; 15:00–16:00 guard remains server enforced |
| `/store/games` | `Games` | game/zone toggles; Task 3 confirmed zones only |
| `/store/products` and `/:id` | `Products`, `ProductEditor` | products/catalog/preview; Task 3 unavailable offer, mismatch, conflict and drafts |
| `/store/pricing`, `/store/settings` | `ShopSettings` | `/settings`; Task 3 hide unsafe defaults on failed load, preserve drafts, disable failed/stale writes |
| `/store/audit` | `Audit` | `/audit`; Task 3 loading/error/empty/retry |
| `/store/backups` | `Backups` | `/backups`; Task 3 configured/failed/running/success states, Task 4 scratch restore |
| auth loading/denied/expired | `App`, admin auth service | session/me; Task 4 actual Telegram validation and owner/non-owner acceptance |

## Common states and visual decisions

- Shared `PageHeader`, `Panel`, `ReadNotice`, `Loading`, `Empty`, `Status`, receipt dialog and action dock own repeated patterns.
- White surfaces, #2563EB actions, muted blue backgrounds, 12px controls/20px cards and readable Thai text are the first-release token baseline.
- 4 Mobile bottom tabs and the same 4 Web sidebar destinations remain. Extra prototype sidebar sections are not fake links.
- Two-column Web order workspace begins at 1200px; Mobile detail drills in and returns to its filter/page/scroll context.
- Public/internal composer choices must be visible and mutually exclusive, using the current backend visibility field.
- Converter figures are labelled local examples; saved order prices still come from server quote/snapshot arithmetic.
- No provider game artwork is bundled without an approved asset. Existing game initials remain meaningful placeholders.
- Duplicate snapshots of a customer, week, notification or closed queue remain duplicate references, not separate implementation routes.

## Later / backend gaps

Refund evidence states belong to Task 5; chat archive/case-state/PDF to Task 6; full ledger/net-profit and exports to Task 7. Promotions, team transfer/RBAC, maintenance automation, circuit breaker/failover, UID provider checks and extra games remain the contract-led backlog in the approved plan.

## Acceptance status

Task 1: reference inspection and ownership matrix complete. Tasks 2-3 require new rendered comparisons and regression evidence. Task 4 requires same-version backend/UI deployment, safe endpoint checks and real-device results; Chromium emulation alone never marks actual Telegram phone acceptance complete.
