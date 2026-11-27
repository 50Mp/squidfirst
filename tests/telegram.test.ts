import { test } from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import { openDatabase,Repository } from '../src/database.js';
import { OrderService } from '../src/orders.js';
import { CustomerChat } from '../src/customer-chat.js';
import {Accounts} from '../src/accounts.js';
import {AdminService} from '../src/admin/service.js';
import {AdminAuth} from '../src/admin/auth.js';
import { processTelegramUpdate,runTelegram,formatTelegramOrder,formatTelegramCustomer,telegramOrderButtons } from '../src/telegram.js';

// Fake workers retain canonical card state just as the real service persists it in SQL.
function cardStorage(service:OrderService){
 const cards=new Map<string,any>();
 if(!service.orderCard)service.orderCard=async(bot,id)=>cards.get(`${bot}:${id}`)??null;
 if(!service.saveOrderCard)service.saveOrderCard=async(bot,id,card)=>{cards.set(`${bot}:${id}`,card);};
 return service;
}

test('only the configured private admin can reply; notes stay internal and updates deduplicate',async()=>{
 const db=await openDatabase('memory:');const catalog=new Repository(db);await catalog.init();const service=new OrderService(db,()=>catalog.latestFxRate());await service.init();
 try{
  await db.query(`INSERT INTO shop_products(id,name,game_id,zone,markup_bps) VALUES('p','test','free-fire','th',1000)`);
  const id='11111111-1111-4111-8111-111111111111';
  await db.query(`INSERT INTO orders(id,product_id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) VALUES($1,'p','hash','key','hash','awaiting_payment','{}','{}')`,[id]);
  const config={token:'not-real',chatId:'123',userId:'123',botKey:'test'};
  const message=(update_id:number,text:string,user=123,chat=123)=>({update_id,message:{from:{id:user},chat:{id:chat,type:'private'},text}});
  const answers:string[]=[];
  await processTelegramUpdate(service,config,message(1,`/reply ${id} hello`,999),async t=>{answers.push(t);});
  await processTelegramUpdate(service,config,message(2,`/reply ${id} hello`,123,999),async()=>{});
  await processTelegramUpdate(service,config,message(3,`/note ${id} private supplier`),async()=>{});
  const reply=message(4,`/reply ${id} hello customer`);
  await processTelegramUpdate(service,config,reply,async()=>{});await processTelegramUpdate(service,config,reply,async()=>{});
  const rows=(await db.query('SELECT visibility,text FROM order_messages ORDER BY id')).rows;
  assert.deepEqual(rows,[{visibility:'internal',text:'private supplier'},{visibility:'public',text:'hello customer'}]);
  await processTelegramUpdate(service,config,message(5,'plain internal discussion'),async()=>{});
  assert.equal((await db.query('SELECT COUNT(*)::INTEGER AS n FROM order_messages')).rows[0].n,2);
  // Delivery is persisted and a direct reply uses that exact order mapping.
  await db.query(`INSERT INTO telegram_outbox(id,order_id,kind,payload) VALUES('job-1',$1,'message','{"text":"customer"}')`,[id]);
  const job=await service.claim();assert.equal(job.id,'job-1');assert.equal(await service.claim(),null);
  await service.delivered(job,'123','987');
  const mapped=message(6,'/reply mapped answer');mapped.message.reply_to_message={message_id:987} as any;
  await processTelegramUpdate(service,config,mapped,async()=>{});
  assert.equal((await db.query('SELECT text FROM order_messages ORDER BY id DESC LIMIT 1')).rows[0].text,'mapped answer');
  assert.equal((await service.pending()).length,0);
  await db.query("UPDATE orders SET status='payment_review' WHERE id=$1",[id]);
  const callback={update_id:7,callback_query:{id:'expired-query',from:{id:123},message:{chat:{id:123,type:'private'}},data:`s:${id}:approve`}};
  await assert.doesNotReject(processTelegramUpdate(service,config,callback,async()=>{throw Error('query too old');}));
  assert.equal((await db.query('SELECT status FROM orders WHERE id=$1',[id])).rows[0].status,'paid');
  await assert.doesNotReject(processTelegramUpdate(service,config,{...callback,update_id:8,callback_query:{...callback.callback_query,data:`s:${id}:approve`}},async()=>{throw Error('query too old');}));
  for(const [update_id,action,status] of [[9,'accept','accepted'],[10,'start','processing']] as const){
   const next={update_id,callback_query:{...callback.callback_query,data:`s:${id}:${action}`}};
   await processTelegramUpdate(service,config,{...next,callback_query:{...next.callback_query,from:{id:999}}},async()=>{});
   assert.notEqual((await db.query('SELECT status FROM orders WHERE id=$1',[id])).rows[0].status,status);
   await processTelegramUpdate(service,config,next,async()=>{});
   await processTelegramUpdate(service,config,next,async()=>{});
   assert.equal((await db.query('SELECT status FROM orders WHERE id=$1',[id])).rows[0].status,status);
  }
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM order_messages WHERE sender='system' AND visibility='public'")).rows[0].n,0);
  const complete={update_id:11,callback_query:{...callback.callback_query,data:`s:${id}:complete`}};
  await processTelegramUpdate(service,config,complete,async()=>{});
  const reopen={update_id:12,callback_query:{...callback.callback_query,data:`s:${id}:reopen`}};
  await processTelegramUpdate(service,config,{...reopen,callback_query:{...reopen.callback_query,from:{id:999}}},async()=>{});
  assert.equal((await service.adminRead(id)).status,'completed');
  await processTelegramUpdate(service,config,reopen,async()=>{});
  await processTelegramUpdate(service,config,reopen,async()=>{});
  assert.equal((await service.adminRead(id)).status,'processing');
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM order_messages WHERE sender='system' AND visibility='public'")).rows[0].n,0);
 }finally{await db.close();}
});

