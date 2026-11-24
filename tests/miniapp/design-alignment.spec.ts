import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';
async function open(page:Page){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const key=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();p.set('hash',createHmac('sha256',key).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(p.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}
test('approved iOS light design system is the final UI contract',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 const contract=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement),body=getComputedStyle(document.body);
  const panel=document.querySelector<HTMLElement>('.panel')!;
  const panelStyle=getComputedStyle(panel);
  const navigation=document.querySelector<HTMLElement>('.sidebar nav button')!;
  const navigationRect=navigation.getBoundingClientRect();
  return {
   tokens:{
    primary:root.getPropertyValue('--sf-primary').trim().toLowerCase(),
    primaryPressed:root.getPropertyValue('--sf-primary-pressed').trim().toLowerCase(),
    canvas:root.getPropertyValue('--sf-canvas').trim().toLowerCase(),
    surface:root.getPropertyValue('--sf-surface').trim().toLowerCase(),
    quietSurface:root.getPropertyValue('--sf-surface-quiet').trim().toLowerCase(),
    text:root.getPropertyValue('--sf-text').trim().toLowerCase(),
    secondaryText:root.getPropertyValue('--sf-text-secondary').trim().toLowerCase(),
    separator:root.getPropertyValue('--sf-separator').trim().toLowerCase(),
    success:root.getPropertyValue('--sf-success').trim().toLowerCase(),
    warning:root.getPropertyValue('--sf-warning').trim().toLowerCase(),
    danger:root.getPropertyValue('--sf-danger').trim().toLowerCase(),
   },
   colorScheme:root.colorScheme,
   bodyBackground:body.backgroundColor,
   panel:{background:panelStyle.backgroundColor,borderWidth:panelStyle.borderTopWidth,shadow:panelStyle.boxShadow,radius:panelStyle.borderRadius},
   navigation:{width:navigationRect.width,height:navigationRect.height},
   overflows:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  };
 });
 expect(contract.tokens).toEqual({
  primary:'#2563eb',primaryPressed:'#1d4ed8',canvas:'#f8fafc',surface:'#fff',quietSurface:'#f1f5f9',
  text:'#0f172a',secondaryText:'#64748b',separator:'#e2e8f0',success:'#10b981',warning:'#f59e0b',danger:'#dc2626',
 });
 expect(contract.colorScheme).toBe('light');
 expect(contract.bodyBackground).toBe('rgb(248, 250, 252)');
 expect(contract.panel).toEqual({background:'rgb(255, 255, 255)',borderWidth:'0px',shadow:'none',radius:'16px'});
 expect(contract.navigation.width).toBeGreaterThanOrEqual(44);
 expect(contract.navigation.height).toBeGreaterThanOrEqual(44);
 expect(contract.overflows).toBe(false);
});
test('test-data controls and orders never expose the internal mock term',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await expect(page.getByRole('switch',{name:'รวมรายการทดสอบ'})).toBeVisible();
 await page.getByRole('switch',{name:'รวมรายการทดสอบ'}).check();
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
 await page.goto('/admin-app/#/orders');
 await expect(page.getByRole('switch',{name:'รวมรายการทดสอบ'})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
 await page.locator('.order-card').first().click();
 await expect(page.getByText('ออเดอร์ทดสอบ ไม่ต้องโอนเงินจริงหรือเติมเกมจริง')).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
});
test('order cards use a game icon instead of a letter abbreviation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.goto('/admin-app/#/orders');
 const cardMark=page.locator('.order-card').first().locator('.game-mark');
 await expect(cardMark.locator('svg')).toBeVisible();await expect(cardMark).not.toHaveText(/^(FF|ML)$/);
 await page.locator('.order-card').first().click();
 const detailMark=page.locator('.detail-game .game-mark');
 await expect(detailMark.locator('svg')).toBeVisible();await expect(detailMark).not.toHaveText(/^(FF|ML)$/);
});
test('FX local example follows the selected draft rate without saving it',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);const before=(await (await page.request.get('/admin/v1/fx')).json()).rate;
 await page.goto('/admin-app/#/store/fx');await page.getByRole('radio',{name:'กำหนดเอง',exact:false}).check();await page.getByLabel('เรท LAK ต่อ USD').fill('22675.43');
 await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).toContainText('226,754.30 LAK');await page.getByRole('button',{name:'ทดลอง $20',exact:true}).click();
 await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).toContainText('453,508.60 LAK');
 expect((await (await page.request.get('/admin/v1/fx')).json()).rate).toEqual(before);
 await page.screenshot({path:'artifacts/fx-example-mobile.png',fullPage:true});
});
test('public and internal chat choices are visible and preserve the current draft',async({page})=>{
 await page.setViewportSize({width:360,height:450});await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];await page.goto('/admin-app/#/chats/'+c.id);
 await page.getByLabel('ข้อความแชท').fill('ร่างทดสอบ');await expect(page.getByRole('radio',{name:'ตอบลูกค้า',exact:true})).toBeChecked();
 await page.getByRole('radio',{name:'บันทึกภายใน · ลูกค้าไม่เห็น',exact:true}).check();await expect(page.getByLabel('ข้อความแชท')).toHaveValue('ร่างทดสอบ');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('button[aria-label="ส่งข้อความ"]')!.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
 await page.screenshot({path:'artifacts/chat-mode-short-mobile.png'});
});

