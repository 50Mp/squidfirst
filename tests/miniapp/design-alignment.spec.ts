import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';
async function open(page:Page){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const key=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();p.set('hash',createHmac('sha256',key).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(p.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}
test('mobile conversation navbar shows the customer profile from the API',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const customers=(await (await page.request.get('/admin/v1/customers')).json()).data;
 const customer=customers.find((row:{username:string})=>row.username==='player1');
 await page.route('**/admin/v1/customers/'+customer.id,async route=>{
  const response=await route.fetch();
  const profile=await response.json();
  await route.fulfill({response,json:{...profile,customer:{...profile.customer,display_name:'Somchai K.',verified_at:'2026-11-27T00:00:00Z',
   avatar_data_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII='}}});
 });
 await page.goto('/admin-app/#/chats/'+customer.id);
 const header=page.locator('.conversation-header');
 await expect(header.getByRole('heading',{name:'Somchai K.',exact:true})).toBeVisible();
 await expect(header.getByText('บัญชี player1',{exact:true})).toBeVisible();
 await expect(header.locator('.conversation-avatar img')).toBeVisible();
 await expect(header.getByLabel('บัญชียืนยันแล้ว')).toBeVisible();
 await header.getByRole('button',{name:'รายละเอียดลูกค้า'}).click();
 const identity=page.locator('.profile-head');
 await expect(identity.getByRole('heading',{name:'Somchai K.',exact:true})).toBeVisible();
 await expect(identity.getByText('player1',{exact:true})).toBeVisible();
 await expect(identity.getByText('SK',{exact:true})).toBeVisible();
 const selected=page.locator('.profile-customer-picker button[aria-current="true"]');
 await expect(selected).toContainText('Somchai K.');
 await expect(selected).toContainText('@player1');
});
test('chat places the receipt between messages in upload order',async({page})=>{
 await open(page);
 const customers=(await (await page.request.get('/admin/v1/customers')).json()).data;
 const customer=customers.find((row:{username:string})=>row.username==='player1');
 await page.route('**/admin/v1/customers/'+customer.id,async route=>{
  const response=await route.fetch();
  const profile=await response.json();
  profile.latest_receipt.created_at='2026-11-27T10:01:00Z';
  await route.fulfill({response,json:profile});
 });
 await page.route('**/admin/v1/customers/'+customer.id+'/chat',route=>route.fulfill({json:{
  messages:[
   {id:'1',sender:'customer',visibility:'public',text:'กำลังส่งสลิป',created_at:'2026-11-27T10:00:00Z'},
   {id:'2',sender:'admin',visibility:'public',text:'ได้รับสลิปแล้ว',created_at:'2026-11-27T10:02:00Z'},
  ],next_cursor:'2',has_older:false,
 }}));
 await page.goto('/admin-app/#/chats/'+customer.id);
 const timeline=page.locator('.chat-messages');
 await expect(timeline.locator(':scope > .bubble, :scope > .chat-receipt')).toHaveText([
  /กำลังส่งสลิป/, /สลิป #/, /ได้รับสลิปแล้ว/,
 ]);
 await expect(timeline.getByRole('group',{name:'สลิปออเดอร์ล่าสุดของลูกค้า'}).locator(':scope > time'))
  .toHaveAttribute('datetime','2026-11-27T10:01:00Z');
});

test('mobile chat sends and opens a file-only message from its own room',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const {data}=await (await page.request.get('/admin/v1/customers')).json();
 const customer=data.find((row:{username:string})=>row.username==='player3');
 await page.goto('/admin-app/#/chats/'+customer.id);
 const picker=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'แนบไฟล์หรือรูปภาพ'}).click({timeout:3000});
 const name='หลักฐาน-'+randomUUID()+'.png';
 await (await picker).setFiles({name,mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=','base64')});
 await expect(page.locator('.chat-composer')).toContainText(name);
 await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();
 const file=page.locator('.bubble').getByRole('link',{name});
 await expect(file).toBeVisible();
 const response=await page.request.get((await file.getAttribute('href'))!);
 expect(response.ok()).toBe(true);
 expect(response.headers()['content-type']).toContain('image/png');
 await expect(page.locator('.chat-composer')).not.toContainText(name);
});

test('profile note keeps edits after a lost save response and retries as one private message',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const {data:customers}=await (await page.request.get('/admin/v1/customers')).json();
 const customer=customers.find((row:{username:string})=>row.username==='player2');
 const path='/admin/v1/customers/'+customer.id;
 const endpoint=path+'/chat';
 const requests:string[]=[];
 await page.route('**'+endpoint,async route=>{
  if(route.request().method()!=='POST')return route.continue();
  const input=route.request().postDataJSON();
  expect(input.visibility).toBe('internal');
  requests.push(input.idempotency_key);
  const response=await route.fetch();
  expect(response.ok()).toBe(true);
  if(requests.length===1)return route.abort();
  await route.fulfill({response});
 });
 await page.goto('/admin-app/#/customers/'+customer.id);
 const field=page.getByRole('textbox',{name:'บันทึกภายในร้าน (ข้อมูลเฉพาะลูกค้า)'});
 await expect(field).toHaveValue('');
 const text='บันทึกจากโปรไฟล์ '+randomUUID();
 await field.fill(text);
 await page.getByRole('button',{name:'บันทึกข้อความภายใน'}).click();
 await expect(page.locator('.profile-note').getByRole('alert')).toBeVisible();
 await expect(field).toHaveValue(text);
 await page.getByRole('button',{name:'บันทึกข้อความภายใน'}).click();
 await expect(page.locator('.profile-note').getByRole('status')).toHaveText('บันทึกแล้ว');
 await expect(field).toHaveValue(text);
 expect(requests).toHaveLength(2);
 expect(requests[0]).toBe(requests[1]);
 const history=await (await page.request.get(endpoint)).json();
 expect(history.messages.filter((message:{text:string})=>message.text===text)).toMatchObject([{visibility:'internal'}]);
 const response=await (await page.request.get(path)).json();
 expect(response.latest_internal_note).toBe(text);
});

test('customer profile searches by UID and chat opens only its own latest receipt',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const customers=(await (await page.request.get('/admin/v1/customers')).json()).data;
 const current=customers.find((row:{username:string})=>row.username==='player1');
 const other=customers.find((row:{username:string})=>row.username==='player2');
 await page.goto('/admin-app/#/customers/'+current.id);
 const profile=page.locator('.customer-profile');
 await expect(profile.getByRole('link',{name:'กลับไปจัดการร้าน'})).toBeVisible();
 await profile.getByRole('button',{name:'ค้นหา',exact:true}).click();
 await expect(profile.getByRole('searchbox')).toBeFocused();
 await expect(profile.getByRole('button',{name:'คัดลอก UID 1111111111'})).toBeVisible();
 await expect(profile.getByRole('button',{name:'คัดลอก UID 2222222222'})).toHaveCount(0);
 const search=page.waitForResponse(response=>response.url().endsWith('/customers?search=2222222222')&&response.ok());
 await profile.getByRole('searchbox').fill('2222222222');
 await search;
 await expect(profile.locator('.profile-customer-picker button')).toHaveCount(1);
 const result=profile.locator('.profile-customer-picker button');
 await expect(result).toContainText(other.username);
 await expect(result).toContainText('UID: 2222222222');
 await result.click();
 await expect(profile.getByRole('heading',{name:other.username,exact:true})).toBeVisible();
 await expect(profile.locator('.profile-customer-picker button[aria-current="true"]')).toContainText('ลูกค้าปัจจุบัน');
 await expect(profile.locator('.profile-head').getByText(other.username,{exact:true})).toHaveCount(1);
 await profile.getByRole('button',{name:'เปิดห้องแชท',exact:true}).click();
 const chatHeader=page.locator('.conversation-header');
 await expect(chatHeader.getByRole('button',{name:'รีเฟรชแชท'})).toHaveCount(0);
 await expect(chatHeader.getByRole('button',{name:'รายละเอียดลูกค้า'})).toBeVisible();
 const receipt=page.getByRole('group',{name:'สลิปออเดอร์ล่าสุดของลูกค้า'});
 await expect(receipt.getByAltText('สลิปชำระเงินของออเดอร์',{exact:true})).toHaveAttribute('src',/browser-order-2\/receipts\/receipt2$/);
 await receipt.getByRole('button',{name:/สลิปชำระเงินของออเดอร์/}).click();
 await expect(page.getByRole('dialog',{name:'สลิปชำระเงินขนาดเต็ม'})).toBeVisible();
 await page.getByRole('button',{name:'ปิดสลิป',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'สลิปชำระเงินขนาดเต็ม'})).toHaveCount(0);
 await chatHeader.getByRole('button',{name:'รายละเอียดลูกค้า'}).click();
 await profile.getByRole('link',{name:'กลับไปจัดการร้าน'}).click();
 await expect(page).toHaveURL(/#\/store$/);
});
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
test('overview and orders have no test-data toggle',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await expect(page.getByRole('switch',{name:'รวมรายการทดสอบ'})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
 await page.goto('/admin-app/#/orders');
 await expect(page.getByRole('switch',{name:'รวมรายการทดสอบ'})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
 await page.locator('.order-card').first().click();
 await expect(page.getByText('ออเดอร์ทดสอบ ไม่ต้องโอนเงินจริงหรือเติมเกมจริง')).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/\bmock\b/i);
});
test('order cards use a game icon instead of a letter abbreviation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.goto('/admin-app/#/orders');
 const cardMark=page.locator('.order-card').first().locator('.game-mark');
 await expect(cardMark.locator('img')).toBeVisible();
 await expect.poll(()=>cardMark.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(cardMark).not.toHaveText(/^(FF|ML)$/);
 await page.locator('.order-card').first().locator('.order-card-summary').click();
 const detailMark=page.locator('.detail-game .game-mark');
 await expect(detailMark.locator('img')).toBeVisible();
 await expect.poll(()=>detailMark.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(detailMark).not.toHaveText(/^(FF|ML)$/);
});
test('mobile orders open fulfillment cards directly without a view switch',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.goto('/admin-app/#/orders');
 await expect(page.locator('.order-card').first()).toBeVisible();
 await expect(page.getByRole('group',{name:'มุมมองออเดอร์'})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'สรุปออเดอร์'})).toHaveCount(0);
});
test('mobile order detail follows the Stitch section order and shows only the current customer message',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.goto('/admin-app/#/orders/browser-order-1');
 await expect(page.locator('.stitch-detail-section-title')).toHaveText([
  'ข้อมูลสำหรับเติมเกม','การตรวจสอบหลักฐานชำระเงิน','ต้นทุนและผลกำไร','ข้อความล่าสุดจากลูกค้า','สถานะการดำเนินงาน',
 ]);
 await expect(page.locator('.stitch-detail-chat-preview')).toContainText('ข้อความจาก Player 1');
 await expect(page.locator('.stitch-detail-chat-preview')).not.toContainText('ข้อความจาก Player 2');
 await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeHidden();
 await expect(page.getByRole('button',{name:'ย้อนกลับ',exact:true})).toBeInViewport();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:390,height:await page.evaluate(()=>document.documentElement.scrollHeight)});
 await page.screenshot({path:'artifacts/stitch-order-detail-mobile.png',fullPage:true});
});
test('FX local example follows the selected draft rate without saving it',async({page})=>{
 async function savedFx(){
  const {mode,revision,rate}=await (await page.request.get('/admin/v1/fx')).json();
  return {mode,revision,id:rate?.id,value:rate?.lak_per_usd};
 }
 await page.setViewportSize({width:390,height:844});await open(page);const before=await savedFx();
 await page.goto('/admin-app/#/store/fx');await page.getByRole('radio',{name:'กำหนดเอง',exact:false}).check();await page.getByLabel('เรท LAK ต่อ USD').fill('22675.43');
 await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).toContainText('226,754.30 LAK');await page.getByLabel('จำนวน USD',{exact:true}).fill('20');
 await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).toContainText('453,508.60 LAK');
 expect(await savedFx()).toEqual(before);
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
 await open(page);
 const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];
 let fail=true;
 await page.route('**/admin/v1/customers/*/chat',r=>fail?r.fulfill({status:503,json:{error:'unavailable'}}):r.continue());
 await page.goto('/admin-app/#/chats/'+c.id);
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByText('เริ่มบทสนทนา',{exact:true})).toHaveCount(0);
 fail=false;
 await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();
 await expect(page.locator('.bubble.customer').first()).toBeVisible();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