test('completed order cards offer an explicit back-to-processing action with the full order ID',()=>{
 const id='f356342e-a7ca-4113-9282-f11265fb4f19';
 const completed=telegramOrderButtons(id,'completed').inline_keyboard.flat();
 assert.ok(completed.some(b=>b.text==='↩️ กลับไปกำลังเติม'&&b.callback_data===`s:${id}:reopen`));
 for(const status of ['awaiting_payment','paid','processing','cancelled','refunded'])assert.equal(telegramOrderButtons(id,status).inline_keyboard.flat().some(b=>b.callback_data.endsWith(':reopen')),false);
});

test('a transient database failure while recording delivery failure cannot crash the bot worker',async()=>{
 const controller=new AbortController(),originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{controller.abort();throw Error('simulated network failure');};
 const service={claim:async()=>({id:'job',order_id:'order',kind:'message',payload:{text:'test'}}),failed:async()=>{throw Error('database offline');},cursor:async()=>0} as unknown as OrderService;
 try{await assert.doesNotReject(runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal));}
 finally{globalThis.fetch=originalFetch;controller.abort();}
});

test('paid order cards offer accept but not start before accepting',async()=>{
 const controller=new AbortController(),originalFetch=globalThis.fetch;
 const id='11111111-1111-4111-8111-111111111111';
 let sent:any,claimed=false,delivered=false;
 globalThis.fetch=async(input,init)=>{
  if(String(input).endsWith('/sendMessage')){
   sent=JSON.parse(String(init?.body));controller.abort();
   return Response.json({ok:true,result:{chat:{id:123},message_id:456}});
  }
  return Response.json({ok:true,result:[]});
 };
 const service={claim:async()=>{if(claimed)return null;claimed=true;return{id:'job',order_id:id,kind:'status',payload:{status:'paid'}};},delivered:async()=>{delivered=true;},cursor:async()=>0} as unknown as OrderService;
 try{
  await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal);
  assert.equal(delivered,true);
  const buttons=sent.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some((b:any)=>b.text==='📥 รับงาน'&&b.callback_data===`s:${id}:accept`));
  assert.equal(buttons.some((b:any)=>b.callback_data===`s:${id}:start`),false);
  assert.equal('message_thread_id' in sent,false,'Legacy orders without customer chat configuration keep their existing delivery destination');
  assert.match(sent.text,/ยืนยันรับเงินแล้ว/);
  assert.doesNotMatch(sent.text,/สถานะ: paid/);
 }finally{globalThis.fetch=originalFetch;controller.abort();}
});

