# Squid first Admin Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Admin Mini App ที่เจ้าของทำงานกับออเดอร์ แชท ราคา ร้านต้นทาง และเรทได้จาก Telegram โดยใช้ข้อมูลและกติกาชุดเดียวกับบอตเดิม

**Architecture:** คง Fastify/PostgreSQL และบริการ order/chat เดิม เพิ่ม admin identity, operational settings และ API ที่ตรวจสิทธิ์แยกจาก customer API. ใช้ React/TypeScript/Vite เป็น client ที่เสิร์ฟ same-origin ใต้ `/admin-app/`; อัปเดตหน้าจอผ่าน authenticated events พร้อม reconnect/refetch. ไม่ทำระบบเติมเงินหรือชำระเงินจริงอัตโนมัติ

**Tech Stack:** Node.js/TypeScript, Fastify, PostgreSQL/PGlite tests, React/TypeScript/Vite (เสนอเพิ่มในช่วง implementation), Telegram Mini App SDK, node:test และ Playwright สำหรับ flow UI

**Spec:** `../specs/2026-11-19-admin-mini-app-design.md`

## Global Constraints

- งานปัจจุบันคือเอกสารแผนเท่านั้น ห้ามติดตั้ง dependency, เปลี่ยน DB, token, bot menu หรือ deploy ในรอบการวางแผน
- หนึ่งบัญชีลูกค้าหนึ่ง topic รวมออเดอร์/สลิป/แชท; บอตใช้การ์ดออเดอร์เดิมและปุ่มตามสถานะ
- ดึงราคาและเรทเฉพาะ **15:00 <= เวลา < 16:00 Asia/Vientiane (UTC+7)**; manual FX ไม่เปิดช่องข้ามช่วงเวลาให้การดึงภายนอก
- แอดมินคนแรกคือ owner จาก Telegram ID ที่ตั้งค่าอยู่ ไม่ใส่ secret ใน client และไม่เปิดสมัคร admin สาธารณะ
- มีสี่ bottom tabs และแปดกลุ่มความสามารถตาม spec; mobile-first, Thai copy, ไม่มี local path/stack trace ใน product flow
- ออเดอร์เดิมเก็บราคา/เรท/กำไร/Supplier snapshot; source/FX/price settings ไม่แก้อดีต
- ไม่เปิดซื้อขายเกมโซนไม่ชัด ไม่เผยแพร่สินค้าอัตโนมัติ และไม่เปิด ORDERS_ENABLED จากงาน Mini App
- ก่อน implementation ตรวจ working tree/AGENTS.md/skills ที่เกี่ยวข้อง; รักษาไฟล์งานอื่น ไม่ commit/push หรือเปิด external service โดยอนุมานจากแผนนี้

## Review Focus

1. Mini App initData ของผู้ใช้ทั่วไป/หมดอายุ/ปลอม และ session ที่เพิกถอนต้องอ่านข้อมูลร้านไม่ได้ — Task 1
2. สวิตช์ร้านถูกปิดขณะ scrape หรือ checkout กำลังรัน ต้องไม่ commit ราคาใหม่/เลือกต้นทุนที่ขัดกับ settings ที่ยืนยันแล้ว — Tasks 3, 5
3. LFX ใหม่เข้ามาระหว่าง manual mode ต้องไม่เปลี่ยนราคาที่ใช้ขายหรือ snapshot เก่า — Task 4
4. กดจากบอตกับ Mini App พร้อมกัน/เน็ตหลุด/ส่งคำสั่งซ้ำ ต้องไม่เปลี่ยนสถานะหรือส่งข้อความซ้ำ — Tasks 2, 6
5. ออเดอร์ที่ completed แล้ว reopen/refund และข้อมูล MOCK ต้องไม่ทำยอดรายงานซ้ำ — Task 7

## ลำดับส่งมอบ

- ชุด A: Tasks 1–2 — ยืนยันตัวแอดมินและบริการร่วม พร้อม API ที่ทดสอบได้
- ชุด B: Tasks 3–5 — ตั้งค่าร้าน เรท และราคาได้จริง โดยยังไม่ต้องมีหน้าจอ
- ชุด C: Tasks 6–9 — หน้าจอ Mini App ครบ, การแจ้งเตือน, backup และตรวจรับ
- Tasks 10 — เชื่อมปุ่มบอตกับ HTTPS หลังยืนยันปลายทางเผยแพร่

