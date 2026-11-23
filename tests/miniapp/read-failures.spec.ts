import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';

async function open(page:Page){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const secret=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();
 p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(p.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}

test('FX initial failure hides write controls and retry restores the loaded settings',async({page})=>{
 await open(page);let fail=true,writes=0;
 await page.route('**/admin/v1/fx',r=>{if(r.request().method()==='PATCH')writes++;return fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue();});
 await page.goto('/admin-app/#/store/fx');await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('button',{name:'บันทึกอัตราแลกเปลี่ยน'})).toHaveCount(0);
 await expect(page.getByRole('radio',{name:'กำหนดเอง',exact:false})).toHaveCount(0);
 expect(writes).toBe(0);fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();
 await expect(page.getByRole('radio',{name:'กำหนดเอง',exact:false})).toBeVisible();
 await page.getByRole('radio',{name:'กำหนดเอง',exact:false}).check();await page.getByLabel('เรท LAK ต่อ USD').fill('23123');
 await expect(page.getByRole('button',{name:'บันทึกอัตราแลกเปลี่ยน'})).toBeEnabled();
});

test('FX refresh failure keeps the draft but prevents saving stale settings until retry',async({page})=>{
 await open(page);let fail=false;
 await page.route('**/admin/v1/fx',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/store/fx');await page.getByRole('radio',{name:'กำหนดเอง',exact:false}).check();await page.getByLabel('เรท LAK ต่อ USD').fill('23234');
 fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByLabel('เรท LAK ต่อ USD')).toHaveValue('23234');await expect(page.getByRole('button',{name:'บันทึกอัตราแลกเปลี่ยน'})).toBeDisabled();
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByLabel('เรท LAK ต่อ USD')).toHaveValue('23234');await expect(page.getByRole('button',{name:'บันทึกอัตราแลกเปลี่ยน'})).toBeEnabled();
});

test('customer order read failure is distinct from an empty history and can recover in place',async({page})=>{
 await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];let fail=true;
 await page.route('**/admin/v1/orders?**',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/customers/'+c.id);await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByText('ยังไม่มีออเดอร์',{exact:true})).toHaveCount(0);await expect(page.getByText('ไม่มีออเดอร์ที่มีปัญหา',{exact:true})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.locator('.order-row')).not.toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
});