test('order cards separate game/package and show only ten order ID characters',()=>{
 const text=formatTelegramOrder({id:'f356342e-a7ca-4113-9282-f11265fb4f19',status:'payment_review',payment_verified:false,created_at:'2026-11-18T16:00:00Z',public_snapshot:{mock:true,name:'Free Fire 130 Diamonds — Player 2 (MOCK)',game_id:'free-fire',zone:'th',price_usd:'0.39',player:{UID:'123456','Zone ID':'5678'}},internal_snapshot:{source_id:'ggxg',cost_lak:8000,lak_per_usd:'22688.45'},messages:[{sender:'system',text:'Order status: accepted'},{sender:'admin',visibility:'internal',text:'ตรวจ UID แล้ว'}]});
 for(const value of ['MOCK','• แพ็กเกจ: 130 Diamonds','เกม: Free Fire','TH','UUID: 123456','5678','$0.39','รอตรวจชำระเงิน','GGXG Store'])assert.ok(text.includes(value),value);
 assert.equal(text.split('\n')[0],'Order ID: 1265fb4f19');
 assert.doesNotMatch(text,/f356342e|Player 2|สินค้า:/);
 assert.doesNotMatch(text,/public_snapshot|internal_snapshot|payment_verified|Order status:|"sender"|ต้นทุน|ประวัติ|22,688/);
 assert.ok(text.split('\n').length<=24);
 assert.ok(text.length<=900);
 assert.doesNotThrow(()=>formatTelegramOrder({id:'old-order'}));
});

test('customer summaries use the same short order ID and clearly separated order entries',()=>{
 const id='f356342e-a7ca-4113-9282-f11265fb4f19';
 const text=formatTelegramCustomer({customer:{id:'11111111-1111-4111-8111-111111111111',username:'player2',disabled:false},total_orders:1,issue_orders:0,status_counts:[{status:'paid',count:1}],filter:'all',orders:[{id,status:'paid',public_snapshot:{name:'Free Fire 310 Diamonds',game_id:'free-fire',zone:'th',player:{UID:'2222222222'},price_usd:'0.00'}}]});
 assert.match(text,/Order ID: 1265fb4f19/);assert.doesNotMatch(text,/f356342e-a7ca|public_snapshot/);
 assert.match(text,/Free Fire • 310 Diamonds/);assert.match(text,/UUID: 2222222222/);assert.match(text,/สถานะ: ยืนยันรับเงินแล้ว/);
 assert.ok(text.length<=3900);
});

test('receipt images are Telegram photos with a compact order caption; PDFs remain documents',async()=>{
 const originalFetch=globalThis.fetch,path=join(tmpdir(),`squid-receipt-${randomUUID()}`);
 await writeFile(path,Buffer.from('test fixture'));
 try{for(const mime of ['image/png','image/jpeg','application/pdf']){
  const controller=new AbortController();let claimed=false,sent:any,method='';
  globalThis.fetch=async(input,init)=>{
   if(init?.body instanceof FormData){method=String(input).split('/').pop()!;sent=init.body;controller.abort();return Response.json({ok:true,result:{chat:{id:123},message_id:456}});}
   await new Promise(resolve=>setTimeout(resolve,5));
   return Response.json({ok:true,result:[]});
  };
  const service={claim:async()=>{if(claimed)return null;claimed=true;return{id:'job',order_id:'order',kind:'receipt',payload:{id:'bill',path,mime}};},adminRead:async()=>({id:'order',status:'payment_review',public_snapshot:{name:'310 Diamonds',game_id:'free-fire',zone:'th',player:{UID:'123456789'},price_usd:'1.00'},internal_snapshot:{source_id:'ggxg'}}),delivered:async()=>{},cursor:async()=>0} as unknown as OrderService;
  await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal);
  assert.equal(method,mime==='application/pdf'?'sendDocument':'sendPhoto');
  assert.ok(sent.get(mime==='application/pdf'?'document':'photo') instanceof Blob);
  assert.match(sent.get('caption'),/310 Diamonds/);
  assert.match(sent.get('caption'),/123456789/);
  assert.match(sent.get('caption'),/รอตรวจชำระเงิน/);
  assert.match(sent.get('caption'),/สลิป/);
  assert.ok(sent.get('caption').length<=1024);
  assert.ok(JSON.parse(sent.get('reply_markup')).inline_keyboard.flat().some((b:any)=>b.callback_data==='s:order:approve'));
 }}finally{globalThis.fetch=originalFetch;await unlink(path);}
});

