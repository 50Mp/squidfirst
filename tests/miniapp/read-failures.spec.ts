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

for(const screen of [
 {route:'settings',api:'settings',ready:'เพิ่มบัญชีรับเงิน',empty:''},
 {route:'pricing',api:'settings',ready:'บันทึกกำไรเริ่มต้น',empty:''},
 {route:'audit',api:'audit',ready:'',empty:'ยังไม่มีประวัติในหน้านี้'},
 {route:'backups',api:'backups',ready:'สร้างสำเนาสำรอง',empty:'ยังไม่มีสำเนาสำรอง'},
 {route:'games',api:'games',ready:'',empty:''},
 {route:'products',api:'products',ready:'เพิ่มแพ็กเกจ',empty:'ยังไม่มีแพ็กเกจขาย'},
 {route:'sources',api:'sources',ready:'ดึงข้อมูลตอนนี้',empty:''},
])test(screen.route+' initial read failure has retry, no false empty result or writable defaults',async({page})=>{
 await open(page);let fail=true;
 await page.route('**/admin/v1/'+screen.api,r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/store/'+screen.route);await expect(page.getByRole('alert')).toBeVisible();
 if(screen.empty)await expect(page.getByText(screen.empty,{exact:true})).toHaveCount(0);
 if(screen.ready)for(const button of await page.getByRole('button',{name:screen.ready,exact:true}).all())await expect(button).toBeDisabled();
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 if(screen.ready)await expect(page.getByRole('button',{name:screen.ready,exact:true}).first()).toBeVisible();
});

test('settings refresh failure preserves the draft and blocks writes until recovery',async({page})=>{
 await open(page);let fail=false;
 await page.route('**/admin/v1/settings',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/store/settings');await page.getByLabel('คำแนะนำการชำระเงิน').fill('ร่างรับชำระเงิน');
 fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByText('กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า กรุณาโหลดใหม่ก่อนดำเนินการ')).toBeVisible();
 await expect(page.getByLabel('คำแนะนำการชำระเงิน')).toHaveValue('ร่างรับชำระเงิน');await expect(page.getByRole('button',{name:'บันทึกข้อมูลรับเงิน'})).toBeDisabled();
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByRole('button',{name:'บันทึกข้อมูลรับเงิน'})).toBeEnabled();await expect(page.getByLabel('คำแนะนำการชำระเงิน')).toHaveValue('ร่างรับชำระเงิน');
});

test('product editor requires all read dependencies and preserves mappings on a failed refresh',async({page})=>{
 await open(page);const product=(await (await page.request.get('/admin/v1/products')).json()).data[0];let fail=true;
 await page.route('**/admin/v1/catalog?**',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/store/products/'+product.id);await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('button',{name:'บันทึกแพ็กเกจ'})).toBeDisabled();await expect(page.getByText('ไม่พบแพ็กเกจในโซนนี้',{exact:true})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByRole('button',{name:'บันทึกแพ็กเกจ'})).toBeEnabled();await page.getByLabel('ชื่อแพ็กเกจบนเว็บ').fill('ชื่อฉบับร่าง');
 fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('ชื่อแพ็กเกจบนเว็บ')).toHaveValue('ชื่อฉบับร่าง');await expect(page.locator('.offer-row input:checked')).toHaveCount(product.offer_ids.length);await expect(page.getByRole('button',{name:'บันทึกแพ็กเกจ'})).toBeDisabled();
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

test('PDF receipt download reports a read failure and succeeds on retry',async({page})=>{
 await open(page);let fail=true;
 await page.route('**/admin/v1/orders/browser-order-3',async r=>{const response=await r.fetch(),body=await response.json();body.receipts[0].mime='application/pdf';await r.fulfill({response,json:body});});
 await page.route('**/admin/v1/orders/browser-order-3/receipts/*',r=>fail?r.fulfill({status:503,body:'unavailable'}):r.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n% isolated download fixture\n%%EOF'}));
 await page.goto('/admin-app/#/orders/browser-order-3');await page.getByRole('button',{name:'ดาวน์โหลดสลิป PDF'}).click();await expect(page.getByRole('alert')).toContainText('เปิดสลิปไม่ได้');
 fail=false;const download=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลดสลิป PDF'}).click();expect((await download).suggestedFilename()).toBe('payment-receipt.pdf');await expect(page.getByRole('alert')).toHaveCount(0);
});
