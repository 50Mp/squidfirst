import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { OrderService,OrderError,allowedOrderActions,type TelegramOrderCard } from './orders.js';
import type { CustomerChat } from './customer-chat.js';
import { GAMES,SOURCES } from './catalog.js';

const statusNames:Record<string,string>={awaiting_payment:'รอชำระเงิน',payment_review:'รอตรวจชำระเงิน',paid:'ยืนยันรับเงินแล้ว',accepted:'รับงานแล้ว',processing:'กำลังเติม',completed:'เติมสำเร็จ',issue:'พบปัญหา',cancelled:'ยกเลิกแล้ว',refunded:'คืนเงินแล้ว'};
const statusName=(status:unknown)=>statusNames[String(status)]??String(status??'ไม่ระบุ');
const display=(value:unknown)=>value===undefined||value===null||value===''?'ไม่ระบุ':String(value).replace(/[\r\n]+/g,' ').slice(0,500);
const divider='────────────';
export const shortOrderId=(id:unknown)=>display(id).replace(/-/g,'').slice(-10);
function orderFields(order:any){
 const p=order.public_snapshot??{},inside=order.internal_snapshot??{};
 const short=(value:unknown)=>display(value).slice(0,120);
 const game=GAMES.find(g=>g.id===p.game_id)?.name??short(p.game_id);
 let name=short(p.name);
 if(name.toLowerCase().startsWith(game.toLowerCase()+' '))name=name.slice(game.length).trim();
 if(p.mock||inside.mock)name=name.replace(/\s*[—-]\s*Player\s+\d+\s*\(MOCK\)\s*$/i,'').replace(/\s*\(MOCK\)\s*$/i,'');
 const supplier=SOURCES.find(s=>s.id===inside.source_id)?.name??inside.source_name??(inside.source_id==='MOCK-NO-SUPPLIER'?'ร้านจำลอง (MOCK)':inside.source_id);
 return{p,inside,short,game,name,supplier};
}
export function formatTelegramOrder(order:any):string{
 const {p,inside,short,game,name,supplier}=orderFields(order);
 const lines=[`Order ID: ${shortOrderId(order.id)}`];
 if(p.mock||inside.mock)lines.push('🧪 MOCK — ทดสอบ ไม่ต้องโอนเงินหรือเติมจริง');
 lines.push('',`เกม: ${game}`,`UUID: ${short(p.player?.UID)}`,`โซน: ${short(p.zone).toUpperCase()}`);
 if(p.player?.['Zone ID'])lines.push(`Zone ID: ${short(p.player['Zone ID'])}`);
 lines.push(divider,`• แพ็กเกจ: ${name}`,divider,`ราคา: $${short(p.price_usd)} USD`,divider,`Supplier: ${short(supplier)}`,divider,'',`สถานะ: ${statusName(order.status)}`);
 return lines.join('\n').slice(0,900);
}
export function formatTelegramCustomer(details:any):string{
 const c=details.customer;
 const lines=['👤 รายละเอียดลูกค้า',`บัญชี: ${display(c.username)}`,`Customer ID: ${shortOrderId(c.id)}`,`สถานะบัญชี: ${c.disabled?'ระงับ':'ใช้งานได้'}`,divider,`ออเดอร์ทั้งหมด: ${details.total_orders} รายการ`,`มีปัญหา: ${details.issue_orders} รายการ`];
 for(const group of details.status_counts)lines.push(`• ${statusName(group.status)}: ${group.count}`);
 lines.push(divider,details.filter==='issue'?'⚠️ ออเดอร์ที่มีปัญหา':'📦 ประวัติออเดอร์ทั้งหมด','');
 for(const o of details.orders){
  const {p,short,game,name}=orderFields(o);
  lines.push(`Order ID: ${shortOrderId(o.id)}`,`${game} • ${name}`,`UUID: ${short(p.player?.UID)} | โซน: ${short(p.zone).toUpperCase()}`,`ราคา: $${short(p.price_usd)} USD`,`สถานะ: ${statusName(o.status)}`,divider);
 }
 if(!details.orders.length)lines.push(details.filter==='issue'?'ไม่มีออเดอร์ที่มีปัญหา':'ไม่มีรายการในหน้านี้');
 return lines.join('\n').slice(0,3900);
}

