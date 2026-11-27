import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,Repository} from '../src/database.js';
import {Accounts} from '../src/accounts.js';
import {CustomerChat} from '../src/customer-chat.js';
import {OrderService} from '../src/orders.js';
import {AdminAuth} from '../src/admin/auth.js';
import {AdminService} from '../src/admin/service.js';

test('navigation counts all review orders and unread rooms independently of customer pagination and read owner',async()=>{
 const db=await openDatabase('memory:');
 try{
  const repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,async()=>null);
  await repo.init();await accounts.init();await chat.init();await orders.init();
  const auth=new AdminAuth(db,{botToken:'fake-test-only',ownerTelegramId:'123',origin:'https://example.com'});await auth.init();
  const service=new AdminService(db,orders,chat,repo);await service.init();const actor=await auth.telegramActor();
  const one=await accounts.register('badges_one','a long fixture password'),two=await accounts.register('badges_two','a long fixture password');
  await chat.customerMessage(one.token,'first','badges-message-1');await chat.customerMessage(one.token,'second','badges-message-2');await chat.customerMessage(two.token,'third','badges-message-3');
  await db.query("INSERT INTO customer_chat_messages(room_id,sender,visibility,text) VALUES($1,'customer','internal','not public'),($1,'admin','public','not unread')",[one.user.room_id]);
  await db.query("UPDATE customer_accounts SET created_at=NOW()-INTERVAL '1 day'");
  await db.query("INSERT INTO customer_accounts(id,username,password_salt,password_hash) SELECT 'extra-'||n,'extra_'||n,'unused','unused' FROM generate_series(1,105) n");
  await db.query("INSERT INTO customer_chat_rooms(id,customer_id) SELECT 'extra-room-'||n,'extra-'||n FROM generate_series(1,105) n");
  await db.query("INSERT INTO customer_chat_messages(room_id,sender,visibility,text,created_at) SELECT 'extra-room-'||n,'admin','public','newer',NOW()+INTERVAL '1 minute' FROM generate_series(1,100) n");
  for(const [id,status,mock] of [['review','payment_review',false],['mock-review','payment_review',true],['done','completed',false]] as const){
   await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) VALUES($1,'unused',$1,'unused',$2,$3,'{}')",[id,status,JSON.stringify({mock})]);
  }
  const inbox=await service.customers('',actor.id);
  assert.equal(inbox.data.length,100);
  assert.ok(inbox.data.every(customer=>customer.unread===0));
  assert.deepEqual(inbox.counts,{total:107,unread:2,read:100});
  const unread=await service.customers('',actor.id,true);
  assert.deepEqual(unread.data.map(customer=>customer.unread).sort(),[1,2]);
  assert.deepEqual(unread.counts,inbox.counts);
  const navigation=(id:string)=>(service as any).navigation(id);
  assert.deepEqual(await navigation(actor.id),{pending_review_orders:1,unread_chat_rooms:2,unread_messages:3});
  const last=(await db.query("SELECT MAX(id)::text AS id FROM customer_chat_messages WHERE room_id=$1",[one.user.room_id])).rows[0].id;
  await service.markChatRead(actor,one.user.id,last);
  const readSearch=await service.customers('badges_one',actor.id,true);
  assert.deepEqual(readSearch.data,[]);
  assert.deepEqual(readSearch.counts,{total:1,unread:0,read:1});
  assert.deepEqual(await navigation(actor.id),{pending_review_orders:1,unread_chat_rooms:1,unread_messages:1});
  assert.equal((await navigation('different-reader')).unread_chat_rooms,2);
  assert.equal((await service.listOrders({customer_id:two.user.id,status:'issue'})).data.length,0);
 }finally{await db.close();}
});
