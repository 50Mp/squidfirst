# Squid first — Game Top-Up Operations

หน้าแอดมิน React สำหรับ Web และ Telegram Mini App อยู่ที่ `/admin-app/` มี 4 เมนูหลัก: ภาพรวม ออเดอร์ แชทลูกค้า และจัดการร้าน ใช้ API และฐานข้อมูลร่วมกัน ธีมขาว–น้ำเงิน `#2563EB` รองรับมือถือและ Desktop ดู [วิธีเปิดและตั้งค่าแอดมิน](docs/admin-mini-app.md) และ [ขอบเขต UI รุ่นปัจจุบัน](docs/core-admin-implementation-2026-11-23.md)

```powershell
npm ci
npm run check
npm run check:admin
npm test
npm run build
npx playwright test
```

ชุดทดสอบเบราว์เซอร์ใช้ข้อมูลจำลองในหน่วยความจำ ไม่โหลด `.env` และไม่ส่ง Telegram จริง การเปิดหน้าแอดมินใช้งานปกติต้องยืนยันบัญชีเจ้าของร้านผ่าน Telegram ตามคู่มือ

ระบบออเดอร์ สลิป และแชทกับแอดมินผ่าน Telegram: ดู [คู่มือ API และการตั้งค่า](docs/orders-telegram.md) ตอนนี้เป็น backend; ยังไม่มีหน้าเว็บ checkout/chat สำหรับลูกค้า และยังไม่เปิดรับออเดอร์จริง ต้องตั้ง API_KEY เพื่อป้องกันข้อมูลต้นทุนของร้านก่อนเปิดเซิร์ฟเวอร์

ดึงแค็ตตาล็อกสาธารณะทั้งหมดจาก https://jorjeegamestore.com/ และดึง Mobile Legends กับ Free Fire จาก https://www.ggxgstore.com/ มาเก็บใน Database ของเรา แล้วเปิด read API โดยไม่ต้องดึงเว็บทุกครั้งที่เรียก API การซิงก์แค็ตตาล็อกจะเก็บรายการต้นทางและไม่มีผลให้แพ็กเกจเปิดขายอัตโนมัติ

เก็บทุกหน้าโซนของสองเกมที่พบจากรายการเกม GGXG โดยค้นหาลิงก์ใหม่ทุกรอบ แยกข้อมูลด้วย `source_id` + `game_id` + `variant_id` + ชื่อแพ็กเกจ ดังนั้นแม้ร้านเดียวมีสองหน้าสำหรับประเทศเดียวกันก็ไม่ทับกัน เก็บชื่อโซนและชื่อเกมตามร้านไว้ด้วย หากชื่อไม่ได้ระบุประเทศ ใช้ `zone=unspecified` และไม่เดาว่าเป็นโซนไทย

Node.js + TypeScript + Playwright + Fastify ใช้ PostgreSQL ภายนอกได้ และมี PGlite (PostgreSQL แบบ embedded) สำหรับทดลองในเครื่องโดยไม่ต้องติดตั้ง Docker

workspace นี้ย้ายข้อมูลเดิมไป PostgreSQL บน Docker แล้ว และ `.env` ชี้ไปที่ PostgreSQL ปัจจุบัน API ยังรันด้วย Node.js บนเครื่อง ใช้ `docker compose up -d db --wait` แล้ว `npm start` เพื่อเปิดใหม่ รายละเอียดสำรองและย้อนกลับอยู่ใน [บันทึกการย้าย Database](docs/postgres-migration.md) ส่วนคำแนะนำ PGlite ด้านล่างสำหรับเริ่มโปรเจกต์ใหม่ในโหมด embedded **อย่าคัดลอก .env.example ทับ .env ปัจจุบันหากต้องการใช้ PostgreSQL ที่ย้ายแล้วต่อ**

## เริ่มใช้ในเครื่อง (PowerShell, Node.js 24 LTS)

```powershell
npm ci
npx playwright install chromium
Copy-Item .env.example .env
npm run db:init
npm run dev
```

เมื่อเปิดเซิร์ฟเวอร์ด้วย `AUTO_SYNC=true` ระบบจะดึงข้อมูลร้านเกมและเรท LFX **เฉพาะ 15:00 ≤ เวลา < 16:00 ของทุกวัน ในโซน Asia/Vientiane (เวลาเดียวกับไทย UTC+07)** และอัปเดตทุก 15 นาทีหลังรอบก่อนจบ นอกเวลาจะรอเปิดช่วงถัดไป ไม่มีการดึงชดเชยนอกช่วง หากถึงเวลาปิดช่วงระหว่างดึงจะยกเลิกและเก็บข้อมูลเดิมไว้ API อ่านข้อมูลที่บันทึกไว้ได้ตลอดเวลา ต้องเปิดโปรเซสและเครื่องไว้ในช่วงดังกล่าว