export type TelegramConfig={token:string;chatId:string;userId:string;botKey:string};
const orderIconEmoji:Record<string,string>={issue:'❗',processing:'🎮',pending:'📝',completed:'✅',closed:'📁',none:'💬'};
export async function syncTelegramTopicIcons(chat:CustomerChat,config:TelegramConfig,call:(method:string,body:any)=>Promise<any>){
 const work=await chat.orderIconWork(config.botKey);if(!work.length)return;
 const icons=await call('getForumTopicIconStickers',{});
 for(const item of work){
  try{
   const emoji=orderIconEmoji[item.order_state];
   const icon=icons.find((i:any)=>i.emoji?.replace(/\uFE0F/g,'')===emoji);
   if(!icon?.custom_emoji_id)throw new Error('Order status topic icon is unavailable');
   await call('editForumTopic',{chat_id:config.chatId,message_thread_id:Number(item.topic_id),icon_custom_emoji_id:icon.custom_emoji_id});
   await chat.orderIconApplied(item,config.botKey,icon.custom_emoji_id);
  }catch{
   try{await chat.orderIconFailed(item,config.botKey);}catch{}
   console.error('Telegram order icon update failed; retry scheduled (credentials omitted)');
  }
 }
}
export function telegramConfig():TelegramConfig|null{
 if(process.env.TELEGRAM_ENABLED!=='true')return null;
 const token=process.env.TELEGRAM_API_TOKEN_BOT||process.env.TELEGRAM_BOT_TOKEN||'',chatId=process.env.TELEGRAM_ADMIN_CHAT_ID??'',userId=process.env.TELEGRAM_ADMIN_USER_ID??'';
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(token)||! /^[1-9]\d*$/.test(chatId)||chatId!==userId)throw new Error('Set a dedicated TELEGRAM_BOT_TOKEN and matching positive private TELEGRAM_ADMIN_CHAT_ID / TELEGRAM_ADMIN_USER_ID');
 return{token,chatId,userId,botKey:createHash('sha256').update(token).digest('hex').slice(0,24)};
}
export async function processTelegramUpdate(service:OrderService,config:TelegramConfig,update:any,answer:(text:string,callbackId?:string)=>Promise<void>,chat?:CustomerChat,showOrder?:(id:string)=>Promise<void>,showCustomer?:(roomId:string,filter:'issue'|'all',offset:number,threadId:number)=>Promise<void>){
 const callback=update.callback_query,message=callback?.message??update.message,from=callback?.from??message?.from;
 if(!message||message.chat?.type!=='private'||String(message.chat.id)!==config.chatId||String(from?.id)!==config.userId||from?.is_bot)return;
 const eventKey=`tg:${config.botKey}:${update.update_id}`;
 if(callback){
  const customer=/^c:([0-9a-f-]{36}):(issue|all):(\d{1,6})$/.exec(callback.data??'');
  if(customer){
   if(!chat||!showCustomer||!message.message_thread_id||await chat.topicRoom(config.botKey,String(message.message_thread_id))!==customer[1])return;
   let response='แสดงรายละเอียดลูกค้าแล้ว';
   try{await showCustomer(customer[1],customer[2] as 'issue'|'all',Number(customer[3]),Number(message.message_thread_id));}
   catch(error){if(error instanceof OrderError)response='ไม่พบข้อมูลลูกค้า';else throw error;}
   try{await answer(response,callback.id);}catch{}return;
  }
  const view=/^v:([0-9a-f-]{36})$/.exec(callback.data??'');
  if(view){if(showOrder)await showOrder(view[1]);try{await answer('อัปเดตการ์ดออเดอร์แล้ว',callback.id);}catch{}return;}
  const parsed=/^s:([0-9a-f-]{36}):(approve|accept|start|complete|reopen|issue|resume|cancel|refund)$/.exec(callback.data??'');
  if(!parsed)return;
  let response=parsed[2]==='reopen'?'ย้อนสถานะเป็นกำลังเติมแล้ว':'บันทึกสถานะแล้ว';
  try{await service.action(parsed[1],parsed[2],eventKey);}
  catch(error){if(error instanceof OrderError)response='ไม่สามารถเปลี่ยนสถานะนี้ได้ กรุณาตรวจการชำระเงินและสถานะปัจจุบัน';else throw error;}
  // An expired callback acknowledgement must not block later durable updates.
  try{await answer(response,callback.id);}catch{console.error('Telegram callback acknowledgement failed; order processing retained');}
  return;
 }
 if(chat){
  if(message.message_thread_id){
   const room=await chat.topicRoom(config.botKey,String(message.message_thread_id));
   const text=message.text;
   if(!room||typeof text!=='string'||!text.trim())return;
   const note=/^\/note(?:@[A-Za-z0-9_]+)?\s+([\s\S]+)$/.exec(text);
   try{
    if(note)await chat.adminMessage(room,note[1],'internal',eventKey);
    else if(!text.startsWith('/'))await chat.adminMessage(room,text,'public',eventKey);
   }catch(error){if(!(error instanceof OrderError))throw error;}
   return;
  }
  const note=/^\/note(?:@[A-Za-z0-9_]+)?\s+([0-9a-f-]{36})\s+([\s\S]+)$/.exec(message.text??'');
  if(note){try{await service.adminMessage(note[1],note[2],'internal',eventKey);}catch(error){if(!(error instanceof OrderError))throw error;}}
  return; // General admin chat is never a customer conversation.
 }
 const command=/^\/(reply|note)(?:@[A-Za-z0-9_]+)?\s+([\s\S]+)$/.exec(message.text??'');
 if(!command)return; // Ordinary admin conversation never goes to the customer.
 let id:string|undefined,text:string;
 const full=/^([0-9a-f-]{36})\s+([\s\S]+)$/.exec(command[2]);
 if(full){id=full[1];text=full[2];}
 else{id=message.reply_to_message?await service.repliedOrder(config.chatId,String(message.reply_to_message.message_id)):undefined;text=command[2];}
 if(!id)return;
 try{await service.adminMessage(id,text,command[1]==='reply'?'public':'internal',eventKey);}
 catch(error){if(!(error instanceof OrderError))throw error;}
}
export function telegramOrderButtons(orderId:string,status?:string,roomId?:string,paymentVerified?:boolean){
 const verified=paymentVerified??['paid','accepted','processing','completed','refunded'].includes(status??'');
 const actions=allowedOrderActions(status??'',verified);
 const labels:Record<string,string>={approve:'ยืนยันรับเงินแล้ว',accept:'📥 รับงาน',start:'⏳ กำลังเติม',complete:'✅ เติมสำเร็จ',reopen:'↩️ กลับไปกำลังเติม',issue:'⚠️ พบปัญหา',resume:'▶️ ทำต่อ',cancel:'ยกเลิก (ยังไม่รับเงิน)',refund:'คืนเงินจริงแล้ว'};
 const buttons:{inline_keyboard:{text:string;callback_data:string}[][]}={inline_keyboard:[]};
 for(let i=0;i<actions.length;i+=2)buttons.inline_keyboard.push(actions.slice(i,i+2).map(action=>({text:labels[action],callback_data:`s:${orderId}:${action}`})));
 buttons.inline_keyboard.push([{text:'📋 ดูออเดอร์',callback_data:`v:${orderId}`}]);
 if(roomId)buttons.inline_keyboard.push([{text:'👤 รายละเอียดลูกค้า',callback_data:`c:${roomId}:issue:0`}]);
 return buttons;
}
export class TelegramApiError extends Error{
 readonly unchanged:boolean;readonly missingMessage:boolean;readonly missingTopic:boolean;readonly closedTopic:boolean;
 constructor(readonly code:number,description:string){super(`Telegram API failure ${code}`);this.unchanged=code===400&&/message is not modified/i.test(description);this.missingMessage=code===400&&/message to edit not found/i.test(description);this.missingTopic=code===400&&/message thread not found|message_thread_invalid|topic_deleted|topic_id_invalid|topic not found/i.test(description);this.closedTopic=code===400&&/topic_closed|topic is closed/i.test(description);}
}
export async function recoverCustomerTopic(chat:CustomerChat,config:TelegramConfig,api:Pick<BotApi,'call'>,roomId:string,threadId:number,error:unknown,ensureTopic:()=>Promise<number>){
 if(!(error instanceof TelegramApiError))throw error;
 if(error.closedTopic){await api.call('reopenForumTopic',{chat_id:config.chatId,message_thread_id:threadId});return threadId;}
 if(!error.missingTopic)throw error;
 await chat.topicMissing(roomId,config.botKey,String(threadId));return ensureTopic();
}
export class BotApi {
 constructor(private config:TelegramConfig,private signal:AbortSignal){}
 async call(method:string,body:unknown){
  const multipart=body instanceof FormData;
  const response=await fetch(`https://api.telegram.org/bot${this.config.token}/${method}`,{
   method:'POST',signal:AbortSignal.any([this.signal,AbortSignal.timeout(30000)]),
   headers:multipart?undefined:{'content-type':'application/json'},body:multipart?body as FormData:JSON.stringify(body),
  });
  const data=await response.json() as any;
  if(!response.ok||!data.ok)throw new TelegramApiError(Number(data.error_code)||response.status,String(data.description??''));
  return data.result;
 }
 async send(job:any,order?:any,threadId?:number,roomId?:string,existing?:TelegramOrderCard):Promise<any>{
  try{return await this.render(job,order,threadId,roomId,existing);}
  catch(error){
   if(existing&&error instanceof TelegramApiError){
    if(error.unchanged)return{chat:{id:existing.chat_id},message_id:Number(existing.message_id),card:job.kind==='receipt'?{media_kind:['image/png','image/jpeg'].includes(job.payload.mime)?'photo':'document',receipt_id:job.payload.id}:{media_kind:existing.media_kind,receipt_id:existing.receipt_id}};
    if(error.missingMessage)return this.render(job,order,threadId,roomId);
   }
   throw error;
  }
 }
 private async render(job:any,order?:any,threadId?:number,roomId?:string,existing?:TelegramOrderCard):Promise<any>{
  const buttons=telegramOrderButtons(job.order_id,order?.status??job.payload.status,roomId,order?.payment_verified);
  const result=(message:any,media_kind:TelegramOrderCard['media_kind'],receipt_id:string|null=null)=>({...message,card:{media_kind,receipt_id}});
  if(job.kind==='receipt'){
   const photo=['image/png','image/jpeg'].includes(job.payload.mime),kind=photo?'photo':'document';
   const caption=`${formatTelegramOrder(order??{id:job.order_id,status:'payment_review'})}\n📎 สลิปชำระเงิน — กรุณาตรวจด้วยมือ`;
   if(existing&&existing.media_kind===kind&&existing.receipt_id===job.payload.id){
    return result(await this.call('editMessageCaption',{chat_id:this.config.chatId,message_id:Number(existing.message_id),caption,reply_markup:buttons}),kind,job.payload.id);
   }
   const form=new FormData();form.set('chat_id',this.config.chatId);
   form.set('reply_markup',JSON.stringify(buttons));
   const file=new Blob([await readFile(job.payload.path)],{type:job.payload.mime}),filename=`receipt-${job.payload.id}.${photo?(job.payload.mime==='image/png'?'png':'jpg'):'pdf'}`;
   if(existing){form.set('message_id',existing.message_id);form.set('media',JSON.stringify({type:kind,media:'attach://receipt',caption}));form.set('receipt',file,filename);return result(await this.call('editMessageMedia',form),kind,job.payload.id);}
   if(threadId!==undefined)form.set('message_thread_id',String(threadId));form.set('caption',caption);
   form.set(photo?'photo':'document',file,filename);
   return result(await this.call(photo?'sendPhoto':'sendDocument',form),kind,job.payload.id);
  }
  let text=`Order ID: ${shortOrderId(job.order_id)}\n${divider}\n`;
  if(order&&(job.kind==='order'||job.kind==='status'))text=formatTelegramOrder(order);
  else if(job.kind==='order')text=formatTelegramOrder({id:job.order_id,status:job.payload.status??'awaiting_payment',public_snapshot:job.payload.public,internal_snapshot:job.payload.internal});
  else if(job.kind==='message')text+=`ข้อความลูกค้า:\n${job.payload.text}\n\nตอบโดย Reply ข้อความนี้แล้วพิมพ์ /reply คำตอบ\nบันทึกภายในใช้ /note ข้อความ`;
  else text+=`สถานะ: ${statusName(job.payload.status)}`;
  if(existing){
   if(existing.media_kind!=='text')return result(await this.call('editMessageCaption',{chat_id:this.config.chatId,message_id:Number(existing.message_id),caption:`${text}\n📎 สลิปชำระเงิน — กรุณาตรวจด้วยมือ`,reply_markup:buttons}),existing.media_kind,existing.receipt_id);
   return result(await this.call('editMessageText',{chat_id:this.config.chatId,message_id:Number(existing.message_id),text:text.slice(0,4000),reply_markup:buttons}),'text');
  }
  return result(await this.call('sendMessage',{chat_id:this.config.chatId,...(threadId===undefined?{}:{message_thread_id:threadId}),text:text.slice(0,4000),reply_markup:buttons}),'text');
 }
}
export function createOrderCardDelivery(service:OrderService,config:TelegramConfig,api:BotApi,resolveDestination?:(order:any)=>Promise<{threadId?:number;roomId?:string}>,recoverDestination?:(destination:{threadId?:number;roomId?:string},error:unknown)=>Promise<{threadId?:number;roomId?:string}>){
 const locks=new Map<string,Promise<void>>();
 return async(job:any,order:any,destination:{threadId?:number;roomId?:string})=>{
  if(job.kind==='message'){if(resolveDestination)destination=await resolveDestination(order);return api.send(job,order,destination.threadId,destination.roomId);}
  const key=String(job.order_id),previous=locks.get(key)??Promise.resolve();
  let release!:()=>void;const current=new Promise<void>(resolve=>{release=resolve;});locks.set(key,current);
  await previous;
  try{
   // Read after the per-order lock so a delayed view/status job cannot restore stale content.
   if(order)order=await service.adminRead(job.order_id);
   if(resolveDestination)destination=await resolveDestination(order);
   const receipt=order?.receipts?.[0];
   const effective=receipt?{...job,kind:'receipt',payload:receipt}:job;
   const saved=await service.orderCard(config.botKey,job.order_id);
   const existing=saved?.chat_id===config.chatId&&saved.topic_id===(destination.threadId===undefined?null:String(destination.threadId))?saved:undefined;
   let result:any;
   try{result=await api.send(effective,order,destination.threadId,destination.roomId,existing);}
   catch(error){if(!recoverDestination)throw error;const priorThread=destination.threadId;destination=await recoverDestination(destination,error);result=await api.send(effective,order,destination.threadId,destination.roomId,priorThread===destination.threadId?existing:undefined);}
   await service.saveOrderCard(config.botKey,job.order_id,{chat_id:String(result.chat.id),topic_id:destination.threadId===undefined?null:String(destination.threadId),message_id:String(result.message_id),media_kind:result.card.media_kind,receipt_id:result.card.receipt_id});
   return result;
  }finally{release();if(locks.get(key)===current)locks.delete(key);}
 };
}
export type RunTelegramOptions={
 stopOnConflict?:boolean;
 beforeUpdate?:(update:any)=>Promise<boolean>|boolean;
};
export async function runTelegram(service:OrderService,config:TelegramConfig,signal:AbortSignal,chat?:CustomerChat,operationalAlerts?:(send:(text:string)=>Promise<unknown>)=>Promise<void>,options?:RunTelegramOptions){
 const internalAbort=new AbortController();
 const effectiveSignal=AbortSignal.any([signal,internalAbort.signal]);
 const api=new BotApi(config,effectiveSignal);
 let topicsEnabled=false,lastTopicCheck=0;
 const ensureTopic=async(roomId:string)=>{
  if(!chat)throw new Error('Customer chat configuration required');
  if(Date.now()-lastTopicCheck>60000){const me=await api.call('getMe',{});topicsEnabled=Boolean(me.has_topics_enabled);lastTopicCheck=Date.now();}
  if(!topicsEnabled)throw new Error('Enable private Telegram Topics before customer delivery');
  const topic=await chat.topic(roomId,config.botKey);
  if(!topic)throw new Error('Customer topic requires manual attention');
  let topicId=topic.topicId;
  if(topic.create){
   try{const created=await api.call('createForumTopic',{chat_id:config.chatId,name:topic.name});topicId=String(created.message_thread_id);await chat.topicCreated(roomId,config.botKey,topicId);}
   catch(error){try{await chat.topicFailed(roomId);}catch{}throw error;}
  }
  if(!topicId||!Number.isSafeInteger(Number(topicId))||Number(topicId)<1)throw new Error('Invalid customer topic');
  return Number(topicId);
 };
 const orderDestination=async(order:any)=>{
  if(!chat)return{};
  if(!order.customer_id)throw new OrderError(409,'Order requires an owning customer before topic delivery');
  const roomId=await chat.roomForCustomer(order.customer_id);
  return{roomId,threadId:await ensureTopic(roomId)};
 };
 const recoverDestination=async(destination:{threadId?:number;roomId?:string},error:unknown)=>{if(!chat||!destination.roomId||destination.threadId===undefined)throw error;return{...destination,threadId:await recoverCustomerTopic(chat,config,api,destination.roomId,destination.threadId,error,()=>ensureTopic(destination.roomId!))};};
 const deliverCard=createOrderCardDelivery(service,config,api,orderDestination,recoverDestination);
 const delivery=async()=>{
  while(!effectiveSignal.aborted){
   let job:any,chatJob:any;
   try{
    job=await service.claim();
    if(job){const order=chat||job.kind==='receipt'?await service.adminRead(job.order_id):undefined;const result=await deliverCard(job,order,{});await service.delivered(job,String(result.chat.id),String(result.message_id));continue;}
    if(chat){
     if(Date.now()-lastTopicCheck>60000){const me=await api.call('getMe',{});topicsEnabled=Boolean(me.has_topics_enabled);lastTopicCheck=Date.now();if(!topicsEnabled)console.error('Telegram customer rooms waiting: enable private Topics in BotFather');}
     if(topicsEnabled){
      chatJob=await chat.claim();
      if(chatJob){
       let topicId=await ensureTopic(chatJob.room_id);
       const send=()=>api.call('sendMessage',{chat_id:config.chatId,message_thread_id:Number(topicId),text:chatJob.text,reply_markup:{inline_keyboard:[[{text:'👤 รายละเอียดลูกค้า',callback_data:`c:${chatJob.room_id}:issue:0`}]]}});
       try{await send();}catch(error){topicId=await recoverCustomerTopic(chat,config,api,chatJob.room_id,topicId,error,()=>ensureTopic(chatJob.room_id));await send();}
       await chat.delivered(chatJob.id);continue;
      }
     }
    }
   }catch(error){
    if(job){try{await service.failed(job.id);}catch{/* A pending lease is reclaimed after database recovery. */}}
    if(chatJob&&chat){try{await chat.failed(chatJob.id);}catch{}}
    if(!effectiveSignal.aborted)console.error('Telegram delivery failed; queued for retry (credentials and content omitted)',error instanceof TelegramApiError?{code:error.code,missingTopic:error.missingTopic,closedTopic:error.closedTopic}: {kind:'network_or_database'});
   }
   try{await delay(1000,undefined,{signal:effectiveSignal});}catch{break;}
  }
 };
 const updates=async()=>{
  while(!effectiveSignal.aborted){
   try{
    const offset=await service.cursor(config.botKey);
    const incoming=await api.call('getUpdates',{offset,timeout:20,allowed_updates:['message','callback_query']});
    for(const update of incoming){
     if(effectiveSignal.aborted)break;
     if(options?.beforeUpdate){
      const allowed=await options.beforeUpdate(update);
      if(!allowed){
       internalAbort.abort();
       throw new Error('Update rejected outside acceptance');
      }
     }
     await processTelegramUpdate(service,config,update,async(text,id)=>{if(id)await api.call('answerCallbackQuery',{callback_query_id:id,text});},chat,async(id)=>{
      const order=await service.adminRead(id);
      await deliverCard({order_id:id,kind:'order',payload:{}},order,{});
     },async(roomId,filter,offset,threadId)=>{
      if(!chat)return;
      const details=await chat.adminCustomer(roomId,filter,offset);
      const keyboard:any[][]=[[{text:'⚠️ ออเดอร์ที่มีปัญหา',callback_data:`c:${roomId}:issue:0`},{text:'📦 ออเดอร์ทั้งหมด',callback_data:`c:${roomId}:all:0`}]];
      for(const order of details.orders){
       keyboard.push([{text:`📋 ${shortOrderId(order.id)}`,callback_data:`v:${order.id}`}]);
      }
      const count=filter==='issue'?details.issue_orders:details.total_orders,pages:any[]=[];
      if(offset>0)pages.push({text:'⬅️ ก่อนหน้า',callback_data:`c:${roomId}:${filter}:${Math.max(0,offset-5)}`});
      if(offset+5<count)pages.push({text:'ถัดไป ➡️',callback_data:`c:${roomId}:${filter}:${offset+5}`});
      if(pages.length)keyboard.push(pages);
      await api.call('sendMessage',{chat_id:config.chatId,message_thread_id:threadId,text:formatTelegramCustomer(details),reply_markup:{inline_keyboard:keyboard}});
     });
     await service.advance(config.botKey,update.update_id+1);
    }
   }catch(err:any){
    if(options?.stopOnConflict&&(err?.code===409||err?.status===409)){
     internalAbort.abort();
     throw err;
    }
    if(err?.message==='Update rejected outside acceptance'){
     internalAbort.abort();
     throw err;
    }
    if(!effectiveSignal.aborted)console.error('Telegram polling failed; check bot token, private admin IDs, webhook conflicts or network');
    try{await delay(5000,undefined,{signal:effectiveSignal});}catch{break;}
   }
  }
 };
 const icons=async()=>{
  if(!chat?.orderIconWork)return;
  let availableIcons:any;
  const iconCall=async(method:string,body:any)=>method==='getForumTopicIconStickers'?(availableIcons??=await api.call(method,body)):api.call(method,body);
  while(!effectiveSignal.aborted){
   try{await syncTelegramTopicIcons(chat,config,iconCall);}catch{if(!effectiveSignal.aborted)console.error('Telegram topic icon sync failed; retry scheduled (credentials omitted)');}
   try{await delay(5000,undefined,{signal:effectiveSignal});}catch{break;}
  }
 };
 const alerts=async()=>{while(!effectiveSignal.aborted&&operationalAlerts){try{await operationalAlerts(text=>api.call('sendMessage',{chat_id:config.chatId,text}));}catch{if(!effectiveSignal.aborted)console.error('Operational alert retry scheduled');}try{await delay(60000,undefined,{signal:effectiveSignal});}catch{break;}}};
 await Promise.all([delivery(),updates(),icons(),alerts()]);
}