## Contract กลางและแผนไฟล์

- `src/admin/contracts.ts`: `AdminActor {id:string;telegramUserId:string;role:'owner'|'operator';channel:'miniapp'|'telegram'}`; `AdminPage<T> {data:T[];next_cursor:string|null}`; `MutationMeta {idempotency_key:string;expected_revision:number}`
- Types ในไฟล์เดียวกัน: `VerifiedTelegramUser {id:string;username:string|null;authDate:number;initDataHash:string}`; `AuditInput {action:string;entityType:'order'|'customer'|'source'|'fx'|'product'|'settings'|'backup';entityId:string;before:Record<string,unknown>|null;after:Record<string,unknown>|null}` โดย before/after ต้องผ่าน field allowlist และไม่บันทึก secret
- `src/admin/auth.ts`: `verifyMiniAppInitData(raw:string,now:Date):VerifiedTelegramUser`; `requireAdmin(request):Promise<AdminActor>`; แยก cookie `squid_admin_session` จาก session ลูกค้า
- `src/admin/audit.ts`: `appendAudit(tx:SQL,actor:AdminActor,event:AuditInput):Promise<void>`; audit กับ business mutation ต้องอยู่ transaction เดียวกัน
- `src/admin/routes.ts`, `src/admin/orders.ts`, `src/admin/customers.ts`: authenticated API และ DTO ที่คัด fields แล้ว; ไม่มี path/salt/hash/token
- `src/operations/settings.ts`: `SourceSetting`, `FxSelection`, `PricingDefaults` และ settings revision
- `SourceSetting {id:'jorjee'|'ggxg';enabled:boolean;revision:number;lastSuccessAt:string|null;lastAttemptAt:string|null;lastError:string|null}`; `PricingDefaults {defaultMarkupBps:number;revision:number}` โดย default เริ่ม 1000 และแก้ได้ในขอบเขตเดิม
- `src/operations/quotes.ts`: `previewProductQuote(productId:string):Promise<AdminQuotePreview>`; ใช้ selection logic เดียวกับ checkout
- `AdminQuotePreview {productId:string;available:boolean;reason:string|null;sourceId:string|null;offerId:string|null;costLak:number|null;rateId:string|null;lakPerUsd:string|null;markupBps:number;priceUsd:string|null;estimatedGrossProfitUsd:string|null;settingsRevision:number}`; ค่าเงินที่ผ่านการแปลงเป็น decimal string ไม่ใช่ floating point
- `src/admin/events.ts`: event cursor/replay ที่ตรวจ admin session และ refetch entity โดย ID/revision
- `admin-ui/src/`: `app.tsx`, `telegram.ts`, `api.ts`, `styles/`, `screens/{overview,orders,order-detail,chats,customer,store,sources,fx,products,settings}.tsx`
- `tests/admin-*.test.ts`, `tests/settings-*.test.ts`, `tests/miniapp/*.spec.ts`: test ตามขอบเขต task
- แก้ `src/app.ts`, `src/server.ts`, `src/orders.ts`, `src/customer-chat.ts`, `src/sync.ts`, `src/database.ts`, `src/telegram.ts` เฉพาะจุดเชื่อม ไม่เขียนบริการเดิมซ้ำ

### Task 1: Admin identity และ Mini App session

**Files:** Create `src/admin/{contracts,auth,audit}.ts`, `tests/admin-auth.test.ts`; modify `src/app.ts`, `src/server.ts`.

**Interfaces:** ผลิต `AdminActor`, `requireAdmin`, session creation/revocation และ owner bootstrap; ใช้ bot token/server Telegram admin ID ที่มีอยู่

