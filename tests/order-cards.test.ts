import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openDatabase,Repository} from '../src/database.js';
import {OrderService} from '../src/orders.js';
import * as telegram from '../src/telegram.js';

test('each order stage offers only actions valid for its payment and status',()=>{
 const cases:[string,boolean,string[]][]=[
  ['awaiting_payment',false,['cancel']],['payment_review',false,['approve','issue','cancel']],
  ['paid',true,['accept','issue','refund']],['accepted',true,['start','issue','refund']],
  ['processing',true,['complete','issue','refund']],['completed',true,['reopen','refund']],
  ['issue',true,['resume','refund']],['issue',false,['cancel']],['cancelled',false,[]],['refunded',true,[]],
 ];
 for(const [status,verified,expected] of cases){
  const keyboard=(telegram.telegramOrderButtons as any)('order',status,'room',verified).inline_keyboard.flat();
  assert.deepEqual(keyboard.filter((b:any)=>b.callback_data.startsWith('s:')).map((b:any)=>b.callback_data.split(':').at(-1)).sort(),expected.sort(),status);
  assert.ok(keyboard.some((b:any)=>b.callback_data==='v:order'));assert.ok(keyboard.some((b:any)=>b.callback_data==='c:room:issue:0'));
 }
});

test('unchanged edits succeed without sending again; only a definitely deleted card is replaced',async()=>{
 const original=globalThis.fetch,calls:string[]=[];
 let failure='Bad Request: message is not modified';
 globalThis.fetch=async(input)=>{
  const method=String(input).split('/').pop()!;calls.push(method);
  if(method.startsWith('edit'))return Response.json({ok:false,error_code:400,description:failure},{status:400});
  return Response.json({ok:true,result:{chat:{id:123},message_id:99}});
 };
 try{
  const api=new telegram.BotApi({token:'fake',chatId:'123',userId:'123',botKey:'bot'},new AbortController().signal);
  const card={chat_id:'123',topic_id:'500',message_id:'41',media_kind:'text' as const,receipt_id:null};
  const job={order_id:'order',kind:'status',payload:{status:'paid'}};
  assert.equal((await api.send(job,undefined,500,'room',card)).message_id,41);
  failure='Bad Request: other temporary edit error';
  await assert.rejects(api.send(job,undefined,500,'room',card),/Telegram API failure/);
  assert.equal(calls.filter(c=>c==='sendMessage').length,0);
  failure='Bad Request: message to edit not found';
  assert.equal((await api.send(job,undefined,500,'room',card)).message_id,99);
  assert.equal(calls.filter(c=>c==='sendMessage').length,1);
 }finally{globalThis.fetch=original;}
});

test('simultaneous status and view requests share one persisted card across worker restart',async()=>{
 const original=globalThis.fetch,calls:any[]=[],stored=new Map<string,any>();
 globalThis.fetch=async(input,init)=>{
  const method=String(input).split('/').pop()!,body=JSON.parse(String(init?.body));calls.push({method,body});
  await new Promise(resolve=>setTimeout(resolve,5));
  return Response.json({ok:true,result:{chat:{id:123},message_id:body.message_id??42}});
 };
 const config={token:'fake',chatId:'123',userId:'123',botKey:'bot'};
 const latest={id:'order',status:'completed',payment_verified:true,public_snapshot:{name:'310 Diamonds'},receipts:[]};
 const service={adminRead:async()=>latest,orderCard:async(bot:string,id:string)=>stored.get(`${bot}:${id}`)??null,saveOrderCard:async(bot:string,id:string,card:any)=>{stored.set(`${bot}:${id}`,card);}} as unknown as OrderService;
 try{
  const deliver=telegram.createOrderCardDelivery(service,config,new telegram.BotApi(config,new AbortController().signal));
  const stale={...latest,status:'processing'};
  await Promise.all([deliver({order_id:'order',kind:'status',payload:{}},stale,{threadId:500,roomId:'room'}),deliver({order_id:'order',kind:'order',payload:{}},stale,{threadId:500,roomId:'room'})]);
  assert.deepEqual(calls.map(c=>c.method),['sendMessage','editMessageText']);
  assert.ok(calls.every(c=>c.body.text.includes('เติมสำเร็จ')),'Render latest database state rather than a stale request snapshot');
  const restarted=telegram.createOrderCardDelivery(service,config,new telegram.BotApi(config,new AbortController().signal));
  await restarted({order_id:'order',kind:'status',payload:{}},latest,{threadId:500,roomId:'room'});
  assert.equal(calls.at(-1).method,'editMessageText');assert.equal(calls.at(-1).body.message_id,42);
  await restarted({order_id:'order',kind:'status',payload:{}},latest,{threadId:501,roomId:'replacement-room'});
  assert.equal(calls.at(-1).method,'sendMessage');assert.equal(calls.at(-1).body.message_thread_id,501,'Never edit a card in a previous topic');
 }finally{globalThis.fetch=original;}
});

