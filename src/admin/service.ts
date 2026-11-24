import {Repository,type Database} from '../database.js';
import {OrderService,OrderError,allowedOrderActions} from '../orders.js';
import type {CustomerChat} from '../customer-chat.js';
import type {AdminActor} from './contracts.js';
import {OperationsSettings} from '../operations/settings.js';
import {appendAudit} from './audit.js';
import {SOURCES} from '../catalog.js';
import {validateDecimal} from '../fx.js';
import {initAdminEvents} from './events.js';
import {adminOverview} from './overview.js';

export class AdminService{
 readonly settings:OperationsSettings;
 constructor(readonly db:Database,readonly orders:OrderService,readonly chat:CustomerChat,readonly repo=new Repository(db)){this.settings=new OperationsSettings(db,repo);}
 async init(){await this.settings.init();await initAdminEvents(this.db);}
 async listOrders(query:{status?:string;customer_id?:string;game_id?:string;search?:string;cursor?:string;limit?:number;active_only?:boolean;include_mock?:boolean}={}){
  const limit=Math.min(50,Math.max(1,Number(query.limit)||30)),params:any[]=[],conditions:string[]=[];
  const bind=(value:any)=>{params.push(value);return'$'+params.length;};
  if(query.active_only===true)conditions.push("o.status NOT IN ('completed','cancelled','refunded')");
  if(query.include_mock===false)conditions.push("COALESCE(o.public_snapshot->>'mock','false')<>'true'");
  if(query.customer_id)conditions.push('o.customer_id='+bind(query.customer_id));
  if(query.game_id)conditions.push("o.public_snapshot->>'game_id'="+bind(query.game_id));
  if(query.search){const key=bind('%'+query.search.slice(0,100)+'%');conditions.push(`(o.id ILIKE ${key} OR a.username ILIKE ${key} OR o.public_snapshot::text ILIKE ${key})`);}
  const filters=conditions.length?'WHERE '+conditions.join(' AND '):'';
  const countParams=params.slice();
  if(query.status)conditions.push('o.status='+bind(query.status));
  if(query.cursor){let cursor:any;try{cursor=JSON.parse(Buffer.from(query.cursor,'base64url').toString());}catch{throw new OrderError(400,'Invalid cursor');}if(typeof cursor.id!=='string'||cursor.id.length>100||!Number.isFinite(Date.parse(cursor.at)))throw new OrderError(400,'Invalid cursor');conditions.push(`(o.created_at,o.id)<(${bind(cursor.at)}::timestamptz,${bind(cursor.id)})`);}
  const [{rows},{rows:totals}]=await Promise.all([
   this.db.query(`SELECT o.id,o.status,o.payment_verified,o.revision,o.assigned_admin_id,o.customer_id,a.username,o.public_snapshot AS details,o.created_at,o.internal_snapshot->>'source_id' AS supplier_id FROM orders o LEFT JOIN customer_accounts a ON a.id=o.customer_id ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY o.created_at DESC,o.id DESC LIMIT ${bind(limit+1)}`,params),
   this.db.query(`SELECT o.status,COUNT(*)::int AS count FROM orders o LEFT JOIN customer_accounts a ON a.id=o.customer_id ${filters} GROUP BY o.status`,countParams),
  ]);
  const data=rows.slice(0,limit),last=data.at(-1);
  return{data:data.map(({supplier_id,...r})=>({...r,supplier_name:SOURCES.find(s=>s.id===supplier_id)?.name??null,allowed_actions:allowedOrderActions(r.status,r.payment_verified)})),counts:Object.fromEntries(totals.map(r=>[r.status,r.count])),next_cursor:rows.length>limit?Buffer.from(JSON.stringify({at:new Date(last.created_at).toISOString(),id:last.id})).toString('base64url'):null};
 }
 async detail(id:string){
  const o=await this.orders.adminRead(id),customer=o.customer_id?(await this.db.query('SELECT id,username,disabled,created_at FROM customer_accounts WHERE id=$1',[o.customer_id])).rows[0]:null;
  return{id:o.id,status:o.status,payment_verified:o.payment_verified,revision:o.revision,assigned_admin_id:o.assigned_admin_id,customer_id:o.customer_id,customer,details:o.public_snapshot,internal:o.internal_snapshot,created_at:o.created_at,messages:o.messages,receipts:o.receipts.map(({path,...r}:any)=>({...r,url:`/admin/v1/orders/${encodeURIComponent(id)}/receipts/${encodeURIComponent(r.id)}`})),allowed_actions:allowedOrderActions(o.status,o.payment_verified)};
 }
 async act(actor:AdminActor,id:string,input:{action:string;idempotency_key:string;expected_revision:number}){
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotency_key)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<1)throw new OrderError(400,'Invalid mutation');
  await this.orders.action(id,input.action,`admin:${actor.id}:${input.idempotency_key}`,{actor,expectedRevision:input.expected_revision});return this.detail(id);
 }
 async receipt(id:string,fileId:string){const file=(await this.db.query('SELECT path,mime FROM order_receipts WHERE order_id=$1 AND id=$2',[id,fileId])).rows[0];if(!file)throw new OrderError(404,'Receipt not found');return file;}
 async customers(search='',adminId=''){
  return{data:(await this.db.query(`SELECT a.id,a.username,a.disabled,a.created_at,r.id AS room_id,r.topic_state,(SELECT COUNT(*)::int FROM orders o WHERE o.customer_id=a.id) AS order_count,latest.text AS last_message,latest.created_at AS last_message_at,(SELECT COUNT(*)::int FROM customer_chat_messages m WHERE m.room_id=r.id AND m.sender='customer' AND m.id>COALESCE((SELECT last_message_id FROM admin_chat_reads WHERE room_id=r.id AND admin_id=$2),0)) AS unread FROM customer_accounts a JOIN customer_chat_rooms r ON r.customer_id=a.id LEFT JOIN LATERAL (SELECT text,created_at FROM customer_chat_messages WHERE room_id=r.id AND visibility='public' ORDER BY id DESC LIMIT 1) latest ON TRUE WHERE a.username ILIKE $1 ORDER BY latest.created_at DESC NULLS LAST,a.created_at DESC LIMIT 100`,['%'+search.slice(0,100)+'%',adminId])).rows};
 }
 async customer(id:string){const room=(await this.db.query('SELECT id FROM customer_chat_rooms WHERE customer_id=$1',[id])).rows[0];if(!room)throw new OrderError(404,'Customer not found');const details=await this.chat.adminCustomer(room.id,'all');return{...details,...await this.listOrders({customer_id:id})};}
 async games(){
  const {rows}=await this.db.query(`SELECT g.id,g.name,g.required_fields,COALESCE(s.enabled,g.required_fields IS NOT NULL) AS enabled,
   COALESCE(s.revision,1) AS revision FROM games g LEFT JOIN game_settings s ON s.game_id=g.id ORDER BY g.id`);
  return {data:await Promise.all(rows.map(async game=>{
   const {rows:zones}=await this.db.query(`SELECT p.zone,COALESCE(s.enabled,TRUE) AS enabled,COALESCE(s.revision,1) AS revision
    FROM packages p LEFT JOIN zone_settings s ON s.game_id=p.game_id AND s.zone=p.zone
    WHERE p.game_id=$1 AND p.active=TRUE GROUP BY p.zone,s.enabled,s.revision ORDER BY p.zone`,[game.id]);
   return {...game,zones};
  }))};
 }
 async setZone(actor:AdminActor,id:string,zone:string,input:{enabled:boolean;expected_revision:number;idempotency_key:string}){
  if(zone==='unspecified'||!(await this.repo.variants(id)).some(v=>v.zone===zone))throw new OrderError(400,'Verified zone required');
  return this.settings.mutate(actor,input.idempotency_key,{id,zone,...input},async tx=>{await tx.query('INSERT INTO zone_settings(game_id,zone) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,zone]);const old=(await tx.query('SELECT enabled,revision FROM zone_settings WHERE game_id=$1 AND zone=$2 FOR UPDATE',[id,zone])).rows[0];if(old.revision!==input.expected_revision)throw new OrderError(409,'Zone changed; refresh');await tx.query('UPDATE zone_settings SET enabled=$1,revision=revision+1 WHERE game_id=$2 AND zone=$3',[input.enabled,id,zone]);await appendAudit(tx,actor,{action:'zone.toggle',entityType:'product',entityId:id+':'+zone,before:old,after:{enabled:input.enabled}});return{revision:old.revision+1};});
 }
 async setGame(actor:AdminActor,id:string,enabled:boolean,revision:number,key:string){
  const game=await this.repo.game(id);
  if(!game||typeof enabled!=='boolean'||(enabled&&!Array.isArray(game.required_fields)))throw new OrderError(400,'Invalid game');
  return this.settings.mutate(actor,key,{id,enabled,revision},async tx=>{await tx.query('INSERT INTO game_settings(game_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);const old=(await tx.query('SELECT enabled,revision FROM game_settings WHERE game_id=$1 FOR UPDATE',[id])).rows[0];if(old.revision!==revision)throw new OrderError(409,'Game changed; refresh');await tx.query('UPDATE game_settings SET enabled=$1,revision=revision+1 WHERE game_id=$2',[enabled,id]);await appendAudit(tx,actor,{action:'game.toggle',entityType:'product',entityId:id,before:old,after:{enabled}});return{enabled,revision:revision+1};});
 }
 async catalog(game:string,zone?:string){if(!await this.repo.game(game))throw new OrderError(400,'Unknown game');return{data:await this.repo.packages(game,false,zone?{zone}:{})};}
 async products(gameId?:string){
  const {rows}=await this.db.query('SELECT * FROM shop_products WHERE ($1::text IS NULL OR game_id=$1) ORDER BY name,id LIMIT 200',[gameId??null]);
  const data=[];
  for(const row of rows){
   const offers=(await this.db.query('SELECT p.* FROM packages p JOIN shop_product_offers m ON m.offer_id=p.id WHERE m.product_id=$1 AND p.game_id=$2 AND p.zone=$3 ORDER BY p.id',[row.id,row.game_id,row.zone])).rows;
   data.push({...row,preview:await this.orders.previewProduct(row.id),offer_ids:offers.map(offer=>offer.id),offers});
  }
  return{data};
 }
 async createProduct(actor:AdminActor,input:any){
  if(input.confirmed_equivalent!==true||!Array.isArray(input.offer_ids)||typeof input.name!=='string'||typeof input.zone!=='string')throw new OrderError(400,'Verify equivalent offers first');
  const defaults=await this.settings.get('pricing');const useDefault=input.use_default_markup!==false,markup=useDefault?defaults.value.default_markup_bps:input.markup_bps;
  return this.settings.mutate(actor,input.idempotency_key,input,async tx=>{const product=await this.orders.publishUsing(tx,{name:input.name,game_id:input.game_id,zone:input.zone,offer_ids:input.offer_ids,markup_bps:markup});await tx.query('UPDATE shop_products SET use_default_markup=$1,published=$2 WHERE id=$3',[useDefault,input.published===true,product.id]);await appendAudit(tx,actor,{action:'product.create',entityType:'product',entityId:product.id,before:null,after:{name:input.name,published:input.published===true}});return product;});
 }
 async updateProduct(actor:AdminActor,id:string,input:any){
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200||typeof input.published!=='boolean'||typeof input.use_default_markup!=='boolean'||!Number.isInteger(input.markup_bps)||input.markup_bps<0||input.markup_bps>10000||!['auto_cheapest','fixed_offer'].includes(input.strategy))throw new OrderError(400,'Invalid product setting');
  return this.settings.mutate(actor,input.idempotency_key,{id,...input},async tx=>{
   await tx.query('SELECT id FROM operational_settings ORDER BY id FOR SHARE');
   const old=(await tx.query('SELECT * FROM shop_products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!old)throw new OrderError(404,'Product not found');if(old.revision!==input.expected_revision)throw new OrderError(409,'Product changed; refresh');
   if(input.offer_ids!==undefined){
    if(input.confirmed_equivalent!==true||!Array.isArray(input.offer_ids)||!input.offer_ids.length||input.offer_ids.length>50||new Set(input.offer_ids).size!==input.offer_ids.length)throw new OrderError(400,'Verify equivalent offers first');
    const mapped=(await tx.query('SELECT offer_id FROM shop_product_offers WHERE product_id=$1',[id])).rows.map(r=>r.offer_id),changed=mapped.length!==input.offer_ids.length||input.offer_ids.some((offer:unknown)=>!mapped.includes(offer));
    // Existing verified mappings may remain unavailable. They must not block safely unpublishing.
    if(changed){for(const offer of input.offer_ids){if(typeof offer!=='string'||!(await tx.query('SELECT id FROM packages WHERE id=$1 AND (active=TRUE OR $4) AND game_id=$2 AND zone=$3',[offer,old.game_id,old.zone,mapped.includes(offer)])).rows.length)throw new OrderError(400,'Offer does not support verified game/zone');}await tx.query('DELETE FROM shop_product_offers WHERE product_id=$1',[id]);for(const offer of input.offer_ids)await tx.query('INSERT INTO shop_product_offers(product_id,offer_id) VALUES($1,$2)',[id,offer]);}
   }
   if(input.strategy==='fixed_offer'&&!(await tx.query('SELECT offer_id FROM shop_product_offers WHERE product_id=$1 AND offer_id=$2',[id,input.fixed_offer_id])).rows.length)throw new OrderError(400,'Choose a mapped equivalent offer');
   await tx.query('UPDATE shop_products SET name=$1,published=$2,use_default_markup=$3,markup_bps=$4,strategy=$5,fixed_offer_id=$6,revision=revision+1 WHERE id=$7',[input.name.trim(),input.published,input.use_default_markup,input.markup_bps,input.strategy,input.strategy==='fixed_offer'?input.fixed_offer_id:null,id]);
   await appendAudit(tx,actor,{action:'product.update',entityType:'product',entityId:id,before:old,after:{...input,idempotency_key:undefined}});return{id,revision:old.revision+1};
  });
 }
 async previewFx(rate:string){try{validateDecimal(rate);}catch{throw new OrderError(400,'Invalid exchange rate');}const current=await this.repo.effectiveFxRate();if(!current)return{data:[],reason:'No existing rate metadata; save a valid manual rate first'};const rows=(await this.db.query('SELECT id,name FROM shop_products WHERE published=TRUE ORDER BY name LIMIT 20')).rows;return{data:await Promise.all(rows.map(async r=>({id:r.id,name:r.name,before:await this.orders.previewProduct(r.id),after:await this.orders.previewProduct(r.id,{...current,lak_per_usd:rate})})))};}
 async chatHistory(customerId:string,after?:string,before?:string){
  if(after&&before||after&&!/^\d{1,18}$/.test(after)||before&&!/^\d{1,18}$/.test(before))throw new OrderError(400,'Invalid chat cursor');
  const room=await this.chat.roomForCustomer(customerId),messages=(await this.db.query(`SELECT id,sender,visibility,text,created_at FROM customer_chat_messages WHERE room_id=$1 ${after?'AND id>$2':before?'AND id<$2':''} ORDER BY id ${after?'ASC':'DESC'} LIMIT 100`,after||before?[room,after??before]:[room])).rows;
  if(!after)messages.reverse();const older=(await this.db.query('SELECT EXISTS(SELECT 1 FROM customer_chat_messages WHERE room_id=$1 AND id<$2) AS yes',[room,messages[0]?.id??'0'])).rows[0].yes;
  return{room_id:room,messages,next_cursor:String(messages.at(-1)?.id??after??'0'),older_cursor:String(messages[0]?.id??'0'),has_older:older};
 }
 async sendChat(actor:AdminActor,customerId:string,input:{text:string;visibility:'public'|'internal';idempotency_key:string}){
  const room=await this.chat.roomForCustomer(customerId);
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>2000||!['public','internal'].includes(input.visibility))throw new OrderError(400,'Invalid chat message');
  return this.settings.mutate(actor,input.idempotency_key,{customerId,...input},async tx=>{
   const row=(await tx.query("INSERT INTO customer_chat_messages(room_id,sender,visibility,text,event_key) VALUES($1,'admin',$2,$3,$4) RETURNING id",[room,input.visibility,input.text.trim(),'miniapp:'+actor.id+':'+input.idempotency_key])).rows[0];
   await tx.query('INSERT INTO customer_chat_jobs(id,room_id,message_id) VALUES($1,$2,$3)',[crypto.randomUUID(),room,row.id]);
   await appendAudit(tx,actor,{action:'chat.'+input.visibility,entityType:'customer',entityId:customerId,before:null,after:{message_id:row.id,visibility:input.visibility,length:input.text.trim().length}});return{accepted:true,message_id:row.id};
  });
 }
 async markChatRead(actor:AdminActor,customerId:string,last:string){
  if(!/^\d{1,18}$/.test(last))throw new OrderError(400,'Invalid chat cursor');const room=await this.chat.roomForCustomer(customerId);
  await this.db.query('INSERT INTO admin_chat_reads(admin_id,room_id,last_message_id) VALUES($1,$2,LEAST($3::bigint,COALESCE((SELECT MAX(id) FROM customer_chat_messages WHERE room_id=$2),0))) ON CONFLICT(admin_id,room_id) DO UPDATE SET last_message_id=GREATEST(admin_chat_reads.last_message_id,EXCLUDED.last_message_id)',[actor.id,room,last]);return{ok:true};
 }
 async events(after='0'){
  if(!/^\d{1,18}$/.test(after))throw new OrderError(400,'Invalid event cursor');
  const data=(await this.db.query('SELECT id,payload,created_at FROM admin_events WHERE id>$1 ORDER BY id LIMIT 200',[after])).rows;return{data,next_cursor:String(data.at(-1)?.id??after)};
 }
 async overview(from?:string,to?:string,includeMock=false){return adminOverview(this.db,from,to,includeMock);}
 async navigation(adminId:string){
  const row=(await this.db.query(`SELECT
   (SELECT COUNT(*)::int FROM orders WHERE status='payment_review' AND COALESCE(public_snapshot->>'mock','false')<>'true') AS pending_review_orders,
   COUNT(DISTINCT m.room_id)::int AS unread_chat_rooms,COUNT(m.id)::int AS unread_messages
   FROM customer_chat_messages m
   LEFT JOIN admin_chat_reads r ON r.room_id=m.room_id AND r.admin_id=$1
   WHERE m.sender='customer' AND m.visibility='public' AND m.id>COALESCE(r.last_message_id,0)`,[adminId])).rows[0];
  return{pending_review_orders:row.pending_review_orders,unread_chat_rooms:row.unread_chat_rooms,unread_messages:row.unread_messages};
 }
 async audit(before?:string){if(before&&!/^\d{1,18}$/.test(before))throw new OrderError(400,'Invalid audit cursor');return{data:(await this.db.query('SELECT id,actor_id,channel,action,entity_type,entity_id,before_data,after_data,created_at FROM admin_audit WHERE ($1::bigint IS NULL OR id<$1) ORDER BY id DESC LIMIT 100',[before??null])).rows};}
}