- [ ] เขียน `rejects_forged_stale_non_owner_init_data`: altered user ID/signature, อายุเกิน 300 วินาที, อนาคตเกิน 30 วินาที, user นอก allowlist → 401/403; owner ที่ลงนามถูกต้อง → session อายุ 3600 วินาที
- [ ] รัน `node --import tsx --test tests/admin-auth.test.ts` ให้เห็น RED ด้วย assertions ข้างต้น
- [ ] เพิ่ม `admin_users`, `admin_sessions`, `admin_audit`; seed owner แบบ idempotent; ตรวจ HMAC ตามเอกสาร Telegram; CSRF/Origin สำหรับ writes; cookie HttpOnly/Secure/SameSite=Lax และ log redaction
- [ ] เพิ่ม test logout/disabled owner/replay bootstrap/expired session/customer cookie ใช้แทน admin ไม่ได้ และ admin path ไม่ได้ข้าม auth เพียงติด route flag; รันคำสั่งเดิมจน GREEN
- [ ] ตรวจ diff เฉพาะไฟล์ task และบันทึก checkpoint ตามวิธี Git ที่ได้รับอนุญาต

### Task 2: API ออเดอร์และลูกค้าที่ใช้กติกาเดียวกับบอต

**Files:** Create `src/admin/{routes,orders,customers}.ts`, `tests/admin-orders.test.ts`; modify `src/orders.ts`, `src/customer-chat.ts`, `src/telegram.ts`.

**Interfaces:** `/admin/v1/orders`, `/orders/:id`, `/orders/:id/actions`, `/orders/:id/receipts/:fileId`, `/customers/:id`, `/customers/:id/orders`; `OrderActionContext {actor:AdminActor;expectedRevision?:number}` สำหรับ `OrderService.action`.

- [ ] เขียน tests: paginated list, detail, allowed_actions ตรง state machine, stale revision → 409, duplicate idempotency key → ผลเดิม, action จาก Telegram/Mini App ใช้ audit+revision เดียวกัน
- [ ] รัน `node --import tsx --test tests/admin-orders.test.ts` ให้ RED
- [ ] เพิ่ม revision/assignee ให้ orders, actor/channel audit ใน transaction; เพิ่ม cursor pagination; รวม allowed actions ให้บอตและ Mini App เรียกชุดเดียวกัน; receipt route ตรวจ session และ stream ไฟล์โดยไม่ส่ง path ใน DTO
- [ ] เพิ่ม concurrent accept/reopen/refund tests: ผู้รับผิดชอบหนึ่งคน, payment_verified ไม่สูญหาย, public chat ไม่เพิ่ม, ห้าม customer/owner-disabled อ่านสลิป; รัน test ให้ GREEN
- [ ] ตรวจ API contract กับ caller/test เดิมทั้งหมดก่อน checkpoint

### Task 3: สวิตช์ร้านต้นทางและสถานะ ingestion

**Files:** Create `src/operations/settings.ts`, `tests/settings-sources.test.ts`; modify `src/sync.ts`, `src/database.ts`, `src/admin/routes.ts`.

**Interfaces:** `getSourceSettings():Promise<SourceSetting[]>`, `setSourceEnabled(actor,id,enabled,revision)`; GET/PATCH `/admin/v1/sources`; POST `/admin/v1/sources/:id/sync` คืน job ID เฉพาะในช่วงที่อนุญาต

- [ ] Test ทั้งสองร้านเริ่มเปิด, ปิดแล้ว worker ไม่เริ่ม fetch, ปิดระหว่าง fetch แล้วไม่ commit, นอก 15:00–16:00 ไม่เรียก source แม้กด sync, งานร้านเดียวกันไม่ซ้อน
- [ ] รัน `node --import tsx --test tests/settings-sources.test.ts` ให้ RED
- [ ] เพิ่ม source settings แบบถาวรและ audit; อ่านก่อน fetch/ก่อน commit; เก็บผลรัน/ข้อผิดพลาดล่าสุดแยกจาก snapshot สำเร็จ; sync เป็น job ไม่แขวน HTTP request
- [ ] รัน GREEN พร้อม `tests/sync-window.test.ts`; ตรวจเปิด/ปิดไม่มี DELETE snapshots และไม่มีข้อมูล source URL อิสระที่ก่อ SSRF
- [ ] ตรวจ API DTO และ checkpoint

### Task 4: LFX/manual mode และ preview ผลต่อราคา

**Files:** Modify `src/operations/settings.ts`, `src/database.ts`, `src/fx.ts`; create `tests/settings-fx.test.ts`; extend admin routes.

