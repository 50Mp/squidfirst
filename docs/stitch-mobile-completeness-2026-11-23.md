# Mobile design completeness — 23 November 2026

User approved preserving the latest UI, using #2563EB, selecting four canonical main screens, aligning example data, and filling operational states. This revision changes Stitch designs only.

## Canonical screens

- Overview: `286614df1ad24d4596786fa3d4082396`
- Orders: `beb71683567a44ff810445ed3f11e741`
- Chats: `62738ab1d11d4ed389259548d612189d`
- Store: `d7fa95f30ae54fb785c5df37da66b0b5`

These instances are labelled `หน้าหลัก 01` through `หน้าหลัก 04` and favourited. Existing screen coordinates and hidden states were preserved. No custom groups were created.

## Added states

Eight new visible normal screen instances: order loading, filtered empty result, order load error with read-only cache, failed chat send with retained draft/retry, pending refund, completed refund with proof, stale price/rate, and unsupported zone.

Refund proof uses three required controls (reference, transfer time, attachment). Browser validation rejects an empty form and accepts all three completed fields. This is a prototype UI gate, not a backend authorization or payment integration.

## Focused corrections

Updated four existing UI screens: chat UID issue label, store ingestion window 15:00–16:00, weekly report order-count/profit/AOV terminology, and refund request before proof. Two source documents now use the same illustrative figures and identify their claims as design proposals rather than verified live integrations.

Figures: sales 324500 THB; COGS 271850; fees 6490; profit before promotions 46160; promotions 3310; net 42850. Total orders 1024 = completed 1020 + refunded 4. AOV 316.89. Per-game sales 112400 + 98600 + 74200 + 39300 = 324500.

## Evidence and limits

Local evidence is in `.stitch/2026-11-23/`: source backups, manifests, reviewed HTML/PNG, UI/new-state reviews, publication records, and remote read-back checks. Mobile layouts were checked at 360px and 390px with no document horizontal overflow in the tested renders. Production UI/backend, actual chat sending, supplier dispatch and bank refunds were not deployed or exercised.
