# พรีวิวหน้าภาพรวม Squid first

รันจากโฟลเดอร์หลักของ repo ใน PowerShell

```powershell
npm ci --prefix admin-expo
npm run check --prefix admin-expo
npm run build --prefix admin-expo
npm run build:admin
$env:SQUID_DESIGN_PREVIEW_PORT='3121'
node --import tsx tests/miniapp/server.ts --design-preview --expo-overview
```

เปิดพรีวิว Expo ได้ที่ [หน้าภาพรวม Expo](http://localhost:3121/preview?ui=expo) และเปิดรุ่น React + Vite ได้ที่ [พรีวิวเดิม](http://localhost:3121/preview) หน้าภาพรวมอ่านข้อมูลผ่าน API เดียวกับรุ่นเดิมโดยใช้ฐานข้อมูลทดสอบในหน่วยความจำ ทางลัดไปยังหน้ารุ่นเดิมบน origin เดียวกัน

โค้ดพรีวิวนี้ใช้ตรวจการ build, การโหลดฟอนต์ และการเชื่อม API เฟรม `d5331699295f43b497b546a572dab403` ถูกยกเลิกเป็นแบบอ้างอิงของหน้าภาพรวม รอระบุเฟรมที่ใช้งานจริงก่อนตรวจรับหน้าตา

ทดสอบ build ทั้งสองรุ่นหลังสร้างไฟล์แล้วด้วย `npm exec -- playwright test -c playwright.expo.config.ts` โหมดนี้ทำงานบน loopback และใช้เซสชัน dev ที่สร้างโดยเซิร์ฟเวอร์ทดสอบ

ไอคอนใช้ฟอนต์ Material Symbols Outlined ของ Google แบบ subset ตาม [คู่มือ Material Symbols](https://developers.google.com/fonts/docs/material_symbols) และ [สัญญาอนุญาต](MATERIAL-SYMBOLS-LICENSE.txt)
