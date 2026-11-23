import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';

async function open(page:Page){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const secret=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();
 p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(p.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},showConfirm(t,cb){cb(true)}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}

test('mobile return retains filters, search, scroll and browser history',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 const original=(await (await page.request.get('/admin/v1/orders')).json()).data[0];
 await page.route('**/admin/v1/orders?**',r=>r.fulfill({json:{data:[...Array.from({length:25},(_,i)=>({...original,id:'ui-placeholder-'+i})),original],next_cursor:null}}));
 const list='/orders?status=payment_review&search=player&include_mock=true';await page.goto('/admin-app/#'+list);
 const target=page.locator('.order-card').last().locator('.order-card-summary');await target.scrollIntoViewIfNeeded();
 const saved=await page.evaluate(()=>scrollY);expect(saved).toBeGreaterThan(500);await target.click();
 await expect(page.getByRole('button',{name:'ย้อนกลับ',exact:true})).toBeVisible();await page.goBack();
 await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');await expect(page.getByLabel('ค้นหาออเดอร์')).toHaveValue('player');
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(saved-20);
 await page.locator('.order-card').last().locator('.order-card-summary').click();await page.reload();
 await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');await expect(page.getByLabel('ค้นหาออเดอร์')).toHaveValue('player');
 await page.locator('.order-card').last().locator('.order-card-summary').click();await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('#/orders\\?status=payment_review&search=player&include_mock=true$'));
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(saved-20);
});

test('desktop keeps list beside details with one next action and separate destructive controls',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);await page.goto('/admin-app/#/orders');
 await page.locator('.order-card-summary').first().click();
 await expect(page.getByRole('region',{name:'รายการออเดอร์'})).toBeVisible();await expect(page.getByRole('region',{name:'รายละเอียดออเดอร์'})).toBeVisible();
 const list=await page.locator('.order-list-pane').boundingBox(),detail=await page.locator('.order-detail-pane').boundingBox();expect(list!.x+list!.width).toBeLessThanOrEqual(detail!.x);
 await expect(page.locator('.order-detail-pane .action-dock .primary')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'ยกเลิกออเดอร์',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'การดำเนินการอื่น'}).click();
 await expect(page.getByRole('button',{name:'ยกเลิกออเดอร์',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/ux-orders-desktop.png'});
});

test('desktop preserves the live list scroll when changing and closing details',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page);
 const orders=(await (await page.request.get('/admin/v1/orders')).json()).data;
 await page.route('**/admin/v1/orders?**',r=>r.fulfill({json:{data:[orders[0],...Array.from({length:25},(_,i)=>({...orders[0],id:'desktop-placeholder-'+i})),orders[1]],next_cursor:null}}));
 await page.goto('/admin-app/#/orders');await page.locator('.order-card-summary').first().click();
 const target=page.locator('.order-card-summary').last();await target.scrollIntoViewIfNeeded();
 const saved=await page.locator('.order-list-pane').evaluate(e=>e.scrollTop);expect(saved).toBeGreaterThan(500);
 await target.click();await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect.poll(()=>page.locator('.order-list-pane').evaluate(e=>e.scrollTop)).toBeGreaterThan(saved-20);
});

test('navigation badges refresh independently and preserve stale counts on failure',async({page})=>{
 let fail=false,review=7;
 await page.route('**/admin/v1/navigation',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{pending_review_orders:review,unread_chat_rooms:3,unread_messages:9}}));
 await open(page);const badge=page.locator('.nav-badge[data-kind="orders"]');
 await expect(badge).toHaveText('7');await expect(page.locator('.nav-badge[data-kind="chats"]')).toHaveText('3');
 review=6;await page.evaluate(()=>window.dispatchEvent(new Event('admin:navigation-refresh')));await expect(badge).toHaveText('6');
 fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:navigation-refresh')));await expect(badge).toHaveAttribute('data-stale','true');await expect(badge).toHaveText('6');
 fail=false;review=0;await page.evaluate(()=>window.dispatchEvent(new Event('admin:navigation-refresh')));await expect(badge).toHaveCount(0);
 fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:navigation-refresh')));await expect(badge).toHaveText('?');await expect(badge).toHaveAttribute('data-stale','true');
});

test('chat links only its customer issue orders and returns without losing the draft',async({page})=>{
 await page.setViewportSize({width:390,height:640});await open(page);
 const customers=(await (await page.request.get('/admin/v1/customers')).json()).data,customer=customers.find((c:{username:string})=>c.username==='player3');
 const o=(await (await page.request.get('/admin/v1/orders?customer_id='+customer.id)).json()).data[0];
 const csrf=(await page.context().cookies()).find(c=>c.name==='squid_admin_csrf')!.value,headers={origin:'http://127.0.0.1:3101','x-csrf-token':csrf};
 for(const action of ['approve','issue']){const d=(await (await page.request.get('/admin/v1/orders/'+o.id)).json());if(d.allowed_actions.includes(action))expect((await page.request.post('/admin/v1/orders/'+o.id+'/actions',{headers,data:{action,expected_revision:d.revision,idempotency_key:randomUUID()}})).ok()).toBe(true);}
 await page.goto('/admin-app/#/chats/'+customer.id);await page.getByLabel('ข้อความแชท').fill('ร่างที่ยังไม่ส่ง');
 const context=page.getByRole('region',{name:'ออเดอร์ที่มีปัญหาของลูกค้าคนนี้'});await expect(context).toContainText(o.id.replaceAll('-','').slice(-10));await expect(context).not.toContainText('player2');
 await page.screenshot({path:'artifacts/ux-chat-issue-mobile.png'});
 await page.setViewportSize({width:360,height:450});await expect.poll(()=>page.evaluate(()=>document.querySelector('button[aria-label="ส่งข้อความ"]')!.getBoundingClientRect().bottom<=innerHeight&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);await page.setViewportSize({width:390,height:640});
 await context.locator('.chat-issue-orders').getByRole('button').first().click();await expect(page).toHaveURL(new RegExp('#/orders/'+o.id+'\\?'));await expect(page.getByRole('button',{name:'ย้อนกลับ',exact:true})).toBeVisible();await page.getByRole('button',{name:'ย้อนกลับ',exact:true}).click();
 await expect(page.getByLabel('ข้อความแชท')).toHaveValue('ร่างที่ยังไม่ส่ง');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('button[aria-label="ส่งข้อความ"]')!.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
});
