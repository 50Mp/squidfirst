import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDatabase,Repository} from '../src/database.js';import {Accounts} from '../src/accounts.js';import {CustomerChat} from '../src/customer-chat.js';import {OrderService} from '../src/orders.js';import {AdminAuth} from '../src/admin/auth.js';import {AdminService} from '../src/admin/service.js';
test('Mini App replies, private notes and durable change cursors stay separate',async()=>{
 const db=await openDatabase('memory:'),repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,()=>repo.effectiveFxRate());
 try{
  await repo.init();await accounts.init();await chat.init();await orders.init();const auth=new AdminAuth(db,{botToken:'fake',ownerTelegramId:'123',origin:'https://example.com'});await auth.init();
  const service=new AdminService(db,orders,chat,repo);await service.init();const actor=await auth.telegramActor();actor.channel='miniapp';
  const customer=await accounts.register('chat_test','long customer test password');
  const input={text:'สวัสดีครับ',visibility:'public' as const,idempotency_key:'admin-chat-reply-1234'};
  await service.sendChat(actor,customer.user.id,input);await service.sendChat(actor,customer.user.id,input);
  await service.sendChat(actor,customer.user.id,{text:'ข้อมูลร้านภายใน',visibility:'internal',idempotency_key:'admin-internal-note-123'});
  const publicMessages=await chat.read(customer.token);assert.equal(publicMessages.messages.length,1);assert.equal(publicMessages.messages[0].text,'สวัสดีครับ');
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_chat_jobs')).rows[0].n,2);
  const event=await service.events('0');assert.ok(event.data.length>0);assert.doesNotMatch(JSON.stringify(event),/ข้อมูลร้านภายใน|password|token_hash/);
  assert.equal((await service.events(event.next_cursor)).data.length,0);
  await assert.rejects(service.sendChat(actor,'missing',input),/not found/i);
 }finally{await db.close();}
});