test('chat queue search survives room navigation and reload',async({page})=>{
 await open(page);await page.goto('/admin-app/#/chats');await page.getByLabel('ค้นหาลูกค้า').fill('player2');await page.locator('.chat-card').first().getByRole('button',{name:'เปิดแชทตอบกลับ'}).click();await page.getByRole('button',{name:'ย้อนกลับไปแชท'}).click();await expect(page.getByLabel('ค้นหาลูกค้า')).toHaveValue('player2');await page.reload();await expect(page.getByLabel('ค้นหาลูกค้า')).toHaveValue('player2');
});
test('chat search finds the customer from a displayed order reference or UID',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 await page.goto('/admin-app/#/chats');
 const search=page.getByLabel('ค้นหาลูกค้า');
 const cards=page.locator('.chat-card');
 await search.fill('#wserorder2');
 await expect(cards).toHaveCount(1);
 await expect(cards.first()).toContainText('player2');
 await expect(cards.first().locator('.chat-card-order')).toHaveAttribute('href','#/orders/browser-order-2');
 await search.fill('3333333333');
 await expect(cards).toHaveCount(1);
 await expect(cards.first()).toContainText('player3');
});
test('an unread filter explains when it hides a matched chat and keeps the search',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 await page.goto('/admin-app/#/chats');
 const search=page.getByLabel('ค้นหาลูกค้า');
 await search.fill('#wserorder2');
 const markedRead=page.waitForResponse(response=>response.url().endsWith('/read')&&response.ok());
 await page.getByRole('button',{name:'เปิดแชทตอบกลับ'}).click();
 await markedRead;
 await page.getByRole('button',{name:'ย้อนกลับไปแชท'}).click();
 await page.getByRole('button',{name:/^ยังไม่อ่าน/}).click();
 await expect(page.getByRole('heading',{name:'ผลค้นหานี้ไม่มีแชทที่ยังไม่อ่าน'})).toBeVisible();
 await page.getByRole('button',{name:'ดูผลค้นหาทั้งหมด',exact:true}).click();
 await expect(search).toHaveValue('#wserorder2');
 await expect(page.locator('.chat-card')).toHaveCount(1);
 await expect(page.locator('.chat-card-order')).toHaveAttribute('href','#/orders/browser-order-2');
});
test('a new chat search clears the previous search error while loading',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 await page.route('**/admin/v1/customers?search=offline',route=>route.fulfill({status:503,json:{error:'offline'}}));
 let release!:()=>void;
 const hold=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/admin/v1/customers?search=player2',async route=>{await hold;await route.continue();});
 await page.goto('/admin-app/#/chats');
 const search=page.getByRole('searchbox',{name:'ค้นหาลูกค้า'});
 await search.fill('offline');
 await expect(page.getByRole('alert')).toBeVisible();
 try{
  await search.fill('player2');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.chat-card')).toHaveCount(0);
  await expect(search).toBeFocused();
 }finally{release();}
 await expect(page.locator('.chat-card')).toHaveCount(1);
 await expect(page.locator('.chat-card')).toContainText('player2');
});
test('saved FX mode changes appear in scoped activity history with a return to FX',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/admin-app/#/store/fx');
 const automatic=page.getByRole('radio',{name:/LFX อัตโนมัติ/});
 await page.getByRole('radio',{name:/กำหนดเอง/}).check();
 const rate=page.getByLabel('เรท LAK ต่อ USD');
 await rate.fill('23987');
 const save=page.getByRole('button',{name:'บันทึกอัตราแลกเปลี่ยน'});
 await save.click();
 await expect(page.locator('.rate-display strong')).toContainText('23,987');
 await automatic.check();
 await save.click();
 await expect(page.locator('.rate-display strong')).not.toContainText('23,987');
 await page.getByRole('link',{name:'ดูกิจกรรมการเปลี่ยนเรท'}).click({timeout:3000});
 await expect(page).toHaveURL(/\/store\/audit\?category=fx/);
 const activities=page.getByRole('list',{name:'ประวัติกิจกรรม'});
 await expect(activities.locator('li').first()).toContainText('กำหนดเอง → LFX อัตโนมัติ');
 await expect(activities).not.toContainText('เปลี่ยนสถานะร้านต้นทาง');
 await page.getByRole('button',{name:'ย้อนกลับ'}).click();
 await expect(page).toHaveURL(/#\/store\/fx$/);
 await expect(automatic).toBeChecked();
 await page.getByRole('radio',{name:/กำหนดเอง/}).check();
 await rate.fill('23000');
 await save.click();
 await expect(page.locator('.rate-display strong')).toContainText('23,000');
});
test('switching to unsaved LFX mode never previews the persisted manual rate',async({page})=>{
 await open(page);await page.route('**/admin/v1/fx',r=>r.fulfill({json:{mode:'manual',revision:1,rate:{lak_per_usd:'99999'}}}));await page.goto('/admin-app/#/store/fx');await page.getByRole('radio',{name:'LFX อัตโนมัติ',exact:false}).check();await expect(page.getByRole('status',{name:'ผลคำนวณตัวอย่าง'})).not.toContainText('999,990');
});
test('pending send prevents typing a draft that its response would clear',async({page})=>{
 await open(page);const c=(await (await page.request.get('/admin/v1/customers')).json()).data[0];await page.goto('/admin-app/#/chats/'+c.id);await expect(page.getByLabel('ข้อความแชท')).toBeVisible();
 let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);await page.route('**/admin/v1/customers/*/chat',async r=>{if(r.request().method()==='POST')await hold;await r.continue();});
 await page.getByLabel('ข้อความแชท').fill('slow reply');await page.getByRole('button',{name:'ส่งข้อความ'}).click();try{await expect(page.getByLabel('ข้อความแชท')).toBeDisabled();}finally{release();}await expect(page.getByLabel('ข้อความแชท')).toBeEnabled();
});

