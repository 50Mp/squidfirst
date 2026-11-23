import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
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