test('customer topic messages have a customer-details button without appending an order ID',async()=>{
 const originalFetch=globalThis.fetch,controller=new AbortController();
 const room='11111111-1111-4111-8111-111111111111';let sent:any,claimed=false;
 globalThis.fetch=async(input,init)=>{
  if(String(input).endsWith('/sendMessage')){sent=JSON.parse(String(init?.body));controller.abort();return Response.json({ok:true,result:{message_id:42}});}
  if(String(input).endsWith('/getMe'))return Response.json({ok:true,result:{has_topics_enabled:true}});
  await new Promise(resolve=>setTimeout(resolve,5));return Response.json({ok:true,result:[]});
 };
 const service={claim:async()=>null,cursor:async()=>0} as unknown as OrderService;
 const chat={claim:async()=>{if(claimed)return null;claimed=true;return{id:'job',room_id:room,text:'ช่วยตรวจให้หน่อย'};},topic:async()=>({topicId:'500',create:false}),delivered:async()=>{}} as unknown as CustomerChat;
 try{
  await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal,chat);
  assert.equal(sent.text,'ช่วยตรวจให้หน่อย');assert.equal(sent.message_thread_id,500);
  assert.deepEqual(sent.reply_markup.inline_keyboard,[[{text:'👤 รายละเอียดลูกค้า',callback_data:`c:${room}:issue:0`}]]);
 }finally{globalThis.fetch=originalFetch;controller.abort();}
});

