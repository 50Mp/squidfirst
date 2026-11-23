# Squid first Stitch-to-Code Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in the current session. Steps use checkbox tracking. This document plans future work; creating it does not deploy services or implement the deferred modules.

**Goal:** ส่งมอบแอดมิน Mobile/Web ตาม UX/UI ที่ตกลงร่วมกัน โดยต่อยอดโค้ดปัจจุบันและแยกฟังก์ชันที่ยังไม่มี backend ออกจากงานปรับหน้าตา

**Architecture:** ใช้ React/Vite admin เดิมร่วมกับ Fastify API, PostgreSQL/PGlite และ Telegram outbox เดิม แยก component และ state ตาม flow; ใช้ API ร่วมกันทั้ง Mobile และ Web เพิ่มสัญญาข้อมูลที่ขาดก่อนเชื่อมปุ่มใหม่

**Tech Stack:** Node.js/TypeScript, React/Vite, Fastify, PostgreSQL/PGlite, Playwright, Telegram Bot/Mini App, Cloudflare Tunnel สำหรับเครื่องทดลอง

**Spec:** `docs/superpowers/specs/2026-11-23-stitch-implementation-scope.md`

## Global Constraints

- Baseline `d65fc6f`; ตรวจ HEAD, dirty files และ remote ใหม่ก่อนเริ่มแต่ละชุดงาน ไม่เขียนทับงานอื่น
- สีหลัก `#2563EB`; USD สำหรับราคาขาย; เจ้าของร้านคนเดียวและ manual fulfillment สำหรับรุ่นแรก
- หนึ่งลูกค้า/หนึ่งห้อง; status actions แยกจาก public chat; supplier/cost เป็นข้อมูลแอดมิน
- Ingestion `15:00 <= time < 16:00` UTC+7; refresh UI ไม่ใช่ sync supplier
- คง CSRF/Origin, idempotency, revisions, audit, immutable order snapshots และการแยก MOCK
- ไม่ stage `.env`, token, DB, receipts, runtime logs หรือ signed design-download URLs
- การอ่านชื่อหน้าใน Stitch ไม่ใช่การตรวจภาพ; ต้องเปรียบเทียบ screenshot ของหน้าที่กำลังทำกับผล render จริง

## Review Focus

1. Loading/error ต้องไม่แสดงยอดศูนย์หรือ empty state เป็นผลสำเร็จ และไม่เปิดให้บันทึกค่าที่โหลดไม่สำเร็จ — Task 3
2. ข้อมูลและร่างแชทไม่ข้ามลูกค้า; status action ไม่กลายเป็นข้อความลูกค้า — Tasks 3, 5, 6
3. กลับ/รีโหลด/เปลี่ยนขนาดจอแล้วคง route/filter และปุ่มส่งแชทไม่ถูก keyboard บัง — Tasks 2, 4
4. ออเดอร์จากเรทเก่าไม่ถูกคำนวณใหม่; แพ็กเกจต่างโซนไม่ถูกเทียบรวม; ปิด supplier แล้ว quote ใหม่ต้องใช้ไม่ได้ — Task 3
5. ตัวเลขรายงานและการคืนเงินไม่ถูกนับซ้ำจาก retry/reopen/เปลี่ยนสถานะ — Tasks 5, 7

## สิ่งที่มีแล้ว — ไม่เริ่มทำใหม่

| ชุด | สถานะจากโค้ด/เอกสาร | งานต่อ |
| --- | --- | --- |
| 4 เมนูหลักและแอดมิน API | มีแล้ว | ตรวจความตรงแบบและเก็บรายละเอียด |
| Theme, Mobile nav, Desktop split pane | มีแล้ว | ตรวจภาพ/spacing/type และสถานะหน้าจอ |
| Order flow, slip, reopen, manual refund เดิม | มีแล้ว | รักษา behavior; refund พร้อมหลักฐานเป็นงานใหม่ |
| Customer chat, notes, drafts, badges | มีแล้ว | ตรวจจริงบนอุปกรณ์; archive/export เป็นงานใหม่ |
| Sources/FX/products/settings/audit/backup | มีแล้ว | เก็บหน้ารองให้ตรงแบบและ error states ให้ครบ |
| Pending refund, full ledger/export, promotions, team | ยังไม่ครบ | ออกแบบ contract และทำแยกชุด |

## Task 1 — ล็อกแบบอ้างอิงและรายการหน้าที่ต้องส่งมอบ

**Files:** Create `docs/design/screen-route-matrix.md`; update `admin-ui/resources/style-guide.json` only if current approved tokens differ.