test('retrying a saved chat draft after leaving the room does not duplicate it',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const {data:customers}=await (await page.request.get('/admin/v1/customers')).json();
 const customer=customers.find((row:{username:string})=>row.username==='player1');
 const endpoint='/admin/v1/customers/'+customer.id+'/chat';
 const keys:string[]=[];
 await page.route('**'+endpoint,async route=>{
  if(route.request().method()!=='POST')return route.continue();
  keys.push(route.request().postDataJSON().idempotency_key);
  if(keys.length!==1)return route.continue();
  const saved=await route.fetch();
  expect(saved.ok()).toBe(true);
  await route.fulfill({status:503,json:{error:'Simulated lost response after save'}});
 });
 const draft='บันทึกทดสอบการส่งใหม่ '+randomUUID();
 await page.goto('/admin-app/#/chats/'+customer.id);
 await page.getByRole('radio',{name:'บันทึกภายใน · ลูกค้าไม่เห็น',exact:true}).check();
 await page.getByLabel('ข้อความแชท').fill(draft);
 await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();
 await page.evaluate(async()=>{
  const reads:Promise<unknown>[]=[];
  window.dispatchEvent(new CustomEvent('admin:refresh',{detail:{waitUntil:(p:Promise<unknown>)=>reads.push(p)}}));
  await Promise.allSettled(reads);
 });
 await expect(page.locator('.chat-composer').getByRole('alert')).toBeVisible();
 await page.getByRole('button',{name:'ย้อนกลับไปแชท'}).click();
 await expect(page.locator('.stitch-chat-list')).toBeVisible();
 await page.goto('/admin-app/#/chats/'+customer.id);
 await expect(page.getByLabel('ข้อความแชท')).toHaveValue(draft);
 await expect(page.getByRole('radio',{name:'บันทึกภายใน · ลูกค้าไม่เห็น',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();
 await expect(page.getByLabel('ข้อความแชท')).toHaveValue('');
 const {messages}=await (await page.request.get(endpoint)).json();
 expect(messages.filter((message:{text:string})=>message.text===draft)).toHaveLength(1);
 expect(keys).toEqual([keys[0],keys[0]]);
});

test('expired browser session locks admin screens and fresh Telegram bootstrap restores access',async({page,context})=>{
 await open(page);await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeVisible();
 await context.clearCookies();await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));
 await expect(page.getByRole('alert')).toContainText('เซสชันหมดอายุ');await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toHaveCount(0);
 expect((await page.request.get('/admin/v1/orders')).status()).toBe(401);
 await open(page);await expect(page.getByRole('navigation',{name:'เมนูหลัก'})).toBeVisible();expect((await page.request.get('/admin/v1/orders')).status()).toBe(200);
});

