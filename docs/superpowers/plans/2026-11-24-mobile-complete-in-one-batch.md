# Squid First Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkboxes for tracking.

**Goal:** ส่งมอบ Squid First Admin Mobile ครบทุกเส้นทางของแอปรุ่นปัจจุบันในชุดเดียว โดยเทียบ UI กับ Google Stitch ทดสอบบนเครื่อง และปิดงานด้วย Telegram Mini App บน iPhone

**Architecture:** ใช้ React routes, API contracts และฐานข้อมูลที่มีอยู่ร่วมกันทั้ง Mobile และ Desktop ปรับการวางหน้าจอและองค์ประกอบฝั่ง Mobile เป็นหลัก ใช้พรีวิว localhost พร้อมฐานข้อมูลแยกสำหรับตรวจข้อมูลและใช้ fixtures แยกสำหรับทดสอบสถานะที่ฐานข้อมูลพรีวิวไม่มี

**Tech Stack:** React, TypeScript, Vite, Fastify, PostgreSQL/PGlite, Playwright และ Telegram Mini App

**Spec:** [Google Stitch · Game Top-Up Operations Hub](https://stitch.google.com/projects/9946906478898127464), design-system asset `15836625846179922843` และ [screen/route/API matrix](../../design/screen-route-matrix.md) ใช้ matrix เป็นรายการเส้นทางและอัปเดตสถานะหลังตรวจ code ปัจจุบัน

## ขอบเขตและเกณฑ์ส่งมอบ

- ใช้ **Squid First iOS Minimal Light — Fixed Typography** ที่อนุมัติแล้ว ขาวคลีน `#FFFFFF`, พื้น `#F8FAFC`, ปุ่มหลัก `#2563EB`, ข้อความ `#0F172A`, Inter และฟอนต์ไทยที่อ่านง่าย ใช้การ์ด 16px ปุ่ม 12px พื้นที่กดอย่างน้อย 44px รองรับ safe area และ reduced motion
- เทียบครบทั้งแถบด้านบน แถบล่างสี่แท็บ ตำแหน่งปุ่ม ข้อความ การ์ด ไอคอน เว้นระยะ และสถานะโหลด ว่าง ผิดพลาด และปิดใช้งาน ตรวจที่ 360, 375 และ 390px พร้อมแนวตั้งจอสั้น 360×450 สำหรับห้องแชท
- ดึง layout จากหน้าต้นฉบับ Mobile ที่ตรงกับ flow นั้น หากพบหน้าที่ Stitch ทำเครื่องหมายรอลบหรือมีหลายแบบ ให้บันทึกว่าใช้อ้างอิงตัวใดและเหตุผลก่อนแก้โค้ด เส้นทางที่ไม่มีแบบเฉพาะให้ใช้ส่วนประกอบและ token ของระบบเดียวกัน และบันทึกไว้ใน matrix
- ยอดเงิน สถานะ รูปสลิป ชื่อเกม และเรทใช้ข้อมูลจาก API ตามที่มีจริง ฐานข้อมูลพรีวิวมีออเดอร์เดิม 10 รายการที่ตัดข้อมูลระบุตัวลูกค้าแล้ว ใช้ fixture เพื่อทดสอบออเดอร์รอชำระ/รอตรวจ/กำลังเติม/สำเร็จ/พบปัญหา/คืนเงิน และข้อความแชท ใช้คนละฐานกับพรีวิวและร้าน
- รักษากฎรอชำระ 15 นาทีและเปิดเผยสถานะนี้ใน Admin ตามที่ตกลง ตรวจว่าแจ้งออเดอร์เข้า Telegram เมื่อเติมสำเร็จ และการหมดเวลาหรือยกเลิกไม่สร้างการแจ้งสำเร็จ
- ทำทุกงานย่อยในรอบเดียว รวมผลเป็นพรีวิว Mobile หนึ่งชุด มีจุดตรวจภายในแต่ไม่ต้องรออนุมัติรายหน้าหรือสลับไปทำ Desktop ระหว่างทาง ตรวจ Desktop เพื่อกันผลกระทบจากส่วนที่ใช้ร่วมกัน
- งานจบในเครื่องก่อน จากนั้นทดสอบบน iPhone ผ่าน Telegram ด้วย bot และฐานข้อมูลสำหรับทดสอบเมื่อปลายทางทดสอบพร้อม การขึ้น Production เป็นขั้นหลังการรับงาน

## งานย่อยและคะแนนรับงาน

| งาน | หน้าจอ / เส้นทาง | น้ำหนัก |
| --- | --- | ---: |
| 1. ล็อกต้นฉบับและโครง Mobile | auth, 4 tabs, safe area, loading/error/empty | 10% |
| 2. ภาพรวม ออเดอร์ และสลิป | `/`, `/orders`, `/orders/:id`, ตัวดูสลิป | 23% |
| 3. แชทและข้อมูลลูกค้า | `/chats`, `/chats/:id`, `/customers/:id` | 17% |
| 4. ร้าน เกม และสินค้า | `/store`, `/store/games`, `/store/products`, `/store/products/new`, `/store/products/:id` | 20% |
| 5. เรท ซัพพลายเออร์ และตั้งค่า | `/store/fx`, `/store/sources`, `/store/pricing`, `/store/settings`, `/store/audit`, `/store/backups` | 15% |
| 6. รวมพรีวิวและตรวจบนเครื่อง | ทุกเส้นทาง Mobile พร้อมทดสอบผลกระทบ Desktop | 5% |
| 7. ตรวจบน iPhone ผ่าน Telegram | owner session, order lifecycle, แชท, การแจ้งเตือน | 10% |
| **รวมชุด Mobile** | **Local 90% + iPhone/Telegram 10%** | **100%** |

นับคะแนนเมื่อผ่านผลรับงานของกลุ่มนั้นทั้งกลุ่ม องค์ประกอบเดิมที่ทำไว้แล้วนำมาใช้และตรวจซ้ำได้ ไม่ตีความคะแนนนี้เป็นจำนวนหน้าที่เขียนโค้ดแล้ว ใช้รายงาน Mobile แยกจากความคืบหน้าทั้งโปรเจกต์

## เกณฑ์ที่ต้องตรวจเป็นพิเศษ

- สลิปเสีย สิทธิ์หมด และเน็ตหลุดต้องมีทางกลับ/ลองใหม่ รายการที่โหลดไม่สำเร็จไม่ถูกแสดงว่าเป็นคิวว่าง
- กลับจากรายละเอียดต้องได้ตัวกรอง ตำแหน่งรายการ และหน้าเดิมแม้เจอรายการชื่อยาวหรือมีแถบปุ่มด้านล่าง
- คีย์บอร์ด iOS ไม่บังปุ่มส่ง ร่างข้อความยังคงอยู่ และบันทึกภายในไม่หลุดไปช่องลูกค้า
- SKU, โซน, ราคาต้นทาง และผลคำนวณราคาอาจเปลี่ยนพร้อมกัน หน้าอ่านข้อมูลเก่าต้องแยกจากการบันทึกสำเร็จ
- อ่านข้อมูลออเดอร์ที่ไม่ครบได้โดยไม่สร้าง UID, สลิป, สถานะ, รายได้ หรือสถานะสุขภาพซัพพลายเออร์ขึ้นเอง

## แผนลงมือ

### 1. ล็อกหน้าต้นฉบับและโครง Mobile · 10%

**ไฟล์:** `docs/design/screen-route-matrix.md`, `admin-ui/src/App.tsx`, `admin-ui/src/design-system.css`, `admin-ui/src/stitch-layout.css`, `tests/miniapp/design-alignment.spec.ts`

- [ ] บันทึก screen ID, route, viewport และสถานะตัวอย่างใน matrix ใช้ Overview `d5331699295f43b497b546a572dab403` และ Orders Fulfillment `79e6a382460b44b69a44a657a39c0666` เป็นจุดเริ่มของสองเส้นทางที่ตรวจไปแล้ว
- [ ] เก็บภาพ baseline ของแต่ละ route และตัดรายการอ้างอิงซ้ำ ตัวอย่างสินค้า `76ae1ad1c351411c8da10782934a09b6` มีเครื่องหมายรอลบ ใช้ Store Hub ที่อนุมัติและ token เดิมกำหนดหน้าสินค้าเมื่อไม่มีหน้าทดแทนที่ยืนยันได้
- [ ] เทียบโครงทั้งสี่แท็บและ auth loading/denied/expired ตรวจพื้นสว่าง ช่องว่าง ขนาดปุ่ม focus และ safe area ด้วย `npx playwright test tests/miniapp/design-alignment.spec.ts`

### 2. ปิดภาพรวม ออเดอร์ รายละเอียด และสลิป · 23%

**ไฟล์:** `screens/overview.tsx`, `screens/orders.tsx`, `components/order-card.tsx`, `components/order-actions.tsx`, `receipts.tsx`, `order-navigation.ts` ภายใต้ `admin-ui/src`; `tests/miniapp/core-workspace.spec.ts`, `tests/miniapp/ux-continuity.spec.ts`

- [ ] เก็บภาพหน้า overview, list, detail และ slip ด้วยสถานะจริงจาก fixture เทียบลำดับข้อมูลและตำแหน่งปุ่มทุกสถานะ
- [ ] ปรับ Mobile ตามภาพโดยใช้ `/admin/v1/overview`, `/orders`, `/orders/:id/actions` และสลิปที่ได้รับสิทธิ์ตามสัญญาเดิม ทำให้ปุ่มเลือกหลายรายการเปิดใช้ตามสถานะที่ backend อนุญาต
- [ ] ตรวจ UID copy, ตัวกรองและ scroll restore, เปิด/ปิดรูปและ PDF, error/retry, การตรวจสลิปจนถึงเติมสำเร็จ และการหมดอายุจากชุดทดสอบเดิม เพิ่ม assertion เฉพาะจุดที่ยังขาด

### 3. ปิดแชทและลูกค้า · 17%

**ไฟล์:** `screens/chat-list.tsx`, `screens/chats.tsx`, `components/chat-card.tsx`, `components/chat-issue-context.tsx`, `components/chat-message-mode.tsx`; `tests/miniapp/design-alignment.spec.ts`, `tests/miniapp/ux-continuity.spec.ts`

- [ ] เทียบรายการห้อง สนทนา และโปรไฟล์ลูกค้า โดยเริ่มจาก Stitch Chat List `62738ab1d11d4ed389259548d612189d`, Conversation `437e4d2539c544c08294739d89c7d6b8`, Customer Profile `cfdddd9508d14eefabde4eb855a78b86`
- [ ] รักษา `/customers/:id/chat`, `/read` และออเดอร์ที่จำกัดตามลูกค้า ตรวจร่างข้อความ การสลับส่งลูกค้า/บันทึกภายใน การแจ้ง unread และการกดออเดอร์แล้วย้อนกลับ
- [ ] ทดสอบที่ 390×844 และ 360×450 ให้ปุ่มส่งกดได้เมื่อคีย์บอร์ดอยู่บนจอ ตรวจว่า private note ไม่ไปใน public chat และแชทไม่ปะปนกันเมื่อลูกค้ามีหลายออเดอร์

### 4. ปิดร้าน เกม โซน และสินค้า · 20%

**ไฟล์:** `screens/store-hub.tsx`, `screens/products.tsx`, `stitch-layout.css`; `tests/miniapp/admin.spec.ts`, `tests/miniapp/read-failures.spec.ts`

- [ ] จัด Store Hub ตามส่วนสินค้าและต้นทุน ลูกค้า และระบบ พร้อม header, badge และเมนูที่เปิดเส้นทางได้จริง เทียบ Stitch `a9ced3410a704fafb2b7ce477cea473a`
- [ ] เพิ่มการเลือกเกม/โซนและค้นหาแพ็กเกจจากข้อมูล `/games`, `/products` ที่โหลดอยู่ จัดการ์ดสินค้าให้เห็นชื่อแพ็กเกจ โซน สถานะ ราคาขาย และทางเข้าแก้ไข ใช้ quote จาก `/products/:id/preview` สำหรับผลคำนวณ
- [ ] เทียบ layout ตัวแก้ไขบนมือถือ ให้การเลือกแพ็กเกจต้นทาง การยืนยันว่าเทียบกันได้ และปุ่มบันทึกไม่หลุดจอ ตรวจ draft, ราคาเก่า/หาเรทไม่ได้, เปิดขาย, revision conflict และการกู้ข้อมูลหลังลองใหม่

### 5. ปิดเรท ซัพพลายเออร์ และตั้งค่า · 15%

**ไฟล์:** `screens/store.tsx`, `screens/settings.tsx`, `components/fx-example.tsx`; `tests/miniapp/read-failures.spec.ts`, `tests/miniapp/design-alignment.spec.ts`, `tests/backup.test.ts`

- [ ] เทียบ FX `7ebcfbe2add64b5dae320132d7c771e9` และกิจกรรมล่าสุด `564601d87a844501a3d32a7e0115b509` ปรับแผงเรท ประวัติ การตั้งค่าร้าน ต้นทางและสำรองข้อมูลด้วย token ชุดเดียวกัน
- [ ] ใช้ `/fx`, `/fx/preview`, `/fx/history`, `/sources`, `/settings`, `/audit`, `/backups` ตามสัญญาเดิม คงรอบซิงค์และการป้องกันเขียนเมื่อข้อมูลโหลดไม่ครบ
- [ ] ตรวจเครื่องคิดเรทไม่บันทึกค่าเอง ตรวจการแก้บัญชีรับเงินและเงื่อนไขตั้งค่าผ่านฐานทดสอบ ตรวจ backup/restore ใน scratch DB เท่านั้น

### 6. รวมพรีวิวและปิดผลทดสอบ Local · 5%

**ไฟล์:** `tests/miniapp/server.ts`, `tests/miniapp/preview-orders.ts`, `docs/design/screen-route-matrix.md`

- [ ] รัน `npm run check:admin`, `npm run check`, `npm test` แล้ว build UI ลง `artifacts/local-preview/admin-ui/dist` ด้วย `npm run build:admin -- --outDir ../artifacts/local-preview/admin-ui/dist`
- [ ] รัน `$env:SQUID_LOCAL_BUILD='1'; npx playwright test` แล้วตรวจภาพ 360/375/390px และ Desktop regression 1280/1440px ไม่มี overflow ที่ทำให้ปุ่มหรือข้อความหาย
- [ ] เปิดพรีวิวด้วย `node --import tsx tests/miniapp/server.ts --preview` ตรวจการอ่านข้อมูลเดิมที่ `127.0.0.1:3102/preview` ด้วยฐานแยก จดผลต่อ route และภาพเปรียบเทียบ พร้อมสรุปน้ำหนักที่ผ่าน

### 7. ทดสอบ Telegram บน iPhone และรับงาน · 10%

- [ ] ใช้ปลายทาง HTTPS, bot และฐานข้อมูลทดสอบที่แยกจาก Production เปิด Mini App จากบัญชี owner และตรวจว่า non-owner ไม่เข้าได้
- [ ] ตรวจ safe area/คีย์บอร์ดบน iPhone จริง เดินชุดภาพรวม → ออเดอร์ → สลิป → รับงาน → เติมสำเร็จ และเปิดแชท/ทิ้งร่าง/ย้อนกลับ ทดสอบอีกกรณีปล่อยรอชำระเกิน 15 นาที
- [ ] ยืนยันจากผลทดสอบว่าออเดอร์สำเร็จส่งแจ้งเตือน Telegram ตามที่กำหนดและออเดอร์หมดเวลาไม่ส่งแจ้งเตือนสำเร็จ บันทึกเครื่อง เวลา ผล และภาพโดยไม่เผยข้อมูลส่วนตัว
- [ ] สรุปผลรับงานทั้งชุดครั้งเดียว หากยังไม่มี bot/ปลายทางทดสอบให้ระบุชัดว่า Local ผ่านเท่าไร และเหลือเงื่อนไขอะไรสำหรับ 10% สุดท้าย

## หน้าต้นแบบที่ต้องมีงานระบบเพิ่ม

Stitch ยังมีตัวอย่างแก้ UID บนออเดอร์เดิม, OCR/ตรวจสลิปอัตโนมัติ, ใบสำคัญคืนเงิน, เคสแชทปิด/คลัง/PDF, รายงานการเงินเต็ม/ส่งออก, โปรโมชั่น, RBAC และระบบสลับซัพพลายเออร์อัตโนมัติ จัดหมวดเหล่านี้ไว้ใน matrix ว่าเป็นงานที่ต้องมีข้อมูลหรือ API ก่อน หากรวมในรุ่นเดียวกัน ต้องเพิ่มงาน backend, สิทธิ์, การทดสอบ และขอบเขตการรับงานก่อนนับเป็นเสร็จ โดยยังใช้ Mobile เป็นกลุ่มแรก

## ผลตรวจ Local · 24 พฤศจิกายน 2026

- หน้าสินค้า Mobile ค้นหาและกรองเกม/โซนได้ ใช้ราคา ต้นทุน และกำไรจาก quote ที่บันทึกไว้ เปิดตัวแก้ไขเดิมได้ แถบแท็บสูง 56px ก่อนรวม safe area
- ตรวจ 17 เส้นทางที่ 360, 375 และ 390px พร้อมบันทึกภาพอ้างอิงที่ 390px ใน `artifacts/mobile-acceptance/` เส้นทางและต้นฉบับอยู่ใน [matrix](../../design/screen-route-matrix.md#mobile-batch--24-november-2026)
- TypeScript และ build ผ่าน ชุดทดสอบเบราว์เซอร์ 53/53 และ backend 60/60 พรีวิว `127.0.0.1:3102/preview` ส่ง build ล่าสุดและอ่านออเดอร์ 10 รายการ ฐานพรีวิวยังไม่มีแพ็กเกจขาย จึงตรวจการแก้แพ็กเกจด้วย fixture ในอีกฐาน
- การตรวจอิสระไม่พบปัญหาระดับสำคัญ เทสต์โซนของ fixture มีแพ็กเกจเพียงโซนเดียว จึงยังไม่ได้พิสูจน์การตัดแพ็กเกจข้ามโซนด้วยข้อมูลคนละโซน ภาพเต็มหน้ารองรับการเทียบ layout ส่วนการกดผ่านแถบแท็บใช้ผล browser flow เป็นหลัก
- ปิดการตรวจบนเครื่องตามน้ำหนัก 90% เหลือการตรวจบน iPhone/Telegram จริง 10% รอปลายทาง HTTPS และบอตสำหรับทดสอบแยก ขั้นนี้ยังไม่มีการขึ้น Production

### ตรวจต่อหลัง pull `a1f38e6`

- ตรวจใหม่บนเครื่องนี้: backend 61/61, browser 59/59, TypeScript และ local UI build ผ่าน
- แก้หน้ารายการแพ็กเกจว่างทั้งเกมที่ขายได้และเกมต้นทาง เพิ่มคำอธิบายโดยไม่แสดงเป็นผลว่างเมื่อโหลดข้อมูลล้มเหลว และคง notice/retry เมื่อ metadata ของเกมต้นทางรีเฟรชไม่สำเร็จ
- เพิ่มหลักฐานการกรองคนละโซน TH/ID ร่วมกับการค้นหาและเกมอื่น รวมทั้งรูปเกมที่โหลดได้จริงและ fallback สำหรับเกมที่ไม่รู้จัก
- ตรวจอิสระและแก้ Important finding ด้วย regression RED→GREEN แล้ว พรีวิวแยกเปิดที่ `http://localhost:3103/preview` ระหว่าง process ทำงาน ไม่ได้เปลี่ยนฐานหรือบริการจริง น้ำหนัก Local ยังเป็น 90% จนกว่าจะผ่านขั้นที่ 7 บนปลายทางทดสอบแยก
