import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {openDatabase,Repository} from '../src/database.js';import {Accounts} from '../src/accounts.js';import {CustomerChat} from '../src/customer-chat.js';import {OrderService} from '../src/orders.js';import {AdminService} from '../src/admin/service.js';import {AdminAuth} from '../src/admin/auth.js';import {selectLfxUsdRate} from '../src/fx.js';
test('admin products enforce mapping, strategy and publication with default markup',async()=>{
 const db=await openDatabase('memory:'),repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,()=>repo.effectiveFxRate());try{
  await repo.init();await accounts.init();await chat.init();await orders.init();const auth=new AdminAuth(db,{botToken:'fake',ownerTelegramId:'123',origin:'https://example.com'});await auth.init();const actor=await auth.telegramActor();
  const service=new AdminService(db,orders,chat,repo);await service.init();const seed=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));await repo.save(seed.games,'2026-11-18T08:00:00Z','live');await repo.saveFxRate(selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22688.45'}]),'2026-11-18T08:00:00Z');
  const offer=(await repo.packages('free-fire',false))[0];const input={name:'Diamonds',game_id:'free-fire',zone:'th',offer_ids:[offer.id],confirmed_equivalent:true,published:true,use_default_markup:true,idempotency_key:'create-product-test-123'};
  const product=await service.createProduct(actor,input);assert.equal((await service.createProduct(actor,input)).id,product.id);assert.equal((await orders.products()).length,1);
  const current=(await service.products()).data.find(p=>p.id===product.id)!;
  const otherOffer=(await repo.packages('mobile-legends-bang-bang',false))[0];
  assert.deepEqual((await service.products('pubg-mobile')).data,[]);
  assert.deepEqual((await service.games()).data.find(g=>g.id==='pubg-mobile')?.zones,[]);
  await db.query('UPDATE games SET name=$1,required_fields=$2 WHERE id=$3',['Free Fire Test',JSON.stringify(['Player ID']),'free-fire']);
  await repo.init();
  assert.equal((await service.games()).data.find(g=>g.id==='free-fire')?.name,'Free Fire Test');
  assert.deepEqual((await orders.products())[0].required_fields,['Player ID']);
  await assert.rejects(service.createProduct(actor,{...input,offer_ids:[otherOffer.id],idempotency_key:'cross-game-create-123'}),/game\/zone/i);
  await assert.rejects(service.updateProduct(actor,product.id,{...current,offer_ids:[otherOffer.id],confirmed_equivalent:true,expected_revision:1,idempotency_key:'cross-game-update-123'}),/game\/zone/i);
  await assert.rejects(service.updateProduct(actor,product.id,{...current,confirmed_equivalent:true,name:'Diamonds',strategy:'fixed_offer',fixed_offer_id:'not-mapped',expected_revision:1,idempotency_key:'invalid-fixed-offer-123'}),/mapped/i);
  await service.updateProduct(actor,product.id,{...current,confirmed_equivalent:true,strategy:'fixed_offer',fixed_offer_id:offer.id,expected_revision:1,idempotency_key:'valid-fixed-offer-1234'});
  assert.equal((await orders.previewProduct(product.id)).available,true);
  await db.query('UPDATE packages SET active=FALSE WHERE id=$1',[offer.id]);
  await service.updateProduct(actor,product.id,{...current,confirmed_equivalent:true,published:false,strategy:'auto_cheapest',expected_revision:2,idempotency_key:'unpublish-inactive-offer-123'});
  assert.equal((await service.products()).data.find(p=>p.id===product.id)!.published,false);
  assert.equal((await service.products()).data.find(p=>p.id===product.id)!.offers[0].active,false);
  await db.query('UPDATE packages SET active=TRUE WHERE id=$1',[offer.id]);
  await service.setGame(actor,'free-fire',false,1,'disable-ff-game-1234');assert.equal((await orders.products()).length,0);
  await assert.rejects(service.createProduct(actor,{...input,zone:'unspecified',idempotency_key:'invalid-zone-product-123'}),/zone/i);
 }finally{await db.close();}
});