test('private draft stays private after leaving and returning to its customer',async({page})=>{
 await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];await page.goto('/admin-app/#/chats/'+c.id);
 await page.getByRole('radio',{name:'บันทึกภายใน · ลูกค้าไม่เห็น',exact:true}).check();await page.getByLabel('ข้อความแชท').fill('private return draft');await page.getByRole('button',{name:'ย้อนกลับไปแชท'}).click();await expect(page.getByLabel('ค้นหาลูกค้า')).toBeVisible();await page.goto('/admin-app/#/chats/'+c.id);
 await expect(page.getByRole('radio',{name:'บันทึกภายใน · ลูกค้าไม่เห็น',exact:true})).toBeChecked();await page.getByLabel('ข้อความแชท').press('Enter');await expect(page.locator('.bubble.internal').getByText('private return draft',{exact:true})).toBeVisible();
});
test('failed chat history does not claim a new conversation',async({page})=>{
 await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];await page.route('**/admin/v1/customers/*/chat',r=>r.fulfill({status:503,json:{error:'unavailable'}}));await page.goto('/admin-app/#/chats/'+c.id);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('เริ่มบทสนทนา',{exact:true})).toHaveCount(0);
});
test('chat queue search survives room navigation and reload',async({page})=>{
 await open(page);await page.goto('/admin-app/#/chats');await page.getByLabel('ค้นหาลูกค้า').fill('player2');await page.locator('.chat-card').first().getByRole('button',{name:'เปิดแชทตอบกลับ'}).click();await page.getByRole('button',{name:'ย้อนกลับไปแชท'}).click();await expect(page.getByLabel('ค้นหาลูกค้า')).toHaveValue('player2');await page.reload();await expect(page.getByLabel('ค้นหาลูกค้า')).toHaveValue('player2');
});
test('switching to unsaved LFX mode never previews the persisted manual rate',async({page})=>{
 await open(page);await page.route('**/admin/v1/fx',r=>r.fulfill({json:{mode:'manual',revision:1,rate:{lak_per_usd:'99999'}}}));await page.goto('/admin-app/#/store/fx');await page.getByRole('radio',{name:'อัตโนมัติจาก LFX',exact:false}).check();await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).not.toContainText('999,990');
});
test('pending send prevents typing a draft that its response would clear',async({page})=>{
 await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];await page.goto('/admin-app/#/chats/'+c.id);await expect(page.getByLabel('ข้อความแชท')).toBeVisible();
 let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);await page.route('**/admin/v1/customers/*/chat',async r=>{if(r.request().method()==='POST')await hold;await r.continue();});
 await page.getByLabel('ข้อความแชท').fill('slow reply');await page.getByRole('button',{name:'ส่งข้อความ'}).click();try{await expect(page.getByLabel('ข้อความแชท')).toBeDisabled();}finally{release();}await expect(page.getByLabel('ข้อความแชท')).toBeEnabled();
});

test('expired browser session locks admin screens and fresh Telegram bootstrap restores access',async({page,context})=>{
 await open(page);await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeVisible();
 await context.clearCookies();await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));
 await expect(page.getByRole('alert')).toContainText('เซสชันหมดอายุ');await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toHaveCount(0);
 expect((await page.request.get('/admin/v1/orders')).status()).toBe(401);
 await open(page);await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeVisible();expect((await page.request.get('/admin/v1/orders')).status()).toBe(200);
});