**Interfaces:** Produces a matrix: screen ID/device → route/component → API → required states → release stage → visual acceptance status. ทุกสถานะต้องระบุ implemented / needs visual alignment / backend gap / later / duplicate reference

- [ ] อ่าน metadata/ภาพ/HTML ปัจจุบันจาก project `9946906478898127464` เฉพาะชุดที่กำลังทำ เลือก canonical screen ต่อ flow ไม่ถือทุก variant เป็นหน้าใหม่
- [ ] ใช้ mapping ด้านล่างเป็นจุดตั้งต้น; IDs ของหน้ารองเป็นตัวเลือกสำหรับทบทวนก่อน implement ไม่ใช่การยืนยันว่าได้รับอนุมัติครบแล้ว
- [ ] บันทึกการตัดสินใจสำหรับความต่าง Mobile/Web และข้อมูลตัวอย่างที่ต้องแทนด้วย API จริง
- [ ] ตรวจว่าทุกเมนู ปุ่ม modal และสถานะของรุ่นแรกมีเจ้าของ task/API ชัดเจน; commit เอกสาร mapping

| Flow | Mobile reference | Web reference |
| --- | --- | --- |
| Overview | `286614df1ad24d4596786fa3d4082396` | `00a6d2a9779844fca89ae475255fec62` |
| Orders | `beb71683567a44ff810445ed3f11e741` | `413f4a34e6c54a75b6272e9d2aecadca` |
| Order details / slip | `a4ab4dde589b41b88d7bb488d0083bef`, `0e7532b364404d7ca7d36022c80c8b61` | `af82b51c30434a8395f1f39b6742a9db`, `20b6382269384c5caa8695e773b18b77` |
| Chats / conversation | `62738ab1d11d4ed389259548d612189d`, `b198eda757044b8abce15ef97b5d4a9e` | `9753ce991f9d4511b53cf91c4e4aa895` |
| Store / FX | `d7fa95f30ae54fb785c5df37da66b0b5`, `c8f86d84730746f0af0c4b337318158b` | `66fffb09cdf84508800887e7c526a090`, `c7838f53632c49169eeba891443dff6f` for related product/source flows |
| Refund | `981e0b18f72c4170ab71bf7a8f9130f1`, `d26cd132698347caa94757c423451288`, `b67e72d5e3d64449b00c9c7b6968c12e` | `aa6d3d22512449e1b2c8fa33d914ed63`, `6d2893f43f6f4e53972c6346ad606ff0` |
| Reports | `25eafe1b45a548a68e09b58ef9368707`, `25c6b350cc1544a18099c83dfd4c9c92` | `1cf3b7a8fb6d4b09a61763a921e24651` |

## Task 2 — เก็บ UI หลัก Mobile/Web ให้ตรง canonical design

**Files:** `admin-ui/src/theme.css`, `workspace.css`, `continuity.css`, `App.tsx`, `components/`, `screens/overview.tsx`, `orders.tsx`, `order-workspace.tsx`, `chat-list.tsx`, `chats.tsx`, `store-hub.tsx`; tests under `tests/miniapp/`.

**Interfaces:** Consume Task 1 matrix and existing `/admin/v1/*` DTOs; preserve current hash routes and `return_to` navigation. No new analytics/supplier actions inferred from mockups.

- [ ] เปรียบเทียบภาพทีละ flow: geometry, cards, typography, spacing, navigation, primary/secondary actions, selected states และ empty/loading/error
- [ ] ปรับ reusable tokens/components ก่อนแก้รายหน้า รักษาข้อความไทยและค่าจริง ใช้ภาพเกมที่มีสิทธิ์ใช้งาน/asset ที่ยืนยันแล้ว; ถ้ายังไม่มีให้ใช้ placeholder ที่สื่อความหมาย
- [ ] ตรวจ 360/390/768/1280/1440px และจอสั้น 360x450; keyboard-only focus, long UID/package name และ resize ระหว่าง list/detail ต้องไม่ล้นหรือทำปุ่มหาย
- [ ] รัน `npm run check:admin`, `npm run build`, `npx playwright test`; ตรวจภาพจริงของหน้าที่เปลี่ยน; commit ตาม flow ที่ผ่านแล้ว

## Task 3 — เก็บหน้ารองและ state ให้ครบรุ่นแรก

**Files:** `admin-ui/src/screens/products.tsx`, `settings.tsx`, `store.tsx`, `receipts.tsx`, `components/read-notice.tsx`; relevant `src/admin/*` only where a verified contract needs repair; `tests/miniapp/read-failures.spec.ts`, `tests/admin-products.test.ts`, `tests/admin-operations.test.ts`.

