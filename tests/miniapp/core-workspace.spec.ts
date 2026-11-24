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
 await openWorkspace(page);
 await page.getByRole('switch',{name:'รวมรายการทดสอบ'}).click();
 await page.getByRole('button',{name:'เปิดคิวตรวจสลิป'}).click();
 await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
 const orders=(await (await page.request.get('/admin/v1/orders?status=payment_review')).json()).data;
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
 await openWorkspace(page);await page.goto('/admin-app/#/chats');
 await page.getByRole('button',{name:/^ยังไม่อ่าน/}).click();
 const unread=(await (await page.request.get('/admin/v1/customers')).json()).data.filter((c:{unread:number})=>c.unread>0);
 await expect(page.locator('.chat-card')).toHaveCount(unread.length);
 const card=page.locator('.chat-card').first();
 await expect(card.getByRole('button')).toHaveCount(1);
 await card.getByRole('link',{name:'รายละเอียดลูกค้า '+unread[0].username}).click();
 await expect(page).toHaveURL(/#\/customers\//);
 await page.goBack();
 await card.getByRole('button',{name:'เปิดแชทตอบกลับ'}).click();
 await expect(page.getByRole('heading',{name:unread[0].username,exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeHidden();
 await page.goto('/admin-app/#/store');
 await expect(page.getByRole('heading',{name:'สินค้าและต้นทุน'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'ระบบและความปลอดภัย'})).toBeVisible();
 await page.getByRole('button',{name:/อัตราแลกเปลี่ยน FX/}).click();
 await expect(page.getByRole('heading',{name:'อัตราแลกเปลี่ยน',exact:true})).toBeVisible();
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
