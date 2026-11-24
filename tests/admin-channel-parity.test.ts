import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,Repository} from '../src/database.js';
import {Accounts} from '../src/accounts.js';
import {CustomerChat} from '../src/customer-chat.js';
import {OrderService} from '../src/orders.js';
import {AdminAuth} from '../src/admin/auth.js';
import {AdminService} from '../src/admin/service.js';
import {processTelegramUpdate,formatTelegramOrder} from '../src/telegram.js';

test('web commands and Telegram callbacks share one MOCK lifecycle without public chat messages',async()=>{
 const db=await openDatabase('memory:');
 try{
  const repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts);
  await repo.init();await accounts.init();await chat.init();
  const auth=new AdminAuth(db,{botToken:'123:isolated-test',ownerTelegramId:'123',origin:'http://localhost'});await auth.init();
  const orders=new OrderService(db,async()=>null,accounts,()=>auth.telegramActor());await orders.init();
  const admin=new AdminService(db,orders,chat,repo);await admin.init();const actor=await auth.telegramActor();
  const customer=await accounts.register('parity_mock','isolated-parity-password'),id=randomUUID();
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,'unused',$1,'unused','payment_review',$2,$3,$4)",[id,JSON.stringify({mock:true,name:'MOCK parity',game_id:'free-fire',zone:'th',price_usd:'0.00',player:{UID:'0000000000'}}),JSON.stringify({mock:true,cost_lak:0,source_id:'MOCK-NO-SUPPLIER'}),customer.user.id]);
  const web=async(action:string)=>admin.act(actor,id,{action,expected_revision:(await admin.detail(id)).revision,idempotency_key:randomUUID()});
  const telegram=async(action:string,update:number)=>processTelegramUpdate(orders,{token:'123:isolated-test',chatId:'123',userId:'123',botKey:'isolated'}, {update_id:update,callback_query:{id:String(update),from:{id:123},message:{chat:{id:123,type:'private'}},data:`s:${id}:${action}`}},async()=>{},chat);
  await web('approve');assert.equal((await admin.detail(id)).status,'paid');
  await telegram('accept',1);const accepted=await admin.detail(id);assert.equal(accepted.status,'accepted');
  await telegram('accept',1);assert.equal((await admin.detail(id)).revision,accepted.revision);
  await web('start');await telegram('complete',2);assert.equal((await admin.detail(id)).status,'completed');
  assert.equal((await orders.pending()).length,1);
  assert.match(formatTelegramOrder(await orders.adminRead(id)),/สถานะ: เติมสำเร็จ/);
  await web('reopen');assert.equal((await admin.detail(id)).status,'processing');assert.equal((await orders.pending()).length,1);assert.match(formatTelegramOrder(await orders.adminRead(id)),/สถานะ: กำลังเติม/);
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM customer_chat_messages WHERE visibility='public'")).rows[0].n,0);
 }finally{await db.close();}
});
