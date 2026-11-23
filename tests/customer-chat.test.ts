import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase,Repository } from '../src/database.js';
import { Accounts } from '../src/accounts.js';
import { CustomerChat } from '../src/customer-chat.js';
import { OrderService } from '../src/orders.js';
import { processTelegramUpdate } from '../src/telegram.js';

test('one customer account retains one room across logins and cannot read another room',async()=>{
 const db=await openDatabase('memory:');await new Repository(db).init();
 const auth=new Accounts(db);await auth.init();const chat=new CustomerChat(db,auth);await chat.init();
 try{
  const a=await auth.register('alice','correct horse battery staple');const b=await auth.register('bob','another long password');
  const again=await auth.login('alice','correct horse battery staple');
  assert.equal(a.user.id,again.user.id);assert.equal(a.user.room_id,again.user.room_id);
  await chat.customerMessage(a.token,'hello','client-message-1');
  await chat.customerMessage(again.token,'hello','client-message-1');
  assert.equal((await chat.read(again.token)).messages.length,1);
  assert.equal((await chat.read(b.token)).messages.length,0);
  await chat.adminMessage(a.user.room_id,'internal note','internal','note-1');
  await chat.adminMessage(a.user.room_id,'hello alice','public','reply-1');
  assert.equal((await chat.read(a.token)).messages.length,2);
  await auth.logout(a.token);await assert.rejects(chat.read(a.token),/login|session/i);
  assert.equal((await chat.read(again.token)).messages.length,2);
  assert.equal((await db.query('SELECT COUNT(*)::INTEGER AS n FROM customer_chat_rooms')).rows[0].n,2);
  const topic=await chat.topic(a.user.room_id,'bot');assert.equal(topic?.create,true);
  assert.equal(await chat.topic(a.user.room_id,'bot'),null,'No duplicate topic creation while first request is unresolved');
  await chat.topicCreated(a.user.room_id,'bot','500');
  assert.equal((await chat.topic(a.user.room_id,'bot'))?.topicId,'500');
  const orders=new OrderService(db,()=>null);await orders.init();
  const config={token:'fake',chatId:'123',userId:'123',botKey:'bot'};
  const update=(id:number,text:string,thread?:number)=>({update_id:id,message:{chat:{id:123,type:'private'},from:{id:123},text,message_thread_id:thread}});
  await processTelegramUpdate(orders,config,update(10,'normal conversation',500),async()=>{},chat);
  await processTelegramUpdate(orders,config,update(11,'private general discussion'),async()=>{},chat);
  await processTelegramUpdate(orders,config,update(12,'/note internal in topic',500),async()=>{},chat);
  assert.equal((await chat.read(again.token)).messages.at(-1)?.text,'normal conversation');
  assert.equal((await chat.read(b.token)).messages.length,0);
  await db.query("INSERT INTO shop_products(id,name,game_id,zone,markup_bps) VALUES('p','test','free-fire','th',1000)");
  for(const [id,customer,status] of [['alice-issue',a.user.id,'issue'],['alice-success',a.user.id,'completed'],['bob-issue',b.user.id,'issue']]){
   await db.query("INSERT INTO orders(id,product_id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,'p','unused',$1,'unused',$2,$3,'{}',$4)",[id,status,JSON.stringify({name:'310 Diamonds',player:{UID:'123'},zone:'th',price_usd:'1.00'}),customer]);
  }
  const details=await chat.adminCustomer(a.user.room_id,'issue');
  assert.equal(details.customer.username,'alice');
  assert.deepEqual(details.orders.map((o:any)=>o.id),['alice-issue']);
  assert.equal(details.total_orders,2);assert.equal(details.issue_orders,1);
  assert.deepEqual(details.status_counts,[{status:'completed',count:1},{status:'issue',count:1}]);
  assert.equal((await chat.adminCustomer(a.user.room_id,'all')).orders.length,2);
  assert.doesNotMatch(JSON.stringify(details),/password|salt|token|bob-issue/);
  await assert.rejects(chat.adminCustomer('missing','all'),/not found/i);
  const shown:any[]=[];
  const callback=(user:number,thread:number)=>({update_id:13,callback_query:{id:'profile',from:{id:user},message:{chat:{id:123,type:'private'},message_thread_id:thread},data:`c:${a.user.room_id}:issue:0`}});
  const show=async(room:string,filter:string,offset:number)=>{shown.push({room,filter,offset});};
  await processTelegramUpdate(orders,config,callback(999,500),async()=>{},chat,undefined,show);
  await processTelegramUpdate(orders,config,callback(123,999),async()=>{},chat,undefined,show);
  assert.equal(shown.length,0);
  await processTelegramUpdate(orders,config,callback(123,500),async()=>{},chat,undefined,show);
  assert.deepEqual(shown,[{room:a.user.room_id,filter:'issue',offset:0}]);
  assert.equal((await chat.read(again.token)).messages.at(-1)?.text,'normal conversation','Profile controls never create customer chat messages');
 }finally{await db.close();}
});
