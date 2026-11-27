import {test,expect,type Page} from '@playwright/test';
import {createHmac,randomUUID} from 'node:crypto';
async function open(page:Page){
 const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123}),query_id:randomUUID()});
 const secret=createHmac('sha256','WebAppData').update('123:fake-browser-only').digest();fields.set('hash',createHmac('sha256',secret).update([...fields.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 await page.route('https://telegram.org/js/**',r=>r.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(fields.toString())},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){}}}`}));
 await page.goto('/admin-app/');await expect(page.locator('main h1')).toBeVisible();
}
for(const width of [390,1440])test('empty sellable-game catalog is explicit and retry distinguishes a failed read at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await open(page);let fail=true;
 await page.route('**/admin/v1/products?game_id=free-fire',r=>r.fulfill(fail?{status:503,json:{error:'unavailable'}}:{json:{data:[]}}));
 await page.goto('/admin-app/#/store/products?game=free-fire');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('ยังไม่มีแพ็กเกจขายในเกมนี้',{exact:true})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByText('ยังไม่มีแพ็กเกจขายในเกมนี้',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'เพิ่มแพ็กเกจ',exact:true})).toBeEnabled();
});
test('empty source-only game catalog offers a useful state after a successful read',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.route('**/admin/v1/games',r=>r.fulfill({json:{data:[{id:'source-empty',name:'Source game',required_fields:null,zones:[]}]}}));
 await page.route('**/admin/v1/catalog?game_id=source-empty',r=>r.fulfill({json:{data:[]}}));
 await page.goto('/admin-app/#/store/products?game=source-empty');await expect(page.getByText('ยังไม่มีแพ็กเกจต้นทาง',{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/continuation-20261124/catalog-source-empty.png'});
});
test('source-only empty state never hides a failed refresh of game metadata',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);let failGames=false;
 await page.route('**/admin/v1/games',r=>r.fulfill(failGames?{status:503,json:{error:'unavailable'}}:{json:{data:[{id:'source-empty',name:'Source game',required_fields:null,zones:[]}]}}));
 await page.route('**/admin/v1/catalog?game_id=source-empty',r=>r.fulfill({json:{data:[]}}));
 await page.goto('/admin-app/#/store/products?game=source-empty');await expect(page.getByText('ยังไม่มีแพ็กเกจต้นทาง',{exact:true})).toBeVisible();
 failGames=true;await page.evaluate(()=>window.dispatchEvent(new Event('admin:refresh')));await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('ยังไม่มีแพ็กเกจต้นทาง',{exact:true})).toHaveCount(0);
 failGames=false;await page.getByRole('button',{name:'ลองโหลดอีกครั้ง'}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByText('ยังไม่มีแพ็กเกจต้นทาง',{exact:true})).toBeVisible();
});
test('mobile catalog keeps TH and ID packages separate and search combines with zone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);const original=(await (await page.request.get('/admin/v1/products')).json()).data[0];
 const product=(id:string,name:string,zone:string,game_id='free-fire')=>({...original,id,name,zone,game_id});
 await page.route('**/admin/v1/products?game_id=free-fire',r=>r.fulfill({json:{data:[product('test-th','TH Diamonds','th'),product('test-id','ID Diamonds','id'),product('test-other','Other game','th','mobile-legends-bang-bang')]}}));
 await page.goto('/admin-app/#/store/products?game=free-fire');await expect(page.locator('.mobile-product-card')).toHaveCount(2);await expect(page.getByRole('heading',{name:'Other game',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'TH',exact:true}).click();await expect(page.locator('.mobile-product-card')).toHaveCount(1);await expect(page.getByRole('heading',{name:'TH Diamonds',exact:true})).toBeVisible();
 await page.getByLabel('ค้นหาแพ็กเกจ').fill('ID Diamonds');await expect(page.locator('.mobile-product-card')).toHaveCount(0);await expect(page.getByText('ไม่พบแพ็กเกจที่ตรงกัน',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();await page.getByRole('button',{name:'ID',exact:true}).click();await expect(page.locator('.mobile-product-card')).toHaveCount(1);await expect(page.getByRole('heading',{name:'ID Diamonds',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/continuation-20261124/catalog-zone-id.png'});
});
test('unknown game has an icon fallback in both its order card and detail',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);const row=(await (await page.request.get('/admin/v1/orders')).json()).data[0];
 row.details={...row.details,game_id:'unknown-game'};
 await page.route('**/admin/v1/orders?**',r=>r.fulfill({json:{data:[row],counts:{payment_review:1}}}));
 await page.route('**/admin/v1/orders/'+row.id,async r=>{const response=await r.fetch(),detail=await response.json();detail.details={...detail.details,game_id:'unknown-game'};await r.fulfill({response,json:detail});});
 await page.goto('/admin-app/#/orders');await expect(page.locator('.order-card .game-mark svg')).toBeVisible();await page.locator('.order-card-summary').click();await expect(page.locator('.detail-game .game-mark svg')).toBeVisible();
});
