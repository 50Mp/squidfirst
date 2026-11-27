import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { createHmac,randomUUID } from 'node:crypto';
import { AdminAuth } from '../src/admin/auth.js';
import { AdminService } from '../src/admin/service.js';
import { Accounts } from '../src/accounts.js';
import { CustomerChat } from '../src/customer-chat.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase,Repository } from '../src/database.js';
import { OrderService } from '../src/orders.js';
import { buildApp } from '../src/app.js';
import { selectLfxUsdRate } from '../src/fx.js';
import { validateSnapshot } from '../src/catalog.js';

test('public orders never expose supplier data and receipt downloads require ownership',async()=>{
 const db=await openDatabase('memory:');const catalog=new Repository(db);await catalog.init();
 const seed=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
 await catalog.save(validateSnapshot(seed.games),'2026-11-18T08:00:00Z','live');
 await catalog.saveFxRate(selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22688.45'}]),'2026-11-18T08:00:00Z');
 const service=new OrderService(db,()=>catalog.latestFxRate());await service.init();
 const root=await mkdtemp(join(tmpdir(),'squid-receipts-'));const app=buildApp(catalog,'admin-secret',service,root);
 try{
  assert.equal((await app.inject('/sources')).statusCode,401);
  assert.equal((await app.inject('/shop/products')).statusCode,200);
  const offer=(await catalog.packages('free-fire',false))[0];
  const publish=await app.inject({method:'POST',url:'/admin/products',headers:{'x-api-key':'admin-secret'},payload:{name:'33 Diamonds',game_id:'free-fire',zone:'th',offer_ids:[offer.id],confirmed_equivalent:true}});
  assert.equal(publish.statusCode,201,publish.body);
  const product=(await app.inject('/shop/products')).json().data[0];
  assert.equal(product.price_usd,'0.39');assert.equal(JSON.stringify(product).includes('jorjee'),false);
  const token='z'.repeat(43),headers={authorization:`Bearer ${token}`,'idempotency-key':'customer-request-1'};
  const create=await app.inject({method:'POST',url:'/orders',headers,payload:{product_id:product.id,player:{UID:'123'}}});
  assert.equal(create.statusCode,201,create.body);const id=create.json().id;
  assert.equal(JSON.stringify(create.json()).includes(offer.id),false);
  assert.equal((await app.inject({url:`/orders/${id}`,headers:{authorization:`Bearer ${'x'.repeat(43)}`}})).statusCode,404);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWuQAAAAASUVORK5CYII=','base64');
  const receipt=await app.inject({method:'POST',url:`/orders/${id}/receipts`,headers:{authorization:`Bearer ${token}`,'content-type':'image/png'},payload:png});
  assert.equal(receipt.statusCode,201,receipt.body);
  const order=(await app.inject({url:`/orders/${id}`,headers})).json();assert.equal(order.status,'payment_review');
  assert.equal('path' in order.receipts[0],false);
  const download=await app.inject({url:`/orders/${id}/receipts/${order.receipts[0].id}`,headers});
  assert.deepEqual(download.rawPayload,png);
  assert.equal((await app.inject(`/orders/${id}/receipts/${order.receipts[0].id}`)).statusCode,401);
  const disabled=buildApp(catalog,'admin-secret',service,root,false);
  try{assert.equal((await disabled.inject({method:'POST',url:'/orders',headers,payload:{product_id:product.id,player:{UID:'123'}}})).statusCode,503);}finally{await disabled.close();}
 }finally{await app.close();await db.close();await rm(root,{recursive:true,force:true});}
});

test('customer checkout and admin fulfillment share a durable order record',async()=>{
 const root=await mkdtemp(join(tmpdir(),'squid-checkout-'));
 const url='pglite://'+join(root,'database');
 const db=await openDatabase(url);
 const repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts);
 const orders=new OrderService(db,()=>repo.latestFxRate(),accounts);
 const origin='https://admin.example.test',botToken='123:isolated-checkout';
 const auth=new AdminAuth(db,{botToken,ownerTelegramId:'123',origin});
 const service=new AdminService(db,orders,chat,repo);
 let app:ReturnType<typeof buildApp>|undefined;
 let id='';
 try{
  await repo.init();await accounts.init();await chat.init();await orders.init();await auth.init();await service.init();
  const seed=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
  const observedAt='2026-11-18T08:00:00Z';
  await repo.save(validateSnapshot(seed.games),observedAt,'live');
  await repo.saveFxRate(selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22688.45'}]),observedAt);
  const offer=(await repo.packages('free-fire',false))[0];
  await orders.publish({name:offer.name,game_id:'free-fire',zone:offer.zone,offer_ids:[offer.id],markup_bps:1000});
  app=buildApp(repo,'internal-checkout',orders,join(root,'receipts'),true,accounts,chat,{auth,service});
  const product=(await app.inject('/shop/products')).json().data[0];
  const account=await accounts.register('dev_checkout_test',randomUUID());
  const buyer={authorization:'Bearer '+account.token};
  const checkout=await app.inject({method:'POST',url:'/orders',headers:{...buyer,'idempotency-key':randomUUID()},payload:{
   product_id:product.id,expected_price_usd:product.price_usd,player:Object.fromEntries(product.required_fields.map((field:string)=>[field,'123456789'])),
  }});
  assert.equal(checkout.statusCode,201,checkout.body);
  assert.equal(checkout.json().status,'awaiting_payment');
  id=checkout.json().id;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWuQAAAAASUVORK5CYII=','base64');
  const upload=await app.inject({method:'POST',url:`/orders/${id}/receipts`,headers:{...buyer,'content-type':'image/png'},payload:png});
  assert.equal(upload.statusCode,201,upload.body);
  const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123})});
  const secret=createHmac('sha256','WebAppData').update(botToken).digest();
  fields.set('hash',createHmac('sha256',secret).update([...fields].map(([key,value])=>`${key}=${value}`).join('\n')).digest('hex'));
  const login=await app.inject({method:'POST',url:'/admin/v1/session',headers:{origin},payload:{initData:fields.toString()}});
  assert.equal(login.statusCode,200,login.body);
  const cookies=login.headers['set-cookie'];
  assert.ok(Array.isArray(cookies));
  const admin={origin,cookie:cookies.map(c=>c.split(';')[0]).join('; '),'x-csrf-token':login.json().csrf};
  const detailUrl=`/admin/v1/orders/${id}`;
  const detail=async()=>{const r=await app!.inject({url:detailUrl,headers:admin});assert.equal(r.statusCode,200,r.body);return r.json();};
  let order=await detail();
  assert.equal(order.status,'payment_review');
  assert.deepEqual((await app.inject({url:order.receipts[0].url,headers:admin})).rawPayload,png);
  for(const [action,status] of [['approve','paid'],['accept','accepted'],['start','processing'],['complete','completed']]){
   const result=await app.inject({method:'POST',url:detailUrl+'/actions',headers:admin,payload:{action,expected_revision:order.revision,idempotency_key:randomUUID()}});
   assert.equal(result.statusCode,200,result.body);
   order=await detail();
   assert.equal(order.status,status);
  }
  const history=await app.inject({url:'/orders',headers:buyer});
  assert.equal(history.statusCode,200,history.body);
  assert.equal(history.json().data.find((row:{id:string})=>row.id===id)?.status,'completed');
 }finally{await app?.close();await db.close();}
 const restored=await openDatabase(url);
 try{
  assert.deepEqual((await restored.query('SELECT status,payment_verified FROM orders WHERE id=$1',[id])).rows,[{status:'completed',payment_verified:true}]);
  assert.equal((await restored.query('SELECT COUNT(*)::int AS count FROM admin_audit WHERE entity_id=$1',[id])).rows[0].count,4);
 }finally{await restored.close();await rm(root,{recursive:true,force:true});}
});