Database เดิมใน workspace มีข้อมูล 237 แพ็กเกจแล้ว ถ้าใช้ Database ใหม่ว่าง ต้องรอ sync ในช่วงเวลาที่กำหนด หรือใช้ `npm run seed` ในช่วง 15:00–16:00 เพื่อนำเข้า 27 แพ็กเกจเริ่มต้นของ JorJee โดยคงวันที่ข้อมูลเดิม 18 พ.ย. 2026 คำสั่ง seed ปฏิเสธการเขียนทับ live data ตรวจ `data_origin` และ `last_success_at` **แยกร้าน** ที่ `/sources` เพื่อดูว่าได้ข้อมูลสดแล้วหรือยัง

Database อยู่ใน `data/catalog` และยังอยู่หลังปิดแอป **โหมด PGlite ให้เปิดเพียงหนึ่งโปรเซสต่อโฟลเดอร์ Database** หากเปิด API อยู่ ให้ใช้ AUTO_SYNC ในโปรเซสนั้น ปิด API ก่อนสั่ง `seed` หรือ `sync` ผ่าน CLI ห้ามเปิด `worker` พร้อม API บน PGlite เดียวกัน

[`catalog-snapshot.json`](catalog-snapshot.json) เป็นข้อมูลแค็ตตาล็อกที่ส่งออกจาก PostgreSQL ตามเวลา `exported_at` ในไฟล์ มีเกม ราคา LAK สินค้าร้าน และการจับคู่กับแพ็กเกจต้นทาง ใช้สำหรับตรวจรายการและอ้างอิงข้อมูล

## API

| Method | Path | ข้อมูล |
|---|---|---|
| GET | `/health` | ตรวจการเชื่อมต่อ Database |
| GET | `/status` | สถานะ JorJee และสถานะทุกร้านใน `sources` |
| GET | `/sources` | ทุกร้านพร้อมเวลาอัปเดตและแหล่งข้อมูล `seed` / `live` |
| GET | `/exchange-rates/usd-lak` | เรท LFX ที่เก็บจากช่วง 15:00–16:00 พร้อมที่มา/เวลาที่ดึง |
| GET | `/games` | เกมและจำนวนแพ็กเกจที่ใช้งานอยู่ |
| GET | `/games/mobile-legends-bang-bang/packages` | แพ็กเกจ Mobile Legends |
| GET | `/games/free-fire/packages` | แพ็กเกจ Free Fire ทุกโซน ทุกร้าน |
| GET | `/games/mobile-legends-bang-bang/variants` | หน้าเกม/โซนทั้งหมดของ Mobile Legends |
| GET | `/games/free-fire/variants` | หน้าเกม/โซนทั้งหมดของ Free Fire |

ตัวกรองใช้ร่วมกันได้: `source=jorjee` หรือ `source=ggxg`, `zone=indonesia`, `variant=<variant_id>`, `currency=USD|LAK` และ `includeInactive=true` เพื่อดูแพ็กเกจที่หายไปจากต้นทางด้วย `variant` ต้อง URL-encode หากมีช่องว่างหรืออักขระพิเศษ ค่าเริ่มต้นของ API คือ **USD** ส่วนราคาเดิมยังเก็บเป็นจำนวนเต็มกีบลาว (LAK) ใน Database และส่งกลับใน `original_price` / `original_currency` เส้นทาง `/games/free-fire-th/packages` ยังคงใช้ได้เป็น alias กรอง `zone=th`

## การแปลง USD ด้วย LFX

