import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';
async function open(page:Page){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const key=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();p.set('hash',createHmac('sha256',key).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(p.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}
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