test('mobile slip issue saves a reason and keeps the internal note separate',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const endpoint='/admin/v1/orders/browser-order-3';
 const original=await (await page.request.get(endpoint)).json();
 let submitted:{reason:string;customer_message:string;internal_note:string}|undefined;
 let updated:Record<string,unknown>|undefined;
 await page.route('**'+endpoint,route=>updated?route.fulfill({json:updated}):route.continue());
 await page.route('**'+endpoint+'/actions',route=>{
  const input=route.request().postDataJSON();
  expect(input.action).toBe('issue');
  expect(input.expected_revision).toBe(original.revision);
  submitted=input.slip_issue;
  updated={...original,status:'issue',allowed_actions:['cancel'],revision:original.revision+1,
   slip_issue:{reason:submitted!.reason,customer_message:submitted!.customer_message}};
  return route.fulfill({json:updated});
 });
 await page.goto('/admin-app/#/orders/browser-order-3');
 const report=page.getByRole('button',{name:'พบปัญหา',exact:true});
 await report.click();
 const sheet=page.getByRole('dialog',{name:'แจ้งปัญหาสลิป'});
 await expect(sheet.getByRole('radio')).toHaveCount(5);
 await sheet.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await expect(report).toBeFocused();
 await report.click();
 await sheet.getByRole('radio',{name:/อื่น ๆ/}).check();
 const submit=sheet.getByRole('button',{name:'ขอส่งสลิปใหม่'});
 await expect(submit).toBeDisabled();
 await sheet.getByRole('radio',{name:/ภาพไม่ชัด/}).check();
 const message=sheet.getByLabel('ข้อความแจ้งเตือนลูกค้า');
 await expect(message).toHaveValue(/อัปโหลดสลิปใหม่/);
 await message.fill('กรุณาแนบหลักฐานที่เห็นเวลาชำระชัดเจน');
 await sheet.getByLabel(/บันทึกภายใน/).fill('จดบันทึกตรวจเวลา');
 await submit.click();
 await expect(sheet).toBeHidden();
 await expect(page.locator('.stitch-detail-meta .status')).toHaveText('พบปัญหา');
 await expect(page.locator('.slip-issue-summary')).toContainText('ภาพไม่ชัด');
 expect(submitted).toEqual({reason:'blurry_slip',customer_message:'กรุณาแนบหลักฐานที่เห็นเวลาชำระชัดเจน',internal_note:'จดบันทึกตรวจเวลา'});
});

