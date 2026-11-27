# แผนย้าย Squid first Admin ไป Expo + React Native Web

> ใช้ Superpowers Executing Plans เมื่อลงมือทำตามรายการนี้ เปิดใช้แต่ละช่วงบน local และตรวจผลก่อนเริ่มช่วงถัดไป

**เป้าหมาย** ให้ Squid first Admin ใน Telegram Mini App ใช้งานเหมือนแอปมือถือ โดยใช้ Expo + React Native Web และยึดหน้าตา iOS แบบ Light จาก Google Stitch ตรวจบนมือถือจริงก่อน แล้วจึงตรวจ Desktop Web ให้ครบ

**แนวทาง** สร้าง Expo app ข้าง `admin-ui/` และให้ Fastify เสิร์ฟตัวพรีวิวใต้ `/admin-app-expo/` บน origin เดียวกับ API เดิม หลังผ่านเกณฑ์ทั้งหมดจึงสลับ build ที่ `/admin-app/` โดยรักษา hash route และลิงก์ที่ Telegram ส่งอยู่แล้ว ทางเข้าพรีวิวและทางสลับรุ่นเป็นชื่องานที่เสนอในแผน

**ขอบเขตอ้างอิง** [ดัชนี Flow A–H](../../design/mobile-flow-index.md) · [ตารางหน้าจอและ API](../../design/screen-route-matrix.md) · [DESIGN.md](../../../.stitch/DESIGN.md) · [Google Stitch](https://stitch.google.com/projects/9946906478898127464)

**สถานะเริ่มงาน** มี Expo prototype บน local แล้ว ใช้ session และ API เดิม เปิดคิวตรวจสลิปในแอดมินเดิมได้ และชุดทดสอบ Expo รอบก่อนผ่าน 2 เคส เฟรมฐาน `A01` ยังรอยืนยัน เกณฑ์รับงานของช่วง Expo และ Shell ยังเปิดอยู่ ให้รันทดสอบใหม่ก่อนลงมือ

## ข้อกำหนดร่วม

- ส่งออก Expo web build แบบ client-rendered ด้วย `npx expo export --platform web` ใช้ React Native primitives และ `StyleSheet` สำหรับ UI ร่วม และใช้โมดูล `.web.ts` หรือ `.web.tsx` สำหรับ Telegram, browser history, storage, clipboard, upload/download และ viewport ตามที่จำเป็น รอบนี้ทดสอบและส่งมอบเว็บ การ build และเผยแพร่แอป iOS/Android เป็นโครงการถัดไป [Expo Web](https://docs.expo.dev/workflow/web/) [Expo platform-specific modules](https://docs.expo.dev/router/advanced/platform-specific-modules/)
- ใช้ Fastify, `/admin/v1`, ฐานข้อมูล dev และกฎธุรกิจเดิม การทดสอบอัตโนมัติใช้ฐานข้อมูลแยกของชุดทดสอบ การเปลี่ยน API ต้องมีเหตุผลจากช่องว่างของหน้าจอและรักษาผู้เรียกเดิม รักษา origin checks, สิทธิ์เจ้าของร้าน, session cookie, CSRF, revision และ idempotency keys ตลอดการย้าย
- เก็บ path และ params เดิม รวมถึง `#/orders/:id`, `return_to`, ฟิลเตอร์ออเดอร์ และ URL ที่ Telegram ใช้เปิดรายละเอียด ใช้ตัวแปลง hash navigation ที่ยึดพฤติกรรมปัจจุบันในรอบแรก รักษา 4 เมนูล่าง, safe area, light mode และ breakpoint เดสก์ท็อป 1200 px [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- ทุกหน้าต้องเทียบกับ HTML/CSS และภาพ Stitch ที่ยืนยันรหัสแล้ว รักษาข้อความ ลำดับส่วน ไอคอน สี ระยะ ฟอนต์ มุมโค้ง และเงา รวมถึงข้อกำหนดล่าสุดของเจ้าของโปรเจกต์ ใช้ตารางหน้าจอเพื่อเลือกเฟรมมือถือและเดสก์ท็อป เวอร์ชันใหม่ของเฟรมหรือความขัดแย้งกับหน้าจอที่อนุมัติให้บันทึกก่อนลงมือในหน้านั้น
- เกณฑ์การใช้งานแบบแอปมือถือประกอบด้วยเมนูล่างที่แตะได้สะดวกและอยู่เหนือ safe area, การเปิดรายละเอียดและย้อนกลับโดยจำตำแหน่งเดิม, bottom sheet ตามเฟรม และการเคลื่อนไหวสั้นตาม DESIGN.md เมื่อเปิดคีย์บอร์ด ช่องกรอกและปุ่มหลักต้องยังใช้งานได้ เช่น ช่องพิมพ์และปุ่มส่งในแชท
- แยกงานย้ายเฟรมเวิร์กออกจากงานเพิ่มความสามารถของร้าน ตัวอย่างเช่น สถานะเคสกับสถานะอ่านเป็นคนละข้อมูล และเวลาเฉลี่ยตอบกลับต้องมีแหล่งข้อมูลก่อนเปิดใช้ ตรวจความต่างนี้พร้อมงาน Navbar และไอคอนแชทที่ค้างอยู่
- ให้น้ำหนักตามความซับซ้อนและความเสี่ยง เปอร์เซ็นต์นับเฉพาะช่วงที่ผ่านเกณฑ์ในแผน ประมาณการ **15–26 วันทำงานสำหรับนักพัฒนา 1 คน** ประเมินใหม่หลังพิสูจน์การเสิร์ฟ Expo บน Fastify และทดสอบบน Telegram จริง

## โครงไฟล์ที่เสนอ

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `admin-expo/` | Expo entry, config, lockfile ตามรูปแบบติดตั้งที่เลือก, web export และ asset manifest |
| `admin-expo/src/App.tsx`, `Chrome.tsx`, `theme.ts` | Auth shell, Navbar, bottom tabs และ token จากแบบ |
| `admin-expo/src/Overview.tsx`, `overview-data.ts` | หน้าภาพรวมและการอ่านข้อมูล `A01` ใช้เป็นจุดเริ่มต้นของรอบมือถือ |
| `admin-expo/src/platform/`, `features/` | ตำแหน่งเสนอเมื่อเริ่มย้ายหน้าถัดไป ใช้กับ Telegram, navigation, browser APIs และหน้าตาม Flow |
| `tests/miniapp/server.ts`, `src/admin/static.ts` | ตัวพรีวิวอยู่ที่เซิร์ฟเวอร์ทดสอบ กำหนดจุดเสิร์ฟจริงและสลับ build ในรอบส่งมอบ |
| `playwright.expo.config.ts`, `tests/miniapp-expo/`, `tests/miniapp/` | ตรวจ Expo และรุ่นเดิมบนข้อมูลทดสอบ ตรวจ DOM เฉพาะเมื่อเกี่ยวกับแบบหรือ accessibility |

นำสัญญา API และ logic ที่ทดสอบแล้วจาก `admin-ui/src/api.ts`, `order-navigation.ts`, hooks และ screen เดิมมาใช้ซ้ำเมื่อแยก dependency บน browser ได้ ให้ทั้งสอง UI อ้าง logic เดียวกันในจุดที่มีเงื่อนไขธุรกิจระหว่างช่วงย้าย

## งานตามลำดับ

### 1. พิสูจน์ build และ URL พรีวิว · 10% · 1–2 วัน

- [ ] บันทึกเส้นทางจริงจาก `App.tsx` และรายการลิงก์จาก Telegram เก็บ baseline Playwright, build size และภาพปัจจุบัน
- [ ] รัน export ของ prototype เดิม ตรวจ `/admin-app-expo/`, JS/CSS, ฟอนต์, รูป และ chunk ที่โหลดภายหลัง รวมถึง reload ลิงก์ตรง ใช้ `experiments.baseUrl` ที่ตั้งไว้และยืนยันจากไฟล์ export จริง [Expo app config](https://docs.expo.dev/versions/latest/config/app/#baseurl)
- [ ] ตรวจ Browser Console และ CSP จริงจาก `src/admin/static.ts` โดยเฉพาะการสร้าง stylesheet ของ RN Web, script ของ Telegram และการโหลดไฟล์แนบ หากติด CSP ให้พิสูจน์วิธี scoped ที่ใช้ได้จริงก่อนย้ายหน้าจำนวนมาก
- [ ] ผ่านเมื่อ build ทั้งสองเปิดบน origin เดียวกันได้ และพรีวิวใช้ API dev เดิมโดยมีคำตอบ 401 ตามปกติเมื่อยังไม่มีเซสชัน

### 2. ย้าย Shell และ session · Flow H · 10% · 1–2 วัน

- [ ] ย้าย loading, denied, expired, Navbar, bottom tabs, badges, global refresh และ offline state จาก `App.tsx`, `pull-refresh.tsx`, `use-navigation-counts.ts` และ `mobile-tab-icon.tsx`
- [x] ส่ง Telegram `initData` ไปให้ `POST /admin/v1/session` ตรวจบน server และใช้ `/me` ต่อเซสชัน Playwright ทดสอบการอนุญาตเจ้าของ การปฏิเสธผู้ไม่มีสิทธิ์ การยกเลิกเซสชัน การปฏิเสธ `initData` ที่ใช้ไปแล้ว และการเปิดใหม่ด้วย `initData` ใหม่ผ่าน API ทดสอบ
- [ ] ตรวจ Back และ viewport ผ่าน Telegram จริง และรักษา same-origin credentials และ CSRF ในคำสั่งเขียนเมื่อเริ่มย้ายหน้าที่มีการบันทึก
- [ ] เปิดพรีวิว dev ใน Telegram บน iPhone ตั้งแต่ช่วงนี้ ตรวจแตะสลับเมนู เปิดรายละเอียดแล้วกดย้อนกลับ และเปิดคีย์บอร์ดในช่องกรอกของหน้าที่ใช้ทดสอบ
- [ ] ผ่านเมื่อเจ้าของเปิดได้ ผู้ไม่มีสิทธิ์เห็นสถานะปฏิเสธ การกลับเข้าแอปยังอยู่เส้นทางเดิม และเมนูล่างไม่ทับ content หรือ keyboard

### 3. ย้ายหน้าภาพรวมมือถือ · Flow A01 · 8% · 1–2 วัน

**ไฟล์** `admin-expo/src/Overview.tsx`, `overview-data.ts`, `Chrome.tsx`, `theme.ts` และ `tests/miniapp-expo/overview.spec.ts`

- [ ] **A01 เฟรมฐาน** เลือกเฟรมหลักร่วมกับเจ้าของโปรเจกต์จาก [ดัชนี Flow](../../design/mobile-flow-index.md#a01-หน้าภาพรวมมือถือ) บันทึกรหัสเฟรม ลำดับส่วน Navbar ไอคอน และจุดที่ใช้เฟรมย่อย เลย์เอาต์ final เริ่มเมื่อยืนยันเฟรมแล้ว
- [ ] **A01.01a / A01.01b คิวมีสลิป** รันเคสคิวใน Playwright เทียบ `/orders?status=payment_review&include_mock=true` กับการ์ด แถบงานด่วน และทางลัด เลือกหนึ่งในสองภาพสำหรับสถานะเดียวกัน เมื่อแตะทางลัดต้องได้คิวที่กรองสถานะถูกต้อง
- [x] **A01 และ H คิวว่างกับการอ่านล้มเหลว** Playwright ตรวจ API ช้า, ยอด 0 จากฐานข้อมูลทดสอบ, 503 ตอนเริ่ม และ 503 หลังมียอดเดิม หน้าพรีวิวแจ้งเมื่อแสดงข้อมูลก่อนหน้าและเปิดรายการคิวเมื่อต้องตรวจยอดล่าสุด
- [x] **A01 และ C ยอดแชท** อ่าน `unread_chat_rooms` จาก `/navigation` เทียบกับรายการแชท เปิดอ่านหนึ่งห้องแล้วกลับมา Playwright ยืนยันว่าตัวเลขลดลงตามสถานะจาก API
- [x] **A01 ยอดรวมและออเดอร์ล่าสุด** ตรวจยอด USD กำไรขั้นต้น และออเดอร์สำเร็จกับ `/overview` Playwright ยืนยันว่าเมื่อข้อมูลต้นทุนไม่ครบจะแสดงขีดพร้อมข้อความอธิบาย เปิดออเดอร์ล่าสุดได้ตรงกับ API และปุ่มย้อนกลับพากลับมาที่ Expo บน local
- [ ] **หลักฐานรับงาน A01** รัน Expo build และ Playwright เก็บภาพ 390 px ตามรหัสเฟรมที่เลือก ตรวจ flow จริงที่ 360/375/390 px และเปิดผ่าน Telegram dev บน iPhone ตรวจ safe area, เมนูล่าง และปุ่มย้อนกลับ

งาน A01 ใช้เส้นทาง `/` เดียวในทุกสถานะ รุ่นพรีวิวเปิดหน้าปลายทางผ่านแอดมินเดิม การทดสอบ Chromium ที่ 390 px พบว่าทางลัด A01 → ออเดอร์โหลดเอกสาร `/admin-app/` ใหม่ ส่วนสลับแท็บภายในแอดมินเดิมใช้เอกสารเดิม เมื่อย้าย Flow B ให้ตรวจทาง A01 → ออเดอร์ → ย้อนกลับใน Expo และตรวจว่าเปลี่ยนหน้าโดยไม่โหลดเอกสารใหม่

ตรวจพรีวิว Expo บน local ที่ 360/375/390 px และเก็บภาพสถานะข้อมูลเดิมที่ `artifacts/expo-a01/a01-stale-390.png` ชุดทดสอบ Expo ผ่าน 8 เคส รวมการยืนยันเซสชัน ฐานข้อมูลทดสอบสร้างขึ้นแยกและทำรายการผ่าน API จริง ปุ่มย้อนกลับจากหน้ารายละเอียดใช้ประวัติเดิมเมื่อเปิดจาก Expo บน origin เดียวกันในพรีวิว local ความตรงกับเฟรมฐานและการใช้งานผ่าน Telegram บน iPhone อยู่ในเกณฑ์รับงานถัดไป

### 4. ย้ายออเดอร์และสลิปมือถือ · Flow B และ D · 20% · 3–5 วัน

- [ ] ย้าย `/orders`, `/orders/:id`, รายละเอียดกิจกรรม, viewer รูป/PDF และ sheet แจ้งปัญหาจาก `orders.tsx`, `order-workspace.tsx`, `receipts.tsx` และ order components เฟรมหลัก `79e6a382460b44b69a44a657a39c0666`, `ce52fcf417844c76bc6e840aa8cee3aa`, `0e7532b364404d7ca7d36022c80c8b61`
- [ ] รักษาฟิลเตอร์, cursor, scroll ตอนกดย้อนกลับ, UID copy, ปุ่มตามสถานะ, ตรวจสลิป/เปิดใหม่ และ batch ที่ข้ามงานขัดแย้งเป็นรายออเดอร์ ตรวจ expiry 15 นาทีและเงื่อนไขแจ้ง Telegram เมื่อสำเร็จด้วย backend เดิม
- [ ] ผ่านเมื่อทำชุดงานรับชำระ → รับงาน → เติมสำเร็จ และกรณี fail/retry ผ่าน API จริงใน dev fixture พร้อมตรวจว่า 409 หรือ timeout ไม่อนุมัติซ้ำ รักษาคำสั่งบันทึกสถานะคืนเงินที่มีอยู่ของ Flow D

### 5. ย้ายแชทและโปรไฟล์มือถือ · Flow C · 15% · 2–3 วัน

- [ ] ย้าย `/chats`, `/chats/:id`, `/customers/:id` จาก `chat-list.tsx`, `chats.tsx` และ ChatCard ใช้เฟรม `62738ab1d11d4ed389259548d612189d`, `437e4d2539c544c08294739d89c7d6b8`, `cfdddd9508d14eefabde4eb855a78b86` ตามลำดับ ตรวจ Navbar, รูปโปรไฟล์, ป้ายและไอคอนที่ค้างเทียบ
- [ ] รักษาการค้นหาด้วยชื่อ/UID/เลขออเดอร์, ยอดไม่อ่านและตัวกรอง, draft ต่อห้อง, public/internal, upload/download, ประวัติย้อนหลัง, การ retry และโปรไฟล์ที่ผูกกับลูกค้าแต่ละราย
- [ ] ผ่านเมื่อทดสอบ buyer ส่งข้อความผ่าน API จริงในฐานข้อมูลทดสอบ แอดมินอ่านแล้วทุกป้ายลดหนึ่ง ตอบพร้อมไฟล์ได้ บันทึกภายในอยู่เฉพาะแอดมิน และกลับหน้าแชทโดยรักษาคำค้น

### 6. ย้ายเกมและแพ็กเกจมือถือ · Flow E · 12% · 2–3 วัน

- [ ] ย้าย `/store/games`, `/store/products`, `/store/products?game=…`, `/store/products/new`, `/store/products/:id` และ `compare=1` จาก `products.tsx` ตรวจกริดไอคอนจริง ไอคอนเงินในเกม รูปแพ็กเกจและเกมที่ไม่มีแพ็กเกจตามข้อกำหนดล่าสุด
- [ ] ตรวจเกม/โซนแยกกัน, เปิดปิด, ค้นหา, เปรียบเทียบแหล่งต้นทาง, preview ราคา, ยืนยัน mapping, draft/publish และ revision conflict เฟรมแพ็กเกจที่ทำเครื่องหมายลบไว้ในตารางหน้าจอใช้ไม่ได้เป็นหลักรับงาน
- [ ] ผ่านเมื่อเปิดเกมแล้วเห็นเฉพาะแพ็กเกจของเกมนั้น เกมที่ไม่มีแพ็กเกจได้สถานะว่าง ทดลองบันทึก draft แล้วโหลดซ้ำจาก API และทำกรณีบันทึกพร้อมกันได้

### 7. ย้ายหน้าจัดการร้านที่เหลือ · Flow E และส่วนที่ใช้อยู่ของ F/G · 10% · 2–3 วัน

- [ ] ย้าย `/store`, `/store/sources`, `/store/fx`, `/store/pricing`, `/store/settings`, `/store/audit`, `/store/backups` จาก `store-hub.tsx`, `store.tsx`, `sources.tsx`, `settings.tsx` ใช้เฟรม Store Hub `a9ced3410a704fafb2b7ce477cea473a`, FX `7ebcfbe2add64b5dae320132d7c771e9` และ Audit `564601d87a844501a3d32a7e0115b509`
- [ ] ผ่านเมื่อเปิด/ปิดและ sync ซัพพลายเออร์, preview FX และบันทึกโหมดจริง, บันทึกการตั้งค่าราคา, ดูประวัติและสถานะ backup ได้ ตรวจกรณี read fail, stale revision และ restore บนฐานข้อมูลทดสอบแยกตามเครื่องมือเดิม

### 8. ตรวจและย้าย Desktop Web ให้ครบ · 10% · 2–4 วัน

- [ ] ย้าย sidebar, global search, overview chart และ CSV, order list/detail แบบสองคอลัมน์ และ support desk แบบหลายคอลัมน์จาก `overview-desktop.tsx`, `order-workspace.tsx`, `chats.tsx` และ desktop views ของ catalog/store ใช้เฟรม desktop ที่ผูกกับเส้นทางเดียวกัน
- [ ] ผ่านเมื่อเทียบที่ 1280 และ 1440 px ตรวจจุดเปลี่ยนที่ 1199/1200 px และคง keyboard, routing, search, การรักษาตำแหน่ง list เมื่อเปิดรายละเอียด รวมถึงดาวน์โหลด CSV/PDF

### 9. ทดสอบทั้งระบบและเตรียมสลับรุ่น · 5% · 1–2 วัน

- [ ] รัน `npm test`, `npm run check`, `npm run check:admin`, Expo typecheck/export และ Playwright regression เต็มชุดสำหรับ candidate นำรายการเส้นทางและผลทดสอบของ build ปัจจุบันมาเทียบ
- [ ] ถ่ายภาพที่ขนาดเดียวกับ Stitch และรัน sweep ที่ 360/375/390 px บันทึกส่วนที่ต่างและเหตุผล ตรวจ Telegram Mini App บน iPhone และ Android จริงอย่างน้อยอย่างละหนึ่งเครื่อง โดยเฉพาะ owner login, ลิงก์ตรง, สลิป, กล้องหรือไฟล์แนบ, keyboard, safe area, Back และ reconnect
- [ ] ทดลองสลับ build บน dev และซ้อม rollback ด้วย artifact ของรุ่น Vite ตามที่เก็บไว้ ตรวจเมนูบอต ลิงก์ออเดอร์และแคชหลังสลับ URL จริง เดินเส้นทางสำคัญซ้ำบน `/admin-app/` ก่อนส่งผลรับงาน ขึ้น production หลังยืนยันเท่านั้น

## สถานะ A01 ที่ต้องมีข้อมูลเพิ่ม

| รหัส | งานที่ต้องผ่านก่อนนำไปแสดง |
| --- | --- |
| `A01.02` | Flow B ส่งผลตรวจชื่อผู้โอนที่ผูกกับสลิปของออเดอร์นั้น |
| `A01.03a/b` | Flow D ยืนยันเหตุการณ์คืนเงินที่สัมพันธ์กับออเดอร์ดังกล่าว การแสดงยอดสลิป 0 ทดสอบได้เลย |
| `A01.04–05` | Flow C ส่งยอดเคสเปิดแยกจากยอดห้องยังไม่อ่าน แสดง Zero Queue เมื่อยอดคิวสลิปและเคสเปิดเป็น 0 ครบทั้งคู่ |
| `A01.06–07` | Flow G มีผลกู้คืนและ Revert ที่บันทึกสำเร็จ พร้อมเวลาและเกตเวย์ที่ใช้อยู่ |
| `A01.08a–c` | Flow F มีสถานะปิดรอบ กระทบยอด และไฟล์ส่งออกตามเฟรมที่เลือก |

ฟังก์ชันใหม่ของ Flow A, C, D, F และ G เช่น ศูนย์แจ้งเตือน เคสแชท ใบลดหนี้ ปิดรอบ และสลับเกตเวย์ ต้องประเมินหลังตกลงสัญญาข้อมูลกับ backend เวลา 15–26 วันและน้ำหนัก 100% ในแผนข้างบนคิดเฉพาะการย้ายความสามารถที่ใช้งานอยู่

## คำสั่งตรวจ A01

```powershell
npm run check --prefix admin-expo
npm run build --prefix admin-expo
npm run build:admin
npm exec -- playwright test -c playwright.expo.config.ts
```

## หลักฐานรับงาน

- ทุกช่วงบันทึก route, รหัสเฟรม, ภาพเทียบ, เวอร์ชัน build, คำสั่งทดสอบ และเคสที่ยังติดข้อจำกัด ผลผ่าน Chromium กับ Telegram บนมือถือจริงบันทึกแยกกัน
- ตรวจ reload จากลิงก์เข้ารายละเอียด, session หมดระหว่างส่ง POST, เคาะปุ่มซ้ำหรือ response สูญหาย, API อ่านไม่ได้และกลับมาได้, เปลี่ยนห้องเร็วขณะไฟล์โหลด และ assets ค้างข้ามรุ่น
- การสลับรุ่นผ่านเมื่อ API และข้อมูลทั้งสองรุ่นใช้งานร่วมกันได้ ลิงก์เดิมยังถึงหน้าที่ตั้งใจ และซ้อมย้อนกลับด้วย build ก่อนหน้าได้โดยใช้ข้อมูลชุดเดียวกัน
