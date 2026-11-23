import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,Repository} from '../src/database.js';
import {Accounts} from '../src/accounts.js';
import {CustomerChat} from '../src/customer-chat.js';
import {OrderService} from '../src/orders.js';
import {syncTelegramTopicIcons} from '../src/telegram.js';

test('topic order icons prioritize every owned order and reconcile after topic replacement',async()=>{
 const db=await openDatabase('memory:'),accounts=new Accounts(db),chat=new CustomerChat(db,accounts);
 await new Repository(db).init();await accounts.init();await chat.init();await new OrderService(db,async()=>null).init();
 try{
  const {user}=await accounts.register('icon_test','long mock password here');
  await chat.topic(user.room_id,'bot');await chat.topicCreated(user.room_id,'bot','100');
  let work=await chat.orderIconWork('bot');assert.equal(work[0].order_state,'none');
  await chat.orderIconApplied(work[0],'bot','icon-chat');assert.equal((await chat.orderIconWork('bot')).length,0);
  for(const [id,status] of [['one','completed'],['two','payment_review'],['three','processing'],['four','issue']])await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,'unused',$1,'unused',$2,'{}','{}',$3)",[id,status,user.id]);
  const state=async()=>{const item=(await chat.orderIconWork('bot'))[0];assert.ok(item);return item.order_state;};
  assert.equal(await state(),'issue');
  await db.query("UPDATE orders SET status='completed' WHERE id='four'");assert.equal(await state(),'processing');
  await db.query("UPDATE orders SET status='completed' WHERE id='three'");assert.equal(await state(),'pending');
  await db.query("UPDATE orders SET status='completed' WHERE id='two'");assert.equal(await state(),'completed');
  work=await chat.orderIconWork('bot');await chat.orderIconApplied(work[0],'bot','icon-done');assert.equal((await chat.orderIconWork('bot')).length,0);
  await db.query("UPDATE orders SET status='refunded'");assert.equal(await state(),'closed');
  work=await chat.orderIconWork('bot');await chat.orderIconApplied(work[0],'bot','icon-closed');
  await db.query("UPDATE customer_chat_rooms SET topic_id='101' WHERE id=$1",[user.room_id]);
  assert.equal((await chat.orderIconWork('bot'))[0].topic_id,'101');
  await chat.orderIconApplied(work[0],'bot','stale-icon');assert.equal((await chat.orderIconWork('bot')).length,1,'An old topic response cannot mark its replacement synced');
  assert.equal((await chat.orderIconWork('other-bot')).length,0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_chat_messages')).rows[0].n,0);
 }finally{await db.close();}
});

test('icon reconciliation uses supported Telegram emoji and retries a failed room independently',async()=>{
 const states=['issue','processing','pending','completed','closed','none'];
 const emoji=['❗️','🎮','📝','✅','📁','💬'];
 const work=states.map((order_state,i)=>({id:`room-${i}`,topic_id:String(100+i),order_state}));
 const applied:string[]=[],failed:string[]=[],edits:any[]=[];
 const chat={orderIconWork:async()=>work,orderIconApplied:async(item:any,_bot:string,icon:string)=>{assert.equal(icon,`icon-${states.indexOf(item.order_state)}`);applied.push(item.id);},orderIconFailed:async(item:any)=>{failed.push(item.id);}} as unknown as CustomerChat;
 await syncTelegramTopicIcons(chat,{token:'unused',chatId:'123',userId:'123',botKey:'bot'},async(method,body)=>{
  if(method==='getForumTopicIconStickers')return emoji.map((value,i)=>({emoji:value,custom_emoji_id:`icon-${i}`}));
  assert.equal(method,'editForumTopic');assert.equal(body.chat_id,'123');edits.push(body);
  if(body.message_thread_id===101)throw Error('temporary Telegram failure');return true;
 });
 assert.equal(edits.length,6);assert.deepEqual(failed,['room-1']);assert.equal(applied.length,5);
 assert.ok(applied.includes('room-5'),'A failed room must not block other player icons');
});