**Interfaces:** `FxSelection {mode:'lfx'|'manual';manual_rate_id:string|null;revision:number}`; `effectiveFxRate():Promise<StoredRate|null>`; GET/PATCH `/admin/v1/fx`, GET `/admin/v1/fx/history`, POST `/admin/v1/fx/preview`.

- [ ] Test manual rate ยังคงใช้เมื่อ LFX ใหม่ถูกเก็บ, สลับกลับ LFX จึงเลือกค่าล่าสุดของ LFX, ไม่มี quote → unavailable, ค่าศูนย์/ติดลบ/ไม่ใช่ decimal ถูกปฏิเสธ, snapshots เดิมไม่เปลี่ยน
- [ ] รัน `node --import tsx --test tests/settings-fx.test.ts` ให้ RED
- [ ] เพิ่ม mode selection แยกจาก quote history; reuse decimal/BigInt และ user-provided provenance; เปลี่ยน caller `latestFxRate` ที่ใช้คิดราคามา effective selection; UI history แยก fetched/provided/publication date
- [ ] รัน GREEN กับ `tests/fx*.test.ts`, `tests/manual-rate.test.ts`, `tests/orders.test.ts`; source failure ต้องยังแสดงค่าล่าสุดและอายุจริง ไม่สร้าง publication date
- [ ] ตรวจ migration/default ว่ารักษาเรทที่ใช้อยู่ก่อน upgrade แล้ว checkpoint

### Task 5: จัดการเกม แพ็กเกจ เทียบราคา และกำไร

**Files:** Create `src/operations/quotes.ts`, `src/admin/products.ts`, `tests/admin-products.test.ts`; modify `src/orders.ts`, `src/operations/settings.ts`.

**Interfaces:** `/admin/v1/games`, `/products`, `/products/:id`, `/products/:id/offers`, `/products/:id/preview`; pricing strategy `auto_cheapest | fixed_offer`, default markup 1000 bps และ override ราย product

- [ ] Test source ปิด/offer inactive/คนละโซน/ยังไม่ยืนยัน equivalence → ใช้ไม่ได้; auto เลือกถูกสุดในกลุ่มที่ผ่านตรวจ; fixed ใช้ไม่ได้ → unavailable; ปิดทุกร้าน → ซื้อไม่ได้
- [ ] รัน `node --import tsx --test tests/admin-products.test.ts` ให้ RED
- [ ] เพิ่ม publish/unpublish และ game/zone availability; reuse canonical mappings; ทำ quote+settings revision ให้ atomic กับ checkout และ source toggle; preview แสดงต้นทุน เรท บวกจากทุน ราคาขาย และกำไรขั้นต้น
- [ ] เพิ่ม race test source disable เทียบ checkout, default/override bounds เดิม 0..10000 bps, rounding และ order snapshot ไม่เปลี่ยนหลังแก้ settings; รัน GREEN
- [ ] ตรวจว่า PUBG/Roblox และโซน unspecified ไม่ถูกเปิดขายโดยอนุมาน แล้ว checkpoint

### Task 6: แชทและข้อมูลอัปเดตสองช่องทาง

**Files:** Create `src/admin/events.ts`, `tests/admin-chat.test.ts`; extend `src/admin/customers.ts`, `src/customer-chat.ts`, order audit/event writes.

**Interfaces:** GET `/admin/v1/events` (SSE + Last-Event-ID), `/customers/:id/chat?after=...`; POST `/customers/:id/chat`; reply body `{text,visibility,client_message_id}` และ last-read cursor per admin

- [ ] Test ส่งจาก Mini App เห็นใน web chat ลูกค้าหนึ่งครั้ง, ตอบจาก Telegram เห็นใน Mini App, internal note ไม่เห็นฝั่งลูกค้า, reconnect ไม่แสดงซ้ำ และไม่ได้เอาเลขออเดอร์ไปแปะข้อความอัตโนมัติ
- [ ] รัน `node --import tsx --test tests/admin-chat.test.ts` ให้ RED
- [ ] ใช้ CustomerChat เดิมและแยก admin outbound notice ไป topic อย่างชัดเจน; บันทึก admin_events เฉพาะ entity ID/revision ที่ authorized; รองรับ refetch เมื่อ cursor เก่า/แอปกลับจาก background
- [ ] Test revoked session ปิด stream, payload ไม่รั่ว token/path, Telegram echo ไม่วนลูป, order status/audit ไม่กลายเป็นแชท; รัน GREEN
- [ ] ตรวจ read cursor/per-user ownership แล้ว checkpoint