- ใช้เฉพาะ USD ในช่อง `15:00 - 16:00` จาก [ข้อมูล Final ที่ widget ของ LFX ใช้](https://opensheet.elk.sh/1eZzb1MsF2CKsReLPX4bv7Ph7jcLhMnyxakdOysLrwAw/Final) บน [เว็บไซต์ LFX](https://www.lfx.com.la/) ไม่ใช้เรทรายวันหรือช่องเวลาอื่นแทน
- สูตร `USD = LAK / lak_per_usd` เป็นราคาอ้างอิงตามเรทแนะนำ ไม่มีค่าธรรมเนียม ใช้ integer arithmetic และปัด half-up สองตำแหน่ง ส่งราคา USD เป็น decimal string
- บันทึกเรทและ raw row แยกต่างหาก พร้อม source URL และ `fetched_at` ไม่เขียนทับราคา LAK เดิม
- **แหล่งข้อมูลไม่มีวันที่ประกาศ** จึงส่ง `published_date=null` และ `publication_date_known=false` เสมอ `fetched_at` และ `retrieval_age_seconds` คือเวลาที่เราเก็บและอายุการเก็บ ไม่ยืนยันว่าเป็นเรทที่ประกาศของวันนี้
- ถ้ายังไม่มีเรทที่เก็บในช่วงที่อนุญาต จะคืน `price=null`, `currency="USD"`, `conversion_status="unavailable"` เมื่อดึงเรทสำเร็จจะเป็น `available` พร้อม `exchange_rate` ข้อมูลเรทเดิมใช้ต่อได้ในช่วงนอกเวลาหรือเมื่อรอบใหม่ล้มเหลว โดยแนบอายุการเก็บให้เห็น
- หากต้องการราคาเดิม ใช้ `?currency=LAK` ซึ่งใช้งานได้แม้ยังไม่มีเรท
- ผู้ใช้ส่งภาพเรทช่วง 15:00–16:00 และสั่งใช้คำนวณได้ทันที โดยเก็บแยกเป็น `provenance=user_provided`, `provided_at` และหลักฐานภาพ ไม่มีการอ้างว่าดึงเว็บในช่วงเวลาที่อนุญาต (`fetched_at=null`, `published_date=null`) ราคาทั้งหมดจะใช้เรทนี้จนกว่าจะมีเรทที่บันทึกใหม่กว่า ภาพที่ใช้เริ่มต้นอยู่ใน `evidence/lfx-usd-1500-1600.png`: 1 USD = 22,688.45 LAK ส่วน -0.39% เป็นค่าการเปลี่ยนแปลง ไม่ใช่ส่วนลดที่ต้องหักเพิ่ม
- นำเข้าเรทที่ผู้ใช้ระบุผ่าน CLI ได้ด้วย `npm run fx:reference -- 22688.45 evidence/lfx-usd-1500-1600.png` ให้ปิด API ก่อนเมื่อใช้ PGlite คำสั่งนี้ไม่เรียกเว็บ การดึงอัตโนมัติยังคงจำกัดช่วง 15:00–16:00 ตามเดิม
- `npm run fx:sync` ดึงเฉพาะเรท และ `npm run sync` ดึงเรทพร้อมร้านเกม ทั้ง CLI และ worker เคารพช่วงเวลาเดียวกัน นอกเวลาจะรายงาน `skipped` โดยไม่เรียกเว็บ

ข้อมูลใน response ใช้เปรียบเทียบต่อได้ แต่ระบบ **ไม่รวมแพ็กเกจคนละร้านเป็นสินค้าตัวเดียวกันโดยเดาจากชื่อหรือยอดเพชรรวม** เพราะโบนัสแรกเติม, pass, combo, ประเทศ และเงื่อนไขอาจต่างกัน ต้องยืนยันการจับคู่แพ็กเกจก่อนสรุปว่าร้านใดถูกกว่า

```powershell
Invoke-RestMethod http://127.0.0.1:3000/games
Invoke-RestMethod http://127.0.0.1:3000/games/free-fire/packages
Invoke-RestMethod 'http://127.0.0.1:3000/games/free-fire/packages?currency=LAK'
Invoke-RestMethod 'http://127.0.0.1:3000/games/mobile-legends-bang-bang/packages?source=ggxg&zone=indonesia'
```

ตัวอย่างข้อมูลใน `data` เมื่อยังไม่มีเรทที่เก็บได้ตามช่วงเวลาที่กำหนด:

```json
{
  "id": "stable-package-id",
  "game_id": "free-fire",
  "source_id": "jorjee",
  "variant_id": "default",
  "zone": "th",
  "source_game_name": "Free Fire (TH)",
  "source_url": "https://jorjeegamestore.com/",
  "name": "30+3 Diamonds",
  "note": "",
  "price": null,
  "currency": "USD",
  "original_price": 8000,
  "original_currency": "LAK",
  "active": true,
  "observed_at": "2026-11-18T00:00:00.000Z"
}
```

ตั้ง `API_KEY` ใน `.env` เพื่อบังคับ header `x-api-key` (ยกเว้น `/health`):

```powershell
Invoke-RestMethod http://127.0.0.1:3000/games -Headers @{ 'x-api-key' = 'your-key' }
```

API ฟังบน localhost ตามค่าเริ่มต้น หากเปิดใช้งานจากภายนอกให้ตั้ง key, ใช้ HTTPS ผ่าน reverse proxy และกำหนด HOST ตามระบบที่นำไปรัน ไม่มี endpoint สำหรับสั่งซื้อ เติมเกม หรือรับ URL ใด ๆ มาดึงข้อมูล

## ใช้ PostgreSQL ของคุณ

1. สร้าง Database ว่าง หรือใช้ Docker Compose ที่ให้มา (ต้องติดตั้ง Docker เอง)
2. ตั้งค่า `.env` เช่น:

```dotenv
DATABASE_URL=postgresql://catalog:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/catalog
POSTGRES_PASSWORD=YOUR_PASSWORD
AUTO_SYNC=false
API_KEY=YOUR_API_KEY
```

3. หากใช้ Compose: `docker compose up -d db` จากนั้นรัน:

```powershell
npm run db:init
npm run sync
npm run build
npm start
```

4. เปิดอีก terminal รัน `npm run worker` เพื่ออัปเดตอัตโนมัติ หรือใช้ process manager ของคุณคุม API และ worker หลังเครื่องรีสตาร์ต ในโหมด PostgreSQL สองโปรเซสใช้ Database เดียวกันได้ `AUTO_SYNC=false` ป้องกันการตั้งงานซ้ำกับ worker

ข้อมูลจาก PGlite ไม่ย้ายไป Database ใหม่เอง ให้สั่ง `sync` เพื่อดึงข้อมูลใหม่เข้าปลายทางที่ตั้งค่าไว้ ถ้าใช้ PostgreSQL ระยะไกล ตั้งค่า TLS ตามผู้ให้บริการผ่าน connection string

## พฤติกรรมการอัปเดต

- อ่านแพ็กเกจที่แสดงสาธารณะทั้งสองเกม ทุกหน้าโซนที่ร้านแสดง โดยไม่กรอก UID หรือสร้างธุรกรรม

- ลองใหม่ไม่เกิน 3 ครั้งต่อเกม มี timeout และหน่วงก่อน retry
- ตรวจชื่อ ราคา สกุลเงิน รายการซ้ำ และต้องมีข้อมูลทั้งสองเกม ก่อนเริ่มเขียน หาก GGXG มีหน้าโซนใดดึงไม่สำเร็จ จะไม่เขียน snapshot ใหม่ของร้านนั้น
- บันทึก snapshot **ต่อร้าน** ใน transaction เดียว หากล้มเหลว rollback เก็บข้อมูลเดิมของร้านนั้น และอีกร้านยังอัปเดตได้
- ID คงเดิมตามร้าน เกม หน้าโซน และชื่อแพ็กเกจ อัปเดตราคาแทนการเพิ่มซ้ำ ชื่อเปลี่ยนถือเป็นแพ็กเกจใหม่
- รายการที่หายไปเปลี่ยนเป็น inactive; ถ้ากลับมา ID เดิมจะ active อีกครั้ง
- ไม่ให้ข้อมูลเก่าหรือ seed เขียนทับข้อมูล live
- worker รอรอบเดิมจบก่อนเริ่มนับเวลารอบถัดไป และทำงานเฉพาะ 15:00–16:00 โดยมีการตรวจเวลาก่อนดึงและก่อน commit การเขียนจากหลาย worker ใช้ row lock แยกร้าน และปฏิเสธ snapshot ที่เก่ากว่ารอบล่าสุด
- เมื่อเว็บเปลี่ยนโครงสร้าง อาจต้องแก้ selector ใน `src/scraper.ts` การตรวจรูปแบบช่วยจับข้อมูลผิด แต่ไม่รับประกันตรวจพบกรณีต้นทางแสดงรายการที่ถูกต้องเพียงบางส่วน

## คำสั่งตรวจสอบ

```powershell
npm test
npm run check
npm run build
```

Tests ใช้ PostgreSQL embedded แบบ in-memory จริง ตรวจข้อมูลผิด, upsert, inactive, rollback, seed guard, USD conversion, schedule boundaries และ API ไม่ต้องใช้เว็บต้นทาง ส่วนการทดสอบดึงเว็บจริงใช้ `npm run sync` ในช่วงเวลาที่กำหนดแยกต่างหาก ตัวเลขเรทใน tests เป็น fixture ไม่ใช่เรทที่นำเข้า Database ใช้งานจริง

ดึงเฉพาะร้าน: `npm run sync -- jorjee` หรือ `npm run sync -- ggxg` คำสั่ง `npm run sync` ดึงทุกร้าน หากบางร้านล้มเหลว จะบันทึกร้านที่สำเร็จและคืน exit code 1

ให้กระบวนการรอรอบซิงก์ถัดไปและรันครั้งเดียวด้วย `npm run sync -- jorjee --next-window` โดยเปิดโปรเซสไว้จนกว่าจะซิงก์เสร็จ

อ้างอิง: [Playwright](https://playwright.dev/docs/library), [Fastify](https://fastify.dev/docs/latest/Guides/Getting-Started/), [node-postgres transactions](https://node-postgres.com/features/transactions)