test('chat attachments reach only their private topics and retry a missing topic with the original bytes',async()=>{
 const db=await openDatabase('memory:');
 const originalFetch=globalThis.fetch;
 const controller=new AbortController();
 try{
  const repo=new Repository(db),accounts=new Accounts(db);
  const chat=new CustomerChat(db,accounts),orders=new OrderService(db,async()=>null,accounts);
  await repo.init();await accounts.init();await chat.init();await orders.init();
  const admin=new AdminService(db,orders,chat,repo);
  const auth=new AdminAuth(db,{botToken:'offline-test',ownerTelegramId:'123',origin:'http://localhost'});
  await auth.init();
  await admin.init();
  const first=await accounts.register('attachment_public','a sample long password');
  const second=await accounts.register('attachment_internal','a sample long password');
  const config={token:'offline-test',chatId:'123',userId:'123',botKey:'test'};
  for(const [customer,topic] of [[first,'501'],[second,'502']] as const){
   await chat.topic(customer.user.room_id,config.botKey);
   await chat.topicCreated(customer.user.room_id,config.botKey,topic);
  }
  const actor={...await auth.telegramActor(),channel:'miniapp'} as const;
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=';
  const pdf=Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');
  const longText='ข้อความภายใน '.repeat(130);
  await admin.sendChat(actor,first.user.id,{text:'ลูกค้าเห็นไฟล์นี้',visibility:'public',idempotency_key:'public-attachment-001',attachment:{name:'guide.png',mime:'image/png',data:png}});
  await admin.sendChat(actor,second.user.id,{text:longText,visibility:'internal',idempotency_key:'internal-attachment-001',attachment:{name:'internal.pdf',mime:'application/pdf',data:pdf}});
  const uploads:FormData[]=[];
  const newTopics:string[]=[];
  const textSends:unknown[]=[];
  globalThis.fetch=async(input,init)=>{
   const method=String(input).split('/').pop();
   if(method==='getMe')return Response.json({ok:true,result:{has_topics_enabled:true}});
   if(method==='getForumTopicIconStickers')return Response.json({ok:true,result:[{emoji:'💬',custom_emoji_id:'700'}]});
   if(method==='editForumTopic')return Response.json({ok:true,result:true});
   if(method==='createForumTopic'){
    newTopics.push(JSON.parse(String(init?.body)).name);
    return Response.json({ok:true,result:{message_thread_id:601}});
   }
   if(method==='sendMessage')textSends.push(init?.body);
   if(method==='sendDocument'&&init?.body instanceof FormData){
    uploads.push(init.body);
    if(uploads.length===1)return Response.json({ok:false,error_code:400,description:'Bad Request: message thread not found'},{status:400});
    if(uploads.length===3)controller.abort();
    return Response.json({ok:true,result:{message_id:42}});
   }
   await new Promise(resolve=>setTimeout(resolve,5));
   return Response.json({ok:true,result:[]});
  };
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{await runTelegram(orders,config,controller.signal,chat);}
  finally{clearTimeout(timeout);}
  assert.deepEqual(textSends,[]);
  assert.deepEqual(newTopics,['attachment_public']);
  assert.deepEqual(uploads.map(body=>body.get('message_thread_id')),['501','601','502']);
  for(const [index,body] of uploads.entries()){
   const isPublic=index<2;
   const owner=isPublic?first:second;
   const document=body.get('document');
   assert.ok(document instanceof File);
   assert.equal(document.name,isPublic?'guide.png':'internal.pdf');
   assert.equal(document.type,isPublic?'image/png':'application/pdf');
   assert.equal(Buffer.from(await document.arrayBuffer()).toString('base64'),isPublic?png:pdf);
   assert.equal(body.get('chat_id'),config.chatId);
   assert.deepEqual(JSON.parse(String(body.get('reply_markup'))).inline_keyboard,[[{text:'👤 รายละเอียดลูกค้า',callback_data:`c:${owner.user.room_id}:issue:0`}]]);
  }
  assert.match(String(uploads[1].get('caption')),/ลูกค้าเห็นไฟล์นี้/);
  const internalCaption=String(uploads[2].get('caption'));
  assert.match(internalCaption,/บันทึกภายใน/);
  assert.match(internalCaption,/อ่านข้อความเต็มใน Mini App/);
  assert.ok(internalCaption.length<=1024);
  assert.deepEqual((await chat.read(second.token)).messages,[]);
  const jobs=(await db.query('SELECT state FROM customer_chat_jobs ORDER BY message_id')).rows;
  assert.deepEqual(jobs,[{state:'sent'},{state:'sent'}]);
 }finally{
  controller.abort();
  globalThis.fetch=originalFetch;
  await db.close();
 }
});

