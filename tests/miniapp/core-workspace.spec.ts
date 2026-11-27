import {test, expect, type Page} from '@playwright/test';
import {createHmac, randomUUID} from 'node:crypto';

async function openWorkspace(page:Page) {
 const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const secret=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();
 fields.set('hash',createHmac('sha256',secret).update([...fields.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(fields.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');
 await expect(page.getByRole('heading',{name:'ภาพรวม'})).toBeVisible();
}

test('queue shortcuts open filtered orders and cards expose zone and UID',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 let releaseQueue!:()=>void;
 const queueReady=new Promise<void>(resolve=>{releaseQueue=resolve});
 await page.route('**/admin/v1/overview?*',async route=>{
  const response=await route.fetch();
  const overview=await response.json();
  await route.fulfill({response,json:{...overview,revenue_usd:123.45,outstanding:[{status:'payment_review',count:999}]}});
 });
 await page.route('**/admin/v1/orders?*',async route=>{
  const params=new URL(route.request().url()).searchParams;
  if(params.get('status')==='payment_review'&&params.get('limit')==='1')await queueReady;
  await route.continue();
 });
 await openWorkspace(page);
 const metric=page.locator('.stitch-pending strong');
 const urgent=page.locator('.stitch-urgent');
 const shortcut=page.getByRole('button',{name:'เปิดคิวตรวจสลิป'});
 try{
  await expect(page.getByText('$123.45',{exact:true})).toBeVisible();
  await expect(metric).toHaveText('—');
  await expect(urgent.getByText('คิวตรวจสลิป',{exact:true})).toBeVisible();
  await expect(shortcut.locator('.shortcut-count')).toHaveCount(0);
 }finally{releaseQueue()}
 const queue=(await (await page.request.get('/admin/v1/orders?status=payment_review&include_mock=true')).json());
 const orders=queue.data;
 const count=queue.counts.payment_review;
 expect(count).toBeGreaterThan(0);
 await expect(metric).toHaveText(String(count));
 await expect(urgent).toContainText(`สลิปรอตรวจ ${count} รายการ`);
 await expect(shortcut.locator('.shortcut-count')).toHaveText(String(count));
 await expect(page.locator('.overview-columns h2')).toHaveText([
  'ออเดอร์ล่าสุด','สถานะซัพพลายเออร์',
 ]);
 await shortcut.click();
 await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
 await expect(page.locator('.order-card')).toHaveCount(orders.length);
 const card=page.locator('.order-card').first();
 await expect(card).toContainText('TH');
 await card.getByRole('button',{name:'คัดลอก UID'}).click();
 await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(orders[0].details.player.UID);
 await expect(card.getByRole('status')).toHaveText('คัดลอก UID แล้ว');
});

test('failed orders read offers retry without claiming an empty result',async({page})=>{
 await openWorkspace(page);let fail=true;
 await page.route('**/admin/v1/orders?**',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/orders');
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByText('ยังไม่มีออเดอร์',{exact:true})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();
 const orders=(await (await page.request.get('/admin/v1/orders')).json()).data;
 await expect(page.locator('[data-order-id]')).toHaveCount(orders.length);
});

test('chat unread filter and grouped store links use existing routes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);await page.goto('/admin-app/#/chats');
 const related=page.locator('.chat-card').filter({hasText:'player3'}).locator('.chat-card-order');
 await expect(related).toHaveAttribute('href','#/orders/browser-order-3');
 await related.click();
 await expect(page.getByRole('heading',{name:'รายละเอียดออเดอร์'})).toBeVisible();
 await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect(page).toHaveURL(/#\/chats$/);
 await page.getByRole('button',{name:/^ยังไม่อ่าน/}).click();
 const customers=(await (await page.request.get('/admin/v1/customers')).json()).data;
 const unread=customers.filter((c:{unread:number})=>c.unread>0);
 await expect(page.locator('.chat-card')).toHaveCount(unread.length);
 if(!unread.length)await page.getByRole('button',{name:/^ทั้งหมด/}).click();
 const customer=(unread.length?unread:customers)[0];
 const card=page.locator('.chat-card').first();
 await expect(card.getByRole('button')).toHaveCount(1);
 await card.getByRole('link',{name:'รายละเอียดลูกค้า '+customer.username}).click();
 await expect(page).toHaveURL(/#\/customers\//);
 await page.goBack();
 await card.getByRole('button',{name:'เปิดแชทตอบกลับ'}).click();
 await expect(page.getByRole('heading',{name:customer.username,exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeHidden();
 await page.goto('/admin-app/#/store');
 await expect(page.getByRole('heading',{name:'สินค้าและต้นทุน'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'ระบบและความปลอดภัย'})).toBeVisible();
 await page.locator('.store-section').filter({has:page.getByRole('heading',{name:'สินค้าและต้นทุน'})}).getByRole('button',{name:/อัตราแลกเปลี่ยน FX/}).click();
 await expect(page.getByRole('heading',{name:'อัตราแลกเปลี่ยน',exact:true})).toBeVisible();
});

test('store summary keeps the FX mode and supplier sync state in separate cards',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);
 let fxMode='manual',secondSourceEnabled=false;
 await page.route('**/admin/v1/fx',route=>route.fulfill({json:{mode:fxMode,rate:{lak_per_usd:'22675.43'}}}));
 await page.route('**/admin/v1/sources',route=>route.fulfill({json:{data:[
  {id:'jorjee',name:'JorJee Game Store',enabled:true,last_success_at:'2026-11-26T08:15:00Z',last_run:{status:'failed',at:'2026-11-26T08:30:00Z'}},
  {id:'ggxg',name:'GGXG Store',enabled:secondSourceEnabled,last_success_at:null,last_run:{status:'running',at:'2026-11-26T08:31:00Z'}},
 ]}}));
 await page.goto('/admin-app/#/store');
 const summary=page.getByRole('region',{name:'สถานะซัพพลายเออร์และอัตราแลกเปลี่ยน'});
 await expect(summary.getByRole('button',{name:/อัตราแลกเปลี่ยน FX/})).toContainText('กำหนดเอง');
 await expect(summary.getByRole('button',{name:/สถานะการดึงข้อมูลซัพพลายเออร์/})).toContainText('ไม่สำเร็จ 1 ร้าน');
 await expect(summary.getByText('GGXG Store')).toHaveCount(0);
 fxMode='lfx';
 secondSourceEnabled=true;
 await summary.getByRole('button',{name:'รีเฟรชหน้าจอ'}).click();
 const sync=summary.getByRole('button',{name:/สถานะการดึงข้อมูลซัพพลายเออร์/});
 await expect(sync).toContainText('กำลังดึง 1 ร้าน');
 await expect(sync).toContainText('ไม่สำเร็จ 1 ร้าน');
 await expect(sync).toContainText('ดึงสำเร็จล่าสุด');
 await expect(summary.getByRole('button',{name:/อัตราแลกเปลี่ยน FX/})).toContainText('เรททางการ LFX');
 await expect(page.locator('.store-menu-item').filter({hasText:'อัตราแลกเปลี่ยน FX'})).toContainText('LFX อัตโนมัติ: 1 USD = 22,675.43 LAK');
 await expect(page.locator('.store-section h2')).toHaveText(['สินค้าและต้นทุน','ลูกค้าและยอดขาย','ระบบและความปลอดภัย']);
 await page.getByRole('button',{name:/รายงานยอดขายและกำไรขั้นต้น/}).click();
 await expect(page.getByRole('heading',{name:'ภาพรวม',level:1,exact:true})).toBeVisible();
});

test('supplier cards distinguish retained prices from a failed first sync',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openWorkspace(page);
 await page.route('**/admin/v1/sources',route=>route.fulfill({json:{data:[
  {id:'jorjee',name:'JorJee Game Store',url:'https://jorjeegamestore.com',enabled:true,revision:1,package_count:8,last_success_at:'2026-11-26T08:15:00Z',last_run:{status:'failed',at:'2026-11-27T08:16:00Z'}},
  {id:'ggxg',name:'GGXG Store',url:'https://www.ggxgstore.com',enabled:true,revision:1,package_count:0,last_success_at:null,last_run:{status:'failed',at:'2026-11-27T08:31:00Z'}},
 ]}}));
 await page.goto('/admin-app/#/store/sources');
 const cards=page.locator('.source-settings .panel');
 await expect(cards.filter({hasText:'JorJee Game Store'})).toContainText('ยังมีราคาจากรอบที่ดึงสำเร็จล่าสุด');
 await expect(cards.filter({hasText:'GGXG Store'})).toContainText('ยังไม่มีราคาจากการดึงข้อมูลสำเร็จ');
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('searchbox',{name:'ค้นหาร้านต้นทาง'}).fill('ggxgstore.com');
 const table=page.getByRole('table',{name:'รายชื่อซัพพลายเออร์'});
 await expect(table.getByRole('row')).toHaveCount(2);
 await expect(table.getByRole('row',{name:/GGXG Store/})).toContainText('www.ggxgstore.com');
});

test('approved primary and four menus fit mobile and web',async({page})=>{
 await openWorkspace(page);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase())).toBe('#2563eb');
 for(const width of [360,390,768,1280]){
  await page.setViewportSize({width,height:844});
  for(const route of ['','/orders','/chats','/store']){
   await page.goto('/admin-app/#'+route);
   await expect(page.locator('main h1')).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(4);
  }
 }
});