**Interfaces:** Existing product mapping/preview, source toggle/sync, FX/manual, audit, backup APIs. Reuse existing revision/idempotency fields.

- [ ] เพิ่ม regression ที่ยังขาดสำหรับหน้ารอง: initial failure ไม่แสดง empty, cached failure มีป้ายข้อมูลเก่า, retry กู้ได้ และปุ่มบันทึกไม่พร้อมใช้งานก่อนข้อมูลพร้อม
- [ ] ตรวจเกม+โซน+แพ็กเกจเทียบกันได้, supplier ปิด/ไม่มีราคา, stale FX, preview ก่อนเผยแพร่ และไม่แก้ออเดอร์เก่า
- [ ] ตรวจสลิปภาพ/PDF, ข้อมูลลูกค้า/ทุกออเดอร์, internal/public message และผลการกู้ backup โดยใช้ fixture/scratch database
- [ ] รันเทสต์เฉพาะ failure/contract ที่แก้ แล้วรันชุดรวมเมื่อส่งมอบ; commit งานหน้ารอง

## Task 4 — เปิดรุ่นทดลองพร้อมทดสอบ Telegram จริง

**Files:** `docs/admin-mini-app.md`, `scripts/start-local-admin.ps1`, `scripts/start-local-tunnel.ps1` if a verified launcher issue exists; create `docs/release/admin-v1-acceptance.md`.

**Interfaces:** Same-origin `/admin-app/` + `/admin/v1/`; target `https://admin.cffirst.com/admin-app/`. Deploy backend and UI together.

- [ ] ตรวจ process/build ที่รันจริง, PostgreSQL/receipt storage, backup และ scratch restore; บันทึก rollback ที่ทดสอบได้
- [ ] เลือกเวลาทดลองและบัญชี MOCK ให้ชัดก่อนส่งทดสอบ Telegram; ใช้ปลายทางเจ้าของเดิม ไม่สร้างออเดอร์จ่ายเงินจริงหรือซื้อ supplier เพื่อ QA
- [ ] เปิดใช้ backend+UI รุ่นเดียวกันแล้วตรวจ owner/non-owner, anonymous denial และไม่เผยแพร่ supplier/cost endpoints ผ่าน admin hostname
- [ ] ทดสอบโทรศัพท์ Android/iOS ที่ผู้ใช้มีจริง: Telegram initData/session, safe areas, keyboard/composer, ย้อนกลับ, แนบ/ดูสลิป, network loss/reconnect, order-state parity ระหว่าง Web/Telegram
- [ ] บันทึกอุปกรณ์/เวอร์ชัน/ผลจริง; ข้อไหนไม่ได้ลองให้ระบุ not verified ไม่แทนด้วยผล Chromium emulation; ผ่านแล้วจึงถือรุ่นแรกพร้อมเปิดใช้

## Task 5 — คืนเงินพร้อมหลักฐาน (ชุดงานใหม่หลังรุ่นแรก)

**Files:** First create `docs/contracts/refunds-v2.md`; then `src/orders.ts`, `src/admin/routes.ts`, `service.ts`, `src/telegram.ts`, `src/operations/backup.ts`, a new refund UI component and `tests/refunds.test.ts`.

**Interfaces:** Current `refund` action marks refunded immediately. New state/command/API names must be specified in the contract before edits, including handling existing refunded records and old Telegram callbacks.

- [ ] ตกลง transition ขอคืนเงิน/รอคืน/คืนแล้ว/ยกเลิกคำขอ พร้อม amount/currency, reference, transfer time, attachment, revision/idempotency และสิทธิ์เข้าถึงหลักฐาน
- [ ] เพิ่ม failing tests: pending ยังไม่ refunded, หลักฐานไม่ครบทำสำเร็จไม่ได้, retry ไม่ซ้ำ, Web/Telegram ใช้ transition เดียวกัน และ customer chat ไม่ได้รับ internal note
- [ ] เพิ่ม migration/backup compatibility, API, bot cards และ UI ให้ครบ flow เดียวกัน; ไม่เชื่อมการโอนธนาคารอัตโนมัติ
- [ ] ทดสอบย้อนหลังกับข้อมูลและ callback เดิมก่อนส่งมอบ; commit แยกชุด refund

## Task 6 — ปิดเคส/คลังแชทและเอกสาร

**Files:** First `docs/contracts/chat-cases.md`; then `src/customer-chat.ts`, `src/admin/service.ts`, `routes.ts`, new `admin-ui/src/screens/chat-archive.tsx`, and tests.

