import { createHash,randomUUID } from 'node:crypto';
import type { Database,SQL } from './database.js';
import { GAMES } from './catalog.js';
import { validateDecimal,type StoredRate } from './fx.js';
import type { Accounts } from './accounts.js';
import type {AdminActor} from './admin/contracts.js';
import {appendAudit} from './admin/audit.js';
import {resolveEffectiveFxRate} from './operations/settings.js';

export class OrderError extends Error { constructor(public statusCode:number,message:string){super(message);} }
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const requireToken=(token:string)=>{if(!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw new OrderError(401,'Invalid order access token');};
export type PublishInput={name:string;game_id:string;zone:string;offer_ids:string[];markup_bps:number};
export type QuoteOverride={markup_bps:number;use_default_markup:boolean;strategy:'auto_cheapest'|'fixed_offer';fixed_offer_id?:string|null;offer_ids?:string[]};
export type TelegramOrderCard={chat_id:string;topic_id:string|null;message_id:string;media_kind:'text'|'photo'|'document';receipt_id:string|null};
export function allowedOrderActions(status:string,verified:boolean){
 if(status==='awaiting_payment'&&!verified)return['cancel'];
 if(status==='payment_review'&&!verified)return['approve','issue','cancel'];
 if(status==='paid'&&verified)return['accept','issue','refund'];
 if(status==='accepted'&&verified)return['start','issue','refund'];
 if(status==='processing'&&verified)return['complete','issue','refund'];
 if(status==='completed'&&verified)return['reopen','refund'];
 if(status==='issue')return verified?['resume','refund']:['cancel'];return[];
}
export class OrderService {
 constructor(private db:Database,private rate:(sql?:SQL)=>Promise<StoredRate|null>,private accounts?:Accounts,private telegramActor?:()=>Promise<AdminActor>){}
 async init(){
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS shop_products(id TEXT PRIMARY KEY,name TEXT NOT NULL,game_id TEXT NOT NULL,zone TEXT NOT NULL,markup_bps INTEGER NOT NULL CHECK(markup_bps BETWEEN 0 AND 10000),published BOOLEAN NOT NULL DEFAULT TRUE)`,
   `ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
   `ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS use_default_markup BOOLEAN NOT NULL DEFAULT FALSE`,
   `ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS strategy TEXT NOT NULL DEFAULT 'auto_cheapest'`,
   `ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS fixed_offer_id TEXT`,
   `CREATE TABLE IF NOT EXISTS shop_product_offers(product_id TEXT REFERENCES shop_products(id),offer_id TEXT REFERENCES packages(id),PRIMARY KEY(product_id,offer_id))`,
   `CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,product_id TEXT REFERENCES shop_products(id),token_hash TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL,status TEXT NOT NULL,payment_verified BOOLEAN NOT NULL DEFAULT FALSE,public_snapshot JSONB NOT NULL,internal_snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
   `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT`,
   `ALTER TABLE orders ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
   `ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_admin_id TEXT`,
   `CREATE TABLE IF NOT EXISTS order_messages(id BIGSERIAL PRIMARY KEY,order_id TEXT REFERENCES orders(id),sender TEXT NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('public','internal')),text TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
   `CREATE TABLE IF NOT EXISTS order_receipts(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),path TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
   `CREATE TABLE IF NOT EXISTS telegram_outbox(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),kind TEXT NOT NULL,payload JSONB NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lease_until TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
   `CREATE TABLE IF NOT EXISTS telegram_deliveries(chat_id TEXT NOT NULL,message_id TEXT NOT NULL,order_id TEXT REFERENCES orders(id),PRIMARY KEY(chat_id,message_id))`,
   `CREATE TABLE IF NOT EXISTS telegram_order_cards(bot_key TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),chat_id TEXT NOT NULL,topic_id TEXT,message_id TEXT NOT NULL,media_kind TEXT NOT NULL CHECK(media_kind IN ('text','photo','document')),receipt_id TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(bot_key,order_id))`,
   `CREATE TABLE IF NOT EXISTS telegram_events(event_key TEXT PRIMARY KEY)`,
   `ALTER TABLE telegram_events ADD COLUMN IF NOT EXISTS event_hash TEXT`,
   `CREATE TABLE IF NOT EXISTS telegram_cursor(bot_key TEXT PRIMARY KEY,next_offset BIGINT NOT NULL DEFAULT 0)`,
   `UPDATE order_messages SET visibility='internal' WHERE sender='system' AND text LIKE 'Order status: %'`,
   `CREATE INDEX IF NOT EXISTS order_messages_order ON order_messages(order_id,id)`,
   `CREATE INDEX IF NOT EXISTS orders_customer_history ON orders(customer_id,created_at DESC,id DESC)`,
   `CREATE INDEX IF NOT EXISTS telegram_outbox_pending ON telegram_outbox(state,next_at)`,
   `UPDATE telegram_outbox SET state='suppressed',lease_until=NULL
    WHERE state IN ('pending','sending')
      AND NOT(kind='status' AND payload->>'status'='completed')`,
  ])await this.db.query(sql);
 }
 private async enqueue(tx:SQL,id:string,kind:string,payload:unknown){await tx.query('INSERT INTO telegram_outbox(id,order_id,kind,payload) VALUES($1,$2,$3,$4)',[randomUUID(),id,kind,JSON.stringify(payload)]);}
 private async owned(tx:SQL,id:string,token:string,lock=false){
  requireToken(token);
  const customer=this.accounts?await this.accounts.authenticate(token,tx):null;
  const row=(await tx.query(`SELECT * FROM orders WHERE id=$1 AND ${customer?'customer_id':'token_hash'}=$2 ${lock?'FOR UPDATE':''}`,[id,customer?.id??hash(token)])).rows[0];
  if(!row)throw new OrderError(404,'Order not found');return row;
 }
 async publish(input:PublishInput){
  return this.db.transaction(tx=>this.publishUsing(tx,input));
 }
 async publishUsing(tx:SQL,input:PublishInput){
  if(!GAMES.some(g=>g.id===input.game_id)||!input.zone||input.zone==='unspecified'||!/^[a-z][a-z0-9-]{1,40}$/.test(input.zone))throw new OrderError(400,'A verified supported zone is required');
  if(!input.name.trim()||input.name.length>200||input.offer_ids.length<1||input.offer_ids.length>50||new Set(input.offer_ids).size!==input.offer_ids.length||!Number.isInteger(input.markup_bps)||input.markup_bps<0||input.markup_bps>10000)throw new OrderError(400,'Invalid product');
  const id=randomUUID();
   for(const offer of input.offer_ids){const p=(await tx.query('SELECT * FROM packages WHERE id=$1 AND active=TRUE',[offer])).rows[0];if(!p||p.game_id!==input.game_id||p.zone!==input.zone)throw new OrderError(400,'Offer does not support the verified game/zone');}
   await tx.query('INSERT INTO zone_settings(game_id,zone) VALUES($1,$2) ON CONFLICT DO NOTHING',[input.game_id,input.zone]);
   await tx.query('INSERT INTO shop_products(id,name,game_id,zone,markup_bps) VALUES($1,$2,$3,$4,$5)',[id,input.name.trim(),input.game_id,input.zone,input.markup_bps]);
   for(const offer of input.offer_ids)await tx.query('INSERT INTO shop_product_offers(product_id,offer_id) VALUES($1,$2)',[id,offer]);
  return{id};
 }
 private async quote(tx:SQL,id:string,rate:StoredRate|null,allowUnpublished=false,override?:QuoteOverride){
  const product=(await tx.query('SELECT * FROM shop_products WHERE id=$1 AND (published=TRUE OR $2)',[id,allowUnpublished])).rows[0];
  if(!product)throw new OrderError(404,'Product not found');
  if(override)Object.assign(product,override);
  const game=(await tx.query('SELECT enabled FROM game_settings WHERE game_id=$1',[product.game_id])).rows[0],zone=(await tx.query('SELECT enabled FROM zone_settings WHERE game_id=$1 AND zone=$2',[product.game_id,product.zone])).rows[0];
  if(game?.enabled===false||zone?.enabled===false)throw new OrderError(409,'Game or zone is disabled');
  if(product.use_default_markup){const settings=(await tx.query("SELECT value FROM operational_settings WHERE id='pricing'")).rows[0];product.markup_bps=settings?.value.default_markup_bps??1000;}
  if(!rate)throw new OrderError(409,'USD exchange rate unavailable');
   if(product.strategy==='fixed_offer'&&!product.fixed_offer_id)throw new OrderError(409,'Fixed supplier unavailable');
   const offer=(await tx.query(`SELECT p.* FROM packages p JOIN source_settings s ON s.source_id=p.source_id AND s.enabled=TRUE WHERE (($5::text[] IS NULL AND EXISTS(SELECT 1 FROM shop_product_offers m WHERE m.product_id=$1 AND m.offer_id=p.id)) OR p.id=ANY($5::text[])) AND p.active=TRUE AND p.game_id=$2 AND p.zone=$3 AND p.currency='LAK' AND ($4::text IS NULL OR p.id=$4) ORDER BY p.price,p.id LIMIT 1`,[id,product.game_id,product.zone,product.strategy==='fixed_offer'?product.fixed_offer_id:null,override?.offer_ids??null])).rows[0];
  if(!offer)throw new OrderError(409,'No supported supplier available');
  const {units,scale}=validateDecimal(rate.lak_per_usd);
  const numerator=BigInt(offer.price)*scale*100n*BigInt(10000+product.markup_bps),denominator=units*10000n;
  const cents=Number((numerator+denominator-1n)/denominator);
  if(!Number.isSafeInteger(cents)||cents<1||cents>2147483647)throw new OrderError(409,'Invalid selling price');
  const publicQuote={id:product.id,name:product.name,game_id:product.game_id,zone:product.zone,price_usd:`${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`,currency:'USD',required_fields:GAMES.find(g=>g.id===product.game_id)!.required_fields};
  return{product,offer,cents,publicQuote,rate};
 }
 async products(){
  const rate=await this.rate(),ids=(await this.db.query('SELECT id FROM shop_products WHERE published=TRUE ORDER BY name,id LIMIT 200')).rows;
  const result=[];for(const row of ids){try{result.push((await this.quote(this.db,row.id,rate)).publicQuote);}catch(e){if(!(e instanceof OrderError)||e.statusCode!==409)throw e;}}
  return result;
 }
 async previewProduct(id:string,rate?:StoredRate|null,override?:QuoteOverride){
  if(override&&(!Number.isInteger(override.markup_bps)||override.markup_bps<0||override.markup_bps>10000||typeof override.use_default_markup!=='boolean'||!['auto_cheapest','fixed_offer'].includes(override.strategy)||override.offer_ids&&(!Array.isArray(override.offer_ids)||!override.offer_ids.length||override.offer_ids.length>50||override.offer_ids.some(id=>typeof id!=='string'||id.length>100))))throw new OrderError(400,'Invalid preview');
  try{const q=await this.quote(this.db,id,rate===undefined?await this.rate():rate,true,override);const cost=validateDecimal(q.rate!.lak_per_usd),costCents=(BigInt(q.offer.price)*cost.scale*100n*2n+cost.units)/(cost.units*2n);return{available:true,details:q.publicQuote,source_id:q.offer.source_id,offer_id:q.offer.id,cost_lak:q.offer.price,lak_per_usd:q.rate!.lak_per_usd,markup_bps:q.product.markup_bps,estimated_gross_profit_usd:(Number(BigInt(q.cents)-costCents)/100).toFixed(2)};}
  catch(error){if(error instanceof OrderError&&[404,409].includes(error.statusCode))return{available:false,reason:error.message};throw error;}
 }
 async create(input:{product_id:string;player:Record<string,string>;token:string;idempotency_key:string}){
  requireToken(input.token);
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotency_key))throw new OrderError(400,'Invalid idempotency key');
  const player=Object.fromEntries(Object.entries(input.player).sort(([a],[b])=>a.localeCompare(b)));
  const fingerprint=hash(JSON.stringify({product_id:input.product_id,player}));
  const fallbackRate=await this.rate();
  const id=await this.db.transaction(async tx=>{
   // A transaction advisory lock serializes identical request keys across PostgreSQL API processes.
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[input.idempotency_key]);
   const customer=this.accounts?await this.accounts.authenticate(input.token,tx):null;
   const prior=(await tx.query('SELECT * FROM orders WHERE request_key=$1',[input.idempotency_key])).rows[0];
   if(prior){if((customer?prior.customer_id!==customer.id:prior.token_hash!==hash(input.token))||prior.request_hash!==fingerprint)throw new OrderError(409,'Idempotency conflict');return prior.id;}
   await tx.query('SELECT id FROM operational_settings ORDER BY id FOR SHARE');
   await tx.query('SELECT source_id FROM source_settings ORDER BY source_id FOR SHARE');
   await tx.query('SELECT game_id FROM game_settings ORDER BY game_id FOR SHARE');
   await tx.query('SELECT game_id,zone FROM zone_settings ORDER BY game_id,zone FOR SHARE');
   await tx.query('SELECT id FROM shop_products WHERE id=$1 FOR SHARE',[input.product_id]);
   const q=await this.quote(tx,input.product_id,await resolveEffectiveFxRate(tx,fallbackRate));
   const required=[...q.publicQuote.required_fields] as string[];
   if(Object.keys(player).length!==required.length||required.some(k=>typeof player[k]!=='string'||!/^\d{1,32}$/.test(player[k])))throw new OrderError(400,'Invalid player UID/Zone ID');
   const orderId=randomUUID();
   const publicSnapshot={...q.publicQuote,player};
   const internal={source_id:q.offer.source_id,source_url:q.offer.source_url,offer_id:q.offer.id,variant_id:q.offer.variant_id,cost_lak:q.offer.price,fx_rate_id:q.rate.id,lak_per_usd:q.rate.lak_per_usd,markup_bps:q.product.markup_bps,customer_id:customer?.id,chat_room_id:customer?.room_id};
   await tx.query(`INSERT INTO orders(id,product_id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,$2,$3,$4,$5,'awaiting_payment',$6,$7,$8)`,[orderId,input.product_id,hash(input.token),input.idempotency_key,fingerprint,JSON.stringify(publicSnapshot),JSON.stringify(internal),customer?.id??null]);
   return orderId;
  });return this.read(id,input.token);
 }
 async read(id:string,token:string){
  const order=await this.owned(this.db,id,token);
  const messages=(await this.db.query(`SELECT id,sender,text,created_at FROM order_messages WHERE order_id=$1 AND visibility='public' ORDER BY id LIMIT 1000`,[id])).rows;
  const receipts=(await this.db.query('SELECT id,mime,size,created_at FROM order_receipts WHERE order_id=$1 ORDER BY created_at',[id])).rows;
  return{id:order.id,status:order.status,details:order.public_snapshot,created_at:order.created_at,...(this.accounts?{}:{messages}),receipts};
 }
 async message(id:string,token:string,text:string){
  if(!text.trim()||text.length>2000)throw new OrderError(400,'Message must be 1–2000 characters');
  await this.db.transaction(async tx=>{await this.owned(tx,id,token,true);
   const count=(await tx.query(`SELECT COUNT(*)::INTEGER AS n FROM order_messages WHERE order_id=$1 AND sender='customer' AND created_at>NOW()-INTERVAL '1 minute'`,[id])).rows[0].n;
   if(count>=10)throw new OrderError(429,'Too many messages');
   await tx.query(`INSERT INTO order_messages(order_id,sender,visibility,text) VALUES($1,'customer','public',$2)`,[id,text.trim()]);
  });return{accepted:true};
 }
 async receipt(id:string,token:string,file:{id:string;path:string;mime:string;size:number}){
  await this.db.transaction(async tx=>{const order=await this.owned(tx,id,token,true);
   if(!['awaiting_payment','payment_review','issue'].includes(order.status)||order.payment_verified)throw new OrderError(409,'Receipt not accepted in current status');
   if((await tx.query('SELECT COUNT(*)::INTEGER AS n FROM order_receipts WHERE order_id=$1',[id])).rows[0].n>=5)throw new OrderError(429,'Receipt limit reached');
   await tx.query('INSERT INTO order_receipts(id,order_id,path,mime,size) VALUES($1,$2,$3,$4,$5)',[file.id,id,file.path,file.mime,file.size]);
   await tx.query("UPDATE orders SET status='payment_review',revision=revision+1 WHERE id=$1",[id]);
  });return{accepted:true};
 }
 async expireAwaitingPayment(now=new Date()):Promise<string[]>{
  return this.db.transaction(async tx=>{
   const expired=(await tx.query(
    `SELECT id FROM orders
     WHERE status='awaiting_payment' AND created_at<=$1::timestamptz-INTERVAL '15 minutes'
     ORDER BY created_at,id FOR UPDATE SKIP LOCKED`,
    [now.toISOString()],
   )).rows as {id:string}[];
   for(const {id} of expired){
    await tx.query("UPDATE orders SET status='cancelled',revision=revision+1 WHERE id=$1",[id]);
    await tx.query(
     `INSERT INTO order_messages(order_id,sender,visibility,text) VALUES($1,'system','internal','Order status: cancelled')`,
     [id],
    );
   }
   return expired.map(({id})=>id);
  });
 }
 async receiptFile(id:string,token:string,fileId:string){await this.owned(this.db,id,token);const file=(await this.db.query('SELECT * FROM order_receipts WHERE id=$1 AND order_id=$2',[fileId,id])).rows[0];if(!file)throw new OrderError(404,'Receipt not found');return file;}
 async adminMessage(id:string,text:string,visibility:'public'|'internal',eventKey:string){
  if(!text.trim()||text.length>2000)throw new OrderError(400,'Invalid reply');
  await this.db.transaction(async tx=>{
   if(!(await tx.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0])throw new OrderError(404,'Order not found');
   if(!(await tx.query('INSERT INTO telegram_events(event_key) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_key',[eventKey])).rows.length)return;
   await tx.query('INSERT INTO order_messages(order_id,sender,visibility,text) VALUES($1,$2,$3,$4)',[id,'admin',visibility,text.trim()]);
  });
 }
 async action(id:string,action:string,eventKey:string,context?:{actor:AdminActor;expectedRevision?:number}){
  const actor=context?.actor??await this.telegramActor?.();
  await this.db.transaction(async tx=>{
   const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)throw new OrderError(404,'Order not found');
   const fingerprint=hash(JSON.stringify({id,action}));
   if(!(await tx.query('INSERT INTO telegram_events(event_key,event_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_key',[eventKey,fingerprint])).rows.length){const previous=(await tx.query('SELECT event_hash FROM telegram_events WHERE event_key=$1',[eventKey])).rows[0];if(previous?.event_hash&&previous.event_hash!==fingerprint)throw new OrderError(409,'Idempotency conflict');return;}
   if(context?.expectedRevision!==undefined&&context.expectedRevision!==order.revision)throw new OrderError(409,'Order changed; refresh and retry');
   if(action==='accept'&&actor&&order.assigned_admin_id&&order.assigned_admin_id!==actor.id)throw new OrderError(409,'Order already assigned');
   let status:string,verified=order.payment_verified;
   if(action==='approve'&&order.status==='payment_review'){status='paid';verified=true;}
   else if(action==='accept'&&order.status==='paid'&&verified)status='accepted';
   else if(action==='start'&&order.status==='accepted'&&verified)status='processing';
   else if(action==='complete'&&order.status==='processing'&&verified)status='completed';
   else if(action==='reopen'&&order.status==='completed'&&verified)status='processing';
   else if(action==='issue'&&['payment_review','paid','accepted','processing'].includes(order.status))status='issue';
   else if(action==='resume'&&order.status==='issue'&&verified)status='processing';
   else if(action==='cancel'&&['awaiting_payment','payment_review','issue'].includes(order.status)&&!verified)status='cancelled';
   else if(action==='refund'&&['paid','accepted','processing','issue','completed'].includes(order.status)&&verified)status='refunded';
   else throw new OrderError(409,'Invalid payment/status transition');
   await tx.query('UPDATE orders SET status=$1,payment_verified=$2,revision=revision+1,assigned_admin_id=CASE WHEN $4 THEN $5 ELSE assigned_admin_id END WHERE id=$3',[status,verified,id,action==='accept'&&!!actor,actor?.id??null]);
   await tx.query(`INSERT INTO order_messages(order_id,sender,visibility,text) VALUES($1,'system','internal',$2)`,[id,`Order status: ${status}`]);
   if(status==='completed')await this.enqueue(tx,id,'status',{status});
   if(actor)await appendAudit(tx,actor,{action:'order.'+action,entityType:'order',entityId:id,before:{status:order.status,payment_verified:order.payment_verified,revision:order.revision},after:{status,payment_verified:verified,revision:order.revision+1}});
  });
 }
 async pending(){return(await this.db.query("SELECT * FROM telegram_outbox WHERE state='pending' ORDER BY created_at,id LIMIT 100")).rows;}
 async claim(){return this.db.transaction(async tx=>{
  const row=(await tx.query(`SELECT * FROM telegram_outbox WHERE (state='pending' AND next_at<=NOW()) OR (state='sending' AND lease_until<NOW()) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
  if(!row)return null;await tx.query("UPDATE telegram_outbox SET state='sending',attempts=attempts+1,lease_until=NOW()+INTERVAL '90 seconds' WHERE id=$1",[row.id]);return row;
 });}
 async delivered(job:any,chatId:string,messageId:string){await this.db.transaction(async tx=>{
  await tx.query('INSERT INTO telegram_deliveries(chat_id,message_id,order_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[chatId,messageId,job.order_id]);
  await tx.query("UPDATE telegram_outbox SET state='sent',lease_until=NULL WHERE id=$1",[job.id]);
 });}
 async failed(id:string){await this.db.query("UPDATE telegram_outbox SET state=CASE WHEN attempts>=10 THEN 'failed' ELSE 'pending' END,next_at=NOW()+INTERVAL '30 seconds',lease_until=NULL WHERE id=$1",[id]);}
 async orderCard(botKey:string,orderId:string):Promise<TelegramOrderCard|null>{return(await this.db.query('SELECT chat_id,topic_id,message_id,media_kind,receipt_id FROM telegram_order_cards WHERE bot_key=$1 AND order_id=$2',[botKey,orderId])).rows[0]??null;}
 async saveOrderCard(botKey:string,orderId:string,card:TelegramOrderCard){
  await this.db.query(`INSERT INTO telegram_order_cards(bot_key,order_id,chat_id,topic_id,message_id,media_kind,receipt_id) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(bot_key,order_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,topic_id=EXCLUDED.topic_id,message_id=EXCLUDED.message_id,media_kind=EXCLUDED.media_kind,receipt_id=EXCLUDED.receipt_id,updated_at=NOW()`,[botKey,orderId,card.chat_id,card.topic_id,card.message_id,card.media_kind,card.receipt_id]);
 }
 async repliedOrder(chatId:string,messageId:string){return(await this.db.query('SELECT order_id FROM telegram_deliveries WHERE chat_id=$1 AND message_id=$2',[chatId,messageId])).rows[0]?.order_id;}
 async cursor(botKey:string){return Number((await this.db.query('SELECT next_offset FROM telegram_cursor WHERE bot_key=$1',[botKey])).rows[0]?.next_offset??0);}
 async advance(botKey:string,next:number){await this.db.query('INSERT INTO telegram_cursor(bot_key,next_offset) VALUES($1,$2) ON CONFLICT(bot_key) DO UPDATE SET next_offset=GREATEST(telegram_cursor.next_offset,EXCLUDED.next_offset)',[botKey,next]);}
 async adminRead(id:string){
  const row=(await this.db.query('SELECT id,customer_id,status,payment_verified,revision,assigned_admin_id,public_snapshot,internal_snapshot,created_at FROM orders WHERE id=$1',[id])).rows[0];
  if(!row)throw new OrderError(404,'Order not found');
  return{...row,messages:(await this.db.query('SELECT id,sender,visibility,text,created_at FROM order_messages WHERE order_id=$1 ORDER BY id',[id])).rows,receipts:(await this.db.query('SELECT id,path,mime,size,created_at FROM order_receipts WHERE order_id=$1 ORDER BY created_at DESC,id DESC',[id])).rows};
 }
 async outboxStatus(){return(await this.db.query('SELECT id,order_id,state,attempts,created_at FROM telegram_outbox ORDER BY created_at DESC LIMIT 100')).rows;}
}