test('canonical card mappings persist and are isolated by bot and order',async()=>{
 const db=await openDatabase('memory:');
 try{
  await new Repository(db).init();const service=new OrderService(db,async()=>null);await service.init();
  for(const id of ['one','two'])await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) VALUES($1,'unused',$1,'unused','payment_review','{}','{}')",[id]);
  const card={chat_id:'123',topic_id:'500',message_id:'5',media_kind:'photo',receipt_id:'receipt'};
  await (service as any).saveOrderCard('bot-a','one',card);
  await (service as any).saveOrderCard('bot-b','one',{...card,message_id:'6'});
  await (service as any).saveOrderCard('bot-a','two',{...card,message_id:'7'});
  const reopened=new OrderService(db,async()=>null);
  assert.equal((await (reopened as any).orderCard('bot-a','one')).message_id,'5');
  assert.equal((await (reopened as any).orderCard('bot-b','one')).message_id,'6');
  assert.equal((await (reopened as any).orderCard('bot-a','two')).message_id,'7');
  assert.equal(await (reopened as any).orderCard('other-bot','one'),null);
 }finally{await db.close();}
});

test('a waiting render resolves the latest player topic after acquiring the card lock',async()=>{
 let topic=500,release!:()=>void,entered!:()=>void;
 const blocked=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
 const destinations:number[]=[],cards=new Map<string,any>();
 const order={id:'order',customer_id:'player',receipts:[]};
 const service={adminRead:async()=>order,orderCard:async()=>cards.get('order')??null,saveOrderCard:async(_bot:string,_id:string,card:any)=>{cards.set('order',card);}} as unknown as OrderService;
 const api={send:async(_job:any,_order:any,thread:number)=>{destinations.push(thread);if(destinations.length===1){entered();await blocked;}return{chat:{id:123},message_id:destinations.length,card:{media_kind:'text',receipt_id:null}};}} as unknown as telegram.BotApi;
 const deliver=telegram.createOrderCardDelivery(service,{token:'unused',chatId:'123',userId:'123',botKey:'bot'},api,async()=>({threadId:topic,roomId:'room'}));
 const first=deliver({order_id:'order',kind:'status',payload:{}},order,{threadId:500});
 await started;
 const second=deliver({order_id:'order',kind:'order',payload:{}},order,{threadId:500});
 topic=501;release();await Promise.all([first,second]);
 assert.deepEqual(destinations,[500,501]);assert.equal(cards.get('order').topic_id,'501');
});

test('status edits reuse the card and a receipt converts that same text message to a photo',async()=>{
 const original=globalThis.fetch,path=join(tmpdir(),`squid-card-${randomUUID()}`),calls:any[]=[];
 await writeFile(path,Buffer.from('image fixture'));
 globalThis.fetch=async(input,init)=>{const body=init?.body instanceof FormData?Object.fromEntries(init.body.entries()):JSON.parse(String(init?.body));calls.push({method:String(input).split('/').pop(),body});return Response.json({ok:true,result:{chat:{id:123},message_id:41}});};
 try{
  const api=new (telegram as any).BotApi({token:'fake',chatId:'123',userId:'123',botKey:'bot'},new AbortController().signal);
  const order={id:'order',status:'processing',payment_verified:true,public_snapshot:{name:'310 Diamonds',game_id:'free-fire',zone:'th',player:{UID:'123'},price_usd:'0.00'},internal_snapshot:{mock:true}};
  const existing={chat_id:'123',topic_id:'500',message_id:'41',media_kind:'text',receipt_id:null};
  await api.send({order_id:'order',kind:'order',payload:{}},order,500,'room');
  await api.send({order_id:'order',kind:'status',payload:{}},{...order,status:'completed'},500,'room',existing);
  await api.send({order_id:'order',kind:'receipt',payload:{id:'r1',path,mime:'image/png'}},order,500,'room',existing);
  await api.send({order_id:'order',kind:'status',payload:{}},order,500,'room',{...existing,media_kind:'photo',receipt_id:'r1'});
  assert.deepEqual(calls.map(c=>c.method),['sendMessage','editMessageText','editMessageMedia','editMessageCaption']);
  for(const c of calls.slice(1))assert.equal(Number(c.body.message_id),41);
  const media=JSON.parse(calls[2].body.media);assert.equal(media.type,'photo');assert.match(media.caption,/310 Diamonds/);
 }finally{globalThis.fetch=original;await unlink(path);}
});