### Task 7: ภาพรวม ยอดขาย กำไร และงานเร่งด่วน

**Files:** Create `src/admin/overview.ts`, `tests/admin-overview.test.ts`; extend admin routes.

**Interfaces:** GET `/admin/v1/overview?from=...&to=...&include_mock=false`; DTO มี counts per status, successful revenue, refunds, estimated gross profit และข้อมูลต้นทุนที่ขาด

- [ ] Test MOCK ไม่รวมยอดจริง, pending ไม่เป็นรายได้สำเร็จ, completed→processing→completed ไม่คิดซ้ำ, refunded หักจากฐานที่กำหนด และวันรายงานเปลี่ยนที่ 00:00 Asia/Bangkok
- [ ] รัน `node --import tsx --test tests/admin-overview.test.ts` ให้ RED
- [ ] คำนวณจาก order/payment snapshots กับประวัติที่มีจริง ระบุข้อจำกัดค่าใช้จ่ายที่ยังไม่มีข้อมูล; คืนคิวรอตรวจสลิป/รอรับงาน/มีปัญหาพร้อมตัวกรอง
- [ ] รัน GREEN พร้อม test decimal totals/missing snapshot ที่ต้องคืน null แทนตัวเลขหลอก
- [ ] ตรวจนิยามยอดทุกช่องให้ตรง spec แล้ว checkpoint

### Task 8: Mobile Mini App ทั้งสี่เมนู

**Files:** Create `admin-ui/` ตามแผนไฟล์, `src/admin/static.ts`, `tests/miniapp/admin.spec.ts`; modify package scripts/app wiring.

**Interfaces:** ใช้ authenticated API จาก Tasks 1–7 เท่านั้น; client routes `/admin-app/`, `/orders/:id`, `/chats/:customerId`, `/store/{products,sources,fx,settings}`

- [ ] ก่อนเขียน HTML/CSS/clientside JS ใช้ skills frontend-design/modern-web-guidance ตามข้อกำหนด session; เสนอหน้าตาสำหรับทบทวนจาก wireframe เดิม ไม่ติดตั้ง dependency ในขั้นแผนนี้
- [ ] เขียน failing browser flows: owner bootstrap, queue→slip→action, detail↔chat, source toggle, FX mode preview; viewport 360/390/768/1280 และ Telegram theme/safe-area/keyboard
- [ ] เพิ่ม React/TypeScript/Vite, same-origin API wrapper, admin session/CSRF bootstrap, four tabs, loading/empty/error/offline states และ responsive split view เฉพาะจอกว้าง
- [ ] เชื่อม events/refetch; แสดง conflict เมื่อ revision เก่า; ปุ่มตาม allowed_actions และคง reopen; ซ่อน team UI; ไม่มี API_KEY/token/local path ใน bundle/UI
- [ ] รัน `npx playwright test tests/miniapp/admin.spec.ts` ให้ GREEN และตรวจ manual Telegram mobile/desktop ที่เครื่องมือเข้าถึงได้ พร้อมระบุแพลตฟอร์มที่ยังไม่ได้ทดสอบ
- [ ] ตรวจ bundle/build และ checkpoint

### Task 9: ตั้งค่า การแจ้งเตือน และสำรองข้อมูล

**Files:** Create `src/admin/settings.ts`, `src/operations/backup.ts`, `tests/admin-settings.test.ts`, `tests/backup.test.ts`; UI settings screen.

**Interfaces:** `/admin/v1/settings` เฉพาะ field allowlist, `/admin/v1/audit`, `/admin/v1/backups`; backup เป็น owner-only job มีสถานะ/manifest ไม่เสิร์ฟโฟลเดอร์ backup เป็น static

