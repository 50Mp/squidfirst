# Stitch mobile continuity revision

Project: Game Top-Up Operations Hub (9946906478898127464).
Scope authorized by user: fix the mobile continuity issues identified in the preceding review, directly in Stitch. Desktop and production code are outside this edit.

Design contract:
- Four stable main tabs: overview, orders, chats, store management.
- Nested screens hide bottom tabs; back preserves origin, filters, scroll and drafts.
- Sheets use one close action on the right, correct title, sticky controls, scrollable body.
- Thai interface, readable body/input text, 48px controls, white and #0000FF.
- Payment review, accepting work and completion are separate manual actions; reversible status updates require a reason and audit trail.
- One customer account owns one chat and all its orders; order controls are separate from conversation messages.
- Compare equivalent game/zone/package supplier purchase costs; use Jorjee and GGXG; stored LFX 15:00-16:00 rate or explicit manual mode.
- Sample prices and financial calculations agree across screens; no unimplemented automation/security claims.

Execution:
1. Update the 25 existing mobile screens in coherent groups.
2. Add missing mobile conversation, store-management hub, FX settings and order action states as needed.
3. Download returned assets and visually review core flows; perform targeted corrections.
4. Record source-to-revised screen IDs and remaining limitations. Stitch designs do not prove working production navigation or backend behavior.

## Completed revision

- Revised 25 mobile screens and added 4 missing screens: store hub, full-screen account conversation, exchange-rate settings, and status reversal sheet. All 29 reviewed screens were uploaded as HTML and screenshots to the same Stitch project.
- Applied the same header and four-tab navigation to the four main screens. Nested screens hide tabs; payment review and manual fulfillment remain separate steps.
- Organized the visible Mobile v2 screens in six canvas rows by workflow. Nineteen superseded mobile instances are hidden, with their resources retained. The 43 non-mobile/design-system instances were preserved unchanged.
- Normalized Thai typography, corrected inconsistent page titles and sample dates, separated customer slip re-upload from admin tools, and corrected illustrative profit calculations.
- Six supplier/pricing/profile edits were returned by Stitch as DOM-operation events without persisted files. These operations were applied to archived HTML, rendered, and explicitly uploaded with screenshots. Original assets and the pre-layout canvas snapshot are retained in `.stitch/`.
- Checked all 29 screens at both 360px and 390px: 58 checks reported no document horizontal overflow or header-title/button overlap. Core screens were also inspected visually. These checks do not replace real-device or keyboard testing.
- Production app, database, Telegram bot delivery and Desktop screens were outside this revision. The result is a design set; complete clickable navigation and actual order/payment effects require implementation in the application.

Local evidence: `.stitch/metadata.json`, `.stitch/dom-edit-review.json`, `.stitch/remote-verification.json`, `.stitch/designs/mobile-v2/`.

## Canvas repair after user feedback

The user reported empty group boundaries showing `0 screens`. The custom row grouping did not render the referenced screens correctly in the Stitch canvas. Removed the six custom label instances and cleared custom group IDs/names on all 29 revised screens; explicitly set their instance type to `SCREEN_INSTANCE`. Read-back confirmed 29 visible ungrouped screen instances with source resources, zero custom row groups, and zero custom empty labels. Preserved screen coordinates, HTML, screenshots, and unrelated project instances. Visual confirmation after user refresh remains necessary.

Recovery snapshot: `.stitch/canvas-before-group-repair.json`.

The user refreshed Stitch and confirmed that the screens are visible (`เห็นหน้าจอแล้ว`). Canvas display recovery is confirmed.