test('mobile order actions wait for the updated revision and can complete after an issue',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 page.on('dialog',dialog=>dialog.accept());
 const endpoint='/admin/v1/orders/browser-order-2';
 await page.goto('/admin-app/#/orders/browser-order-2');
 const approve=page.getByRole('button',{name:'ยืนยันรับเงินแล้ว',exact:true});
 await expect(approve).toBeEnabled();
 let release!:()=>void;
 let failRead=false;
 const hold=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**'+endpoint,async route=>{
  await hold;
  return failRead?route.fulfill({status:503,json:{error:'unavailable'}}):route.continue();
 });
 const approved=page.waitForResponse(response=>response.url().endsWith(endpoint+'/actions')&&response.ok());
 try{
  await approve.click();
  await approved;
  await expect(approve).toBeDisabled();
 }finally{release();}
 await page.getByRole('button',{name:'รับงาน',exact:true}).click();
 await expect(page.locator('.stitch-detail-meta .status')).toHaveText('รับงานแล้ว');
 await page.getByRole('button',{name:'เริ่มเติม',exact:true}).click();
 await expect(page.locator('.stitch-detail-meta .status')).toHaveText('กำลังเติม');
 const issue=page.getByRole('button',{name:'พบปัญหา',exact:true});
 failRead=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(issue).toBeDisabled();
 failRead=false;
 await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();
 await issue.click();
 await expect(page.locator('.stitch-detail-meta .status')).toHaveText('พบปัญหา');
 await expect(page.getByRole('button',{name:'เติมสำเร็จ',exact:true})).toHaveCount(0);
 const problem=await (await page.request.get(endpoint)).json();
 expect(problem.payment_verified).toBe(true);
 await page.getByRole('button',{name:'ทำต่อ',exact:true}).click();
 await page.getByRole('button',{name:'เติมสำเร็จ',exact:true}).click();
 await expect(page.locator('.stitch-detail-meta .status')).toHaveText('เติมสำเร็จ');
 const finished=await (await page.request.get(endpoint)).json();
 expect(finished.status).toBe('completed');
 expect(finished.payment_verified).toBe(true);
 expect(finished.revision).toBe(problem.revision+2);
});

