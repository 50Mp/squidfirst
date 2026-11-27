import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {Repository,type Database} from '../../src/database.js';
import {Accounts} from '../../src/accounts.js';
import {CustomerChat} from '../../src/customer-chat.js';
import {OrderService} from '../../src/orders.js';
import {AdminAuth} from '../../src/admin/auth.js';
import {AdminService} from '../../src/admin/service.js';
import type {Snapshot} from '../../src/catalog.js';

export function buildAcceptanceConfig(workspace:string,source:Record<string,string|undefined>,reuseExistingBot=false){
 if(!reuseExistingBot)throw Error('Explicit --reuse-existing-bot is required for the owner-authorized test window');
 const token=source.TELEGRAM_API_TOKEN_BOT||source.TELEGRAM_BOT_TOKEN||'',chatId=source.TELEGRAM_ADMIN_CHAT_ID??'',userId=source.TELEGRAM_ADMIN_USER_ID??'';
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw Error('Existing bot credential is unavailable');
 if(!/^[1-9]\d*$/.test(chatId)||chatId!==userId)throw Error('Matching private owner IDs are required');
 const directory=resolve(workspace,'data/telegram-acceptance');
 return {directory,databaseUrl:'pglite://'+resolve(directory,'database'),origin:'https://admin-test.cffirst.com',host:'127.0.0.1',port:3200,apiKey:randomBytes(32).toString('base64url'),bot:{token,chatId,userId,botKey:createHash('sha256').update(token).digest('hex').slice(0,24)}} as const;
}
export type AcceptanceConfig=ReturnType<typeof buildAcceptanceConfig>;

export async function prepareAcceptance(db:Database,config:AcceptanceConfig,catalog:Snapshot[],receipt:{path:string;size:number}){
 const repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts);
 const auth=new AdminAuth(db,{botToken:config.bot.token,ownerTelegramId:config.bot.userId,origin:config.origin});
 const orders=new OrderService(db,sql=>repo.effectiveFxRate(sql),accounts,()=>auth.telegramActor());
 await repo.init();await accounts.init();await chat.init();await orders.init();await auth.init();const service=new AdminService(db,orders,chat,repo);await service.init();
 await db.query('CREATE TABLE IF NOT EXISTS acceptance_runs(id TEXT PRIMARY KEY,completion_order_id TEXT NOT NULL,expiry_order_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const actor=await auth.telegramActor();
 let run=(await db.query("SELECT * FROM acceptance_runs WHERE id='iphone-v1'")).rows[0];
 if(!run){
  await repo.save(catalog,'2026-11-18T08:00:00.000Z','seed');
  run=await db.transaction(async tx=>{
   const scoped:Database={query:(s,p)=>tx.query(s,p),transaction:fn=>fn(tx),close:async()=>{}};
   const r=new Repository(scoped),a=new Accounts(scoped),c=new CustomerChat(scoped,a),o=new OrderService(scoped,sql=>r.effectiveFxRate(sql),a),s=new AdminService(scoped,o,c,r);
   const fx=await s.settings.fx();await s.settings.setFx(actor,{mode:'manual',rate:'22675.43',revision:fx.revision,idempotency_key:'acceptance-manual-rate-v1'});
   const payments=await s.settings.get('payments');await s.settings.setConfig(actor,'payments',{instructions:'TEST ONLY — ห้ามโอนเงินจริงหรือเติมเกมจริง',accounts:[]},payments.revision,'acceptance-payment-instructions-v1');
   const customer=await a.register('uat_iphone',randomBytes(32).toString('base64url'));
   const offer=(await r.packages('free-fire',false,{zone:'th'}))[0];if(!offer)throw Error('Acceptance fixture has no Free Fire TH offer');
   const product=await s.createProduct(actor,{name:'TEST ONLY · Free Fire '+offer.name,game_id:'free-fire',zone:'th',offer_ids:[offer.id],confirmed_equivalent:true,published:true,use_default_markup:true,idempotency_key:'acceptance-product-v1'});
   const completion=await o.create({product_id:product.id,player:{UID:'0000000000'},token:customer.token,idempotency_key:'acceptance-completion-v1'});
   const expiry=await o.create({product_id:product.id,player:{UID:'0000000000'},token:customer.token,idempotency_key:'acceptance-expiry-v1'});
   for(const order of [completion,expiry]){
    await tx.query('UPDATE orders SET public_snapshot=public_snapshot||$1::jsonb,internal_snapshot=internal_snapshot||$1::jsonb WHERE id=$2',[JSON.stringify({mock:true,test_order:true,test_environment:'telegram-acceptance'}),order.id]);
    await tx.query("INSERT INTO order_messages(order_id,sender,visibility,text) VALUES($1,'system','internal',$2)",[order.id,'🧪 UAT: ไม่มีการโอนเงินจริง ห้ามเติมเกมหรือซื้อจากซัพพลายเออร์']);
   }
   await o.receipt(completion.id,customer.token,{id:randomUUID(),path:receipt.path,mime:'image/png',size:receipt.size});
   await tx.query("INSERT INTO acceptance_runs(id,completion_order_id,expiry_order_id) VALUES('iphone-v1',$1,$2)",[completion.id,expiry.id]);
   return (await tx.query("SELECT * FROM acceptance_runs WHERE id='iphone-v1'")).rows[0];
  });
 }
 return {repo,accounts,chat,orders,auth,service,actor,run};
}

export async function acceptanceReport(db:Database){
 const run=(await db.query("SELECT * FROM acceptance_runs WHERE id='iphone-v1'")).rows[0];if(!run)throw Error('Acceptance cases not prepared');
 const describe=async(id:string)=>{
  const row=(await db.query('SELECT id,status,payment_verified,revision,created_at FROM orders WHERE id=$1',[id])).rows[0];
  return {...row,notifications:(await db.query('SELECT kind,state,attempts FROM telegram_outbox WHERE order_id=$1',[id])).rows,audit:(await db.query('SELECT action,channel,created_at FROM admin_audit WHERE entity_id=$1 ORDER BY id',[id])).rows};
 };
 return {test_environment:true,completion:await describe(run.completion_order_id),expiry:await describe(run.expiry_order_id)};
}