test('each player order and receipt is delivered only to that customer topic',async()=>{
 const originalFetch=globalThis.fetch,path=join(tmpdir(),`squid-routing-${randomUUID()}`);
 await writeFile(path,Buffer.from('mock image'));
 try{for(const kind of ['order','receipt','status']){
  const controller=new AbortController();let claimed=false,sent:any;
  globalThis.fetch=async(input,init)=>{
   if(String(input).endsWith('/getMe'))return Response.json({ok:true,result:{has_topics_enabled:true}});
   if(String(input).endsWith('/sendPhoto')||String(input).endsWith('/sendMessage')){sent=init?.body instanceof FormData?Object.fromEntries(init.body.entries()):JSON.parse(String(init?.body));controller.abort();return Response.json({ok:true,result:{chat:{id:123},message_id:42}});}
   await new Promise(resolve=>setTimeout(resolve,5));return Response.json({ok:true,result:[]});
  };
  const order={id:'order',customer_id:'player2',status:'payment_review',public_snapshot:{name:'310 Diamonds',game_id:'free-fire',zone:'th',player:{UID:'2222222222'},price_usd:'0.00'},internal_snapshot:{mock:true}};
  const service={claim:async()=>{if(claimed)return null;claimed=true;return{id:'job',order_id:'order',kind,payload:{id:'receipt',path,mime:'image/png'}};},adminRead:async()=>order,delivered:async()=>{},cursor:async()=>0} as unknown as OrderService;
  const room='22222222-2222-4222-8222-222222222222';
  const chat={roomForCustomer:async(id:string)=>{assert.equal(id,'player2');return room;},topic:async(id:string)=>{assert.equal(id,room);return{topicId:'502',create:false};},claim:async()=>null} as unknown as CustomerChat;
  await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal,chat);
  assert.equal(Number(sent.message_thread_id),502);
  assert.match(sent.caption??sent.text,/2222222222/);
  const keyboard=typeof sent.reply_markup==='string'?JSON.parse(sent.reply_markup):sent.reply_markup;
  assert.ok(keyboard.inline_keyboard.flat().some((b:any)=>b.callback_data===`c:${room}:issue:0`));
 }}finally{globalThis.fetch=originalFetch;await unlink(path);}
});

test('orders missing an owning customer remain queued instead of leaking into General',async()=>{
 const originalFetch=globalThis.fetch,controller=new AbortController();let failed=false,sent=false;
 globalThis.fetch=async(input)=>{if(String(input).includes('/send'))sent=true;await new Promise(resolve=>setTimeout(resolve,5));return Response.json({ok:true,result:[]});};
 const service={claim:async()=>({id:'job',order_id:'order',kind:'order',payload:{}}),adminRead:async()=>({id:'order',customer_id:null}),failed:async()=>{failed=true;controller.abort();},cursor:async()=>0} as unknown as OrderService;
 try{await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal,{} as CustomerChat);assert.equal(failed,true);assert.equal(sent,false);}
 finally{globalThis.fetch=originalFetch;controller.abort();}
});

test('viewing an old General card sends its details into the owning player topic',async()=>{
 const originalFetch=globalThis.fetch,controller=new AbortController();let emitted=false,sent:any;
 const id='11111111-1111-4111-8111-111111111111';
 globalThis.fetch=async(input,init)=>{
  const method=String(input).split('/').pop();
  if(method==='getMe')return Response.json({ok:true,result:{has_topics_enabled:true}});
  if(method==='sendMessage'){sent=JSON.parse(String(init?.body));controller.abort();return Response.json({ok:true,result:{message_id:42}});}
  if(method==='getUpdates'&&!emitted){emitted=true;return Response.json({ok:true,result:[{update_id:42,callback_query:{id:'view',from:{id:123},message:{chat:{id:123,type:'private'}},data:`v:${id}`}}]});}
  await new Promise(resolve=>setTimeout(resolve,5));return Response.json({ok:true,result:[]});
 };
 const service={claim:async()=>null,cursor:async()=>0,advance:async()=>{},adminRead:async()=>({id,customer_id:'player3',public_snapshot:{name:'310 Diamonds',player:{UID:'3333333333'}},receipts:[]})} as unknown as OrderService;
 const chat={claim:async()=>null,roomForCustomer:async(customer:string)=>{assert.equal(customer,'player3');return 'room3';},topic:async(room:string)=>{assert.equal(room,'room3');return{topicId:'503',create:false};}} as unknown as CustomerChat;
 try{await runTelegram(cardStorage(service),{token:'fake',chatId:'123',userId:'123',botKey:'test'},controller.signal,chat);assert.equal(sent.message_thread_id,503);assert.match(sent.text,/3333333333/);}
 finally{globalThis.fetch=originalFetch;controller.abort();}
});