**Interfaces:** Chat case state must be independent from order state; one account must retain the same room/topic. Export scope must explicitly include/exclude internal notes for each audience.

- [ ] ระบุเปิด/ปิด/เปิดใหม่, archive filter, read state และการเปิดเคสเมื่อมีข้อความใหม่ โดยไม่สร้างห้องซ้ำ
- [ ] ทดสอบประวัติหลายหน้า ข้อความใหม่หลังปิดเคส การ reconnect และข้อมูลไม่ข้ามลูกค้า
- [ ] ทำ archive UI ก่อน PDF/export; เพิ่มเอกสารเฉพาะเมื่อสิทธิ์และขอบเขตข้อมูลชัดเจน ทดสอบการดาวน์โหลดแบบ authenticated
- [ ] ทดสอบ Telegram/topic recovery และ draft เดิมยังอยู่; commit แยกตาม flow

## Task 7 — รายงานบัญชีและส่งออก

**Files:** First `docs/contracts/finance-reports.md`; retain `src/admin/overview.ts` semantics; add a separate report service/routes/UI and finance tests after contract approval.

**Interfaces:** Existing overview = USD gross-profit estimate by order-created-at cohort. Proposed ledger/net-profit/export is a different contract and must not silently replace that API.

- [ ] ระบุ revenue recognition, timezone/date basis, immutable cost/FX, fees/promotions/refunds, missing-data behavior และรายงานที่ต้องการในรุ่นแรก; THB เป็นตัวอย่างในแบบ ไม่ใช่สกุลหลักที่อนุมัติใหม่
- [ ] เขียน fixture ที่คำนวณยอดตรวจได้: reopen/complete ซ้ำไม่เพิ่มรายได้, refund ไม่หักซ้ำ, ต้นทุนไม่ครบไม่แสดงกำไรสุทธิเป็นศูนย์
- [ ] ทำรายงานอ่านข้อมูลจริงและ reconciliation ก่อนกราฟ/CSV/XLSX/PDF; ตัวกรองและยอดรวมใน export ต้องตรงกับหน้าจอ
- [ ] ทดสอบสมุดรายวัน/เอกสารส่งออกบน scratch data แล้ว commit เป็นชุดรายงาน

## Later backlog — ยังไม่รวมในสัญญาส่งมอบรุ่นแรก

- โปรโมชั่น/โค้ดส่วนลดและ analytics: กำหนดกติกาสิทธิ์ใช้ วันเวลา จำกัดจำนวน stacking และผลต่อราคาก่อน checkout
- หลายแอดมิน/โอนเคส: permission matrix, invitations, assignments, concurrency และประวัติผู้ดำเนินการ
- Bulk status actions: server validates every selected order; ห้ามนับสำเร็จทั้งชุดเมื่อบางรายการล้มเหลว
- Maintenance/notification center: ต้องมี server enforcement และ recovery ไม่ใช่ป้ายสถานะจากตัวอย่าง
- PUBG/Roblox/UID checker และ gateway automation: ตรวจแพ็กเกจ โซน วิธีเติม และ provider contract ก่อนวาง sub-plan; คง manual flow จนมีหลักฐาน
- Auth screens/change-password ในแบบต้องใช้ให้ตรงกับ Telegram-owner authentication; ไม่เพิ่มระบบรหัสผ่านอีกชุดเพียงเพราะมี mockup

## ลำดับและเกณฑ์ส่งมอบ

`Task 1 → 2 → 3 → 4` คือรุ่นแรกที่แนะนำ จากนั้น `5 → 6 → 7` ตามลำดับงานร้าน แต่ละชุดหลังรุ่นแรกต้องมี contract ของตัวเองก่อนเริ่มโค้ด

ทุกชุดส่งมอบต้องมี: mapping หน้าจอ, โค้ดที่เชื่อม API จริง, state/error/retry, ผลทดสอบ, independent review สำหรับ behavior ที่เปลี่ยน, commit เฉพาะงาน, secret scan และยืนยัน remote HEAD หลัง push ห้ามใช้จำนวนหน้าจอหรือจำนวนเทสต์อย่างเดียวตัดสินว่าพร้อม production

## Self-review

แยกของที่ทำแล้วออกจากงานถัดไป; ระบุ route/component/API และ acceptance checks ของแต่ละชุด; จัด refund/finance/team ที่ไม่มี contract เป็นงานที่มี dependency ชัดเจน; ไม่วางแผนสร้างทุก snapshot/variant เป็นหน้าใหม่ ไม่มีการแก้ application code หรือ deploy จากการเขียนแผนนี้