- [ ] Test ตั้งบัญชีรับเงิน/คำแนะนำแล้วมี revision+audit, ปิด notification setting ไม่ทำ outbox สูญหาย, อ่าน audit/backup ต้อง owner และไม่แสดง secrets
- [ ] รัน `node --import tsx --test tests/admin-settings.test.ts tests/backup.test.ts` ให้ RED
- [ ] เพิ่ม operational settings ที่มีใน spec, alert source failure/stale data โดย deduplicate; ทำ database+receipt backup พร้อม manifest/hash และ policy เก็บไฟล์; ถ้าใช้ encryption เก็บ key แยกจากไฟล์ backup
- [ ] Restore ในฐานข้อมูล/ไดเรกทอรี scratch ตรวจ order snapshots, customer rooms, receipt hashes และไม่ส่ง Telegram jobs ระหว่าง restore test; รัน GREEN
- [ ] ตรวจ recovery instructions แล้ว checkpoint

### Task 10: Release gates และเชื่อม Telegram menu

**Files:** Create `docs/admin-mini-app.md`, deployment/runbook ตาม host ที่เลือก, `scripts/configure-admin-menu.ts`; update `.env.example` โดยไม่มีค่า secret

**Interfaces:** `ADMIN_APP_URL` ต้องเป็น HTTPS origin ที่ deploy จริง; menu button `จัดการร้าน` เปิด `/admin-app/`; owner-only backend ยังคงเป็นตัวตรวจสิทธิ์แม้คนอื่นเห็น URL

- [ ] รัน `npm test`, `npm run check`, `npm run build` และ browser suite; independent review แก้ important findings ก่อนเผยแพร่
- [ ] ตรวจ production readiness: HTTPS/origin, database/receipt persistence, owner Telegram ID, session/CSRF settings, backup storage, health checks และ rollback ของ build/migration โดยไม่ลบข้อมูล
- [ ] เตรียม preview ให้ทบทวนหน้าตาและตรวจ checklist ของ spec; ขอข้อมูล host/domain เฉพาะเมื่อไม่มีในบริบท และให้การอนุมัติเผยแพร่เป็นขั้นสุดท้ายหลังมีผลที่ตรวจได้
- [ ] หลังได้รับการอนุญาตปลายทางจึง deploy และตั้ง `setChatMenuButton`; ห้ามสลับบอตหรือแก้ token โดยอนุมาน
- [ ] ทดสอบ owner ผ่าน Telegram จริงหนึ่งรอบและ non-admin denied; ตรวจบอต/หน้าร้านเดิมไม่เสีย; สรุปสิ่งที่ขึ้นใช้งานจริงกับส่วนที่ยังปิดไว้แยกกัน

## งานตามหลังที่ไม่ขวางรุ่นแรก

- เพิ่ม PUBG Mobile/Roblox หลังตรวจตัวเลือกของร้าน โซน และวิธีเติม; ยังไม่เก็บรหัสผ่านเกมหรือเปิดขายแบบ login-required เพียงเพราะร้านมีชื่อสินค้า
- เปิด team management UI เมื่อมีแอดมินเพิ่ม พร้อม role matrix และ assignment flow ที่ทดสอบร่วมกับ Telegram
- สร้าง/เชื่อม customer storefront เป็นอีกแผน ไม่อ้างว่า Admin Mini App เท่ากับ checkout ลูกค้าพร้อมใช้งาน

## Self-review

- ครบแปดกลุ่มความสามารถในสี่เมนู; dependencies เรียง auth→services→settings→UI→release
- แยกสิ่งที่มีจริงออกจากสิ่งที่ต้องเพิ่ม ไม่ใช้ latestFxRate แบบล่าสุดข้ามโหมดเป็น manual selection
- Review Focus ทั้งห้าข้อมี task/test รับผิดชอบ; global snapshot/ingestion/secret constraints ไม่ถูกข้าม
- ยังไม่มี deployment target และภาพ visual ที่อนุมัติ จึงไม่ถือว่าแผนเป็นคำสั่งเปิด production

## Handoff

เอกสารนี้พร้อมทบทวนก่อน implementation. ทางที่เสนอ: ทำทีละ task ในแชทนี้ ใช้ระบบเดิมเป็นหลักและตรวจรีวิวรวมก่อนเผยแพร่; หากเลือกแบ่งผู้ช่วย ให้แบ่งตามขอบเขตบริการข้างต้น ไม่ให้สองคนแก้ transaction/schema เดียวกันพร้อมกัน