test('Stitch cards render the correct order actions and confirm batch requests',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const first=(await (await page.request.get('/admin/v1/orders')).json()).data[0];
 const processing={...first,status:'processing',allowed_actions:['complete','issue'],supplier_name:'JorJee Game Store'};
 const refunded={...first,id:'reference-refund',status:'refunded',allowed_actions:[]};
 const review={...first,id:'reference-review',status:'payment_review',allowed_actions:['approve','cancel']};
 const requests:string[]=[];
 await page.route('**/admin/v1/orders?**',r=>r.fulfill({json:{data:[refunded,processing,review],counts:{refunded:1,processing:1,payment_review:1}}}));
 await page.route('**/admin/v1/orders/*/actions',r=>{
  requests.push(r.request().postDataJSON().action);
  return r.fulfill({json:{ok:true}});
 });
 await page.goto('/admin-app/#/orders');
 const cards=page.locator('.stitch-order-card');
 await expect(cards.nth(0).getByRole('button',{name:'ดูใบสำคัญคืนเงิน'})).toBeDisabled();
 await expect(cards.nth(1).getByRole('button',{name:'แจ้งปัญหา'})).toBeVisible();
 await expect(cards.nth(1).getByRole('button',{name:'ยืนยันเติมสำเร็จ'})).toBeVisible();
 await expect(cards.nth(1).locator('.stitch-game-art img')).toHaveJSProperty('complete',true);
 await cards.nth(1).getByRole('checkbox').check();
 await expect(page.getByRole('button',{name:'อนุมัติกลุ่ม (1)',exact:true})).toBeDisabled();
 const fullHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
 await page.setViewportSize({width:390,height:fullHeight});
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:'artifacts/stitch-orders-mobile.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await cards.nth(1).getByRole('checkbox').uncheck();
 await cards.nth(2).getByRole('checkbox').check();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'อนุมัติกลุ่ม (1)',exact:true}).click();
 await expect.poll(()=>requests).toEqual(['approve']);
});

test('mobile batch approval skips an order whose revision changed and finishes the remaining orders',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await open(page);
 const original=(await (await page.request.get('/admin/v1/orders')).json()).data[0];
 const rows=[101,102,103].map(number=>({...original,id:'SQ-'+number,status:'payment_review',allowed_actions:['approve','cancel']}));
 const handled:string[]=[];
 await page.route('**/admin/v1/orders?**',route=>{
  const remaining=rows.filter(row=>!handled.includes(row.id));
  return route.fulfill({json:{data:remaining,counts:{payment_review:remaining.length}}});
 });
 await page.route('**/admin/v1/orders/*/actions',route=>{
  const id=route.request().url().split('/').at(-2)!;
  expect(route.request().postDataJSON().action).toBe('approve');
  handled.push(id);
  return id==='SQ-102'?route.fulfill({status:409,json:{error:'Order changed'}}):route.fulfill({json:{ok:true}});
 });
 await page.goto('/admin-app/#/orders?status=payment_review');
 await expect(page.locator('.order-card')).toHaveCount(3);
 for(const checkbox of await page.locator('.order-card input[type=checkbox]').all())await checkbox.check();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'อนุมัติกลุ่ม (3)',exact:true}).click();
 await expect.poll(()=>handled).toEqual(['SQ-101','SQ-102','SQ-103']);
 await expect(page.locator('.stitch-batch [role=status]')).toContainText('อนุมัติแล้ว 2 รายการ');
 await expect(page.locator('.stitch-batch [role=status]')).toContainText('ข้าม 1 รายการ');
 await expect(page.locator('.stitch-batch [role=status]')).toContainText('#SQ-102');
 await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
});
