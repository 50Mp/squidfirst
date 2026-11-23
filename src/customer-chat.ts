import { randomUUID } from 'node:crypto';
import type { Database } from './database.js';
import type { Accounts } from './accounts.js';
import { OrderError } from './orders.js';

export class CustomerChat{
 constructor(private db:Database,private accounts:Accounts){}
 async init(){for(const sql of [
  `CREATE TABLE IF NOT EXISTS customer_chat_messages(id BIGSERIAL PRIMARY KEY,room_id TEXT REFERENCES customer_chat_rooms(id),sender TEXT NOT NULL,visibility TEXT NOT NULL,text TEXT NOT NULL,client_key TEXT,event_key TEXT UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(room_id,client_key))`,
  `CREATE TABLE IF NOT EXISTS customer_chat_jobs(id TEXT PRIMARY KEY,room_id TEXT REFERENCES customer_chat_rooms(id),message_id BIGINT UNIQUE REFERENCES customer_chat_messages(id),state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lease_until TIMESTAMPTZ)`,
  `CREATE INDEX IF NOT EXISTS customer_chat_history ON customer_chat_messages(room_id,id)`,
  `ALTER TABLE customer_chat_rooms ADD COLUMN IF NOT EXISTS order_icon_state TEXT`,
  `ALTER TABLE customer_chat_rooms ADD COLUMN IF NOT EXISTS order_icon_id TEXT`,
  `ALTER TABLE customer_chat_rooms ADD COLUMN IF NOT EXISTS order_icon_topic_id TEXT`,
  `ALTER TABLE customer_chat_rooms ADD COLUMN IF NOT EXISTS order_icon_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
 ])await this.db.query(sql);}
 async read(token:string,after=0){
  const user=await this.accounts.authenticate(token);
  const messages=(await this.db.query(`SELECT id,sender,text,created_at FROM customer_chat_messages WHERE room_id=$1 AND visibility='public' AND id>$2 ORDER BY id LIMIT 200`,[user.room_id,after])).rows;
  return{room_id:user.room_id,messages,next_cursor:messages.at(-1)?.id??after};
 }
 async customerMessage(token:string,text:string,clientKey:string){
  if(typeof text!=='string'||!text.trim()||text.length>2000||!/^[A-Za-z0-9_-]{8,100}$/.test(clientKey))throw new OrderError(400,'Invalid chat message');
  await this.db.transaction(async tx=>{
   const user=await this.accounts.authenticate(token,tx);await tx.query('SELECT id FROM customer_chat_rooms WHERE id=$1 FOR UPDATE',[user.room_id]);
   const prior=(await tx.query('SELECT text FROM customer_chat_messages WHERE room_id=$1 AND client_key=$2',[user.room_id,clientKey])).rows[0];
   if(prior){if(prior.text!==text.trim())throw new OrderError(409,'Message idempotency conflict');return;}
   const n=(await tx.query("SELECT COUNT(*)::INTEGER AS n FROM customer_chat_messages WHERE room_id=$1 AND sender='customer' AND created_at>NOW()-INTERVAL '1 minute'",[user.room_id])).rows[0].n;
   if(n>=10)throw new OrderError(429,'Too many messages');
   const row=(await tx.query("INSERT INTO customer_chat_messages(room_id,sender,visibility,text,client_key) VALUES($1,'customer','public',$2,$3) RETURNING id",[user.room_id,text.trim(),clientKey])).rows[0];
   await tx.query('INSERT INTO customer_chat_jobs(id,room_id,message_id) VALUES($1,$2,$3)',[randomUUID(),user.room_id,row.id]);
  });return{accepted:true};
 }
 async adminMessage(roomId:string,text:string,visibility:'public'|'internal',eventKey:string){
  if(!text.trim()||text.length>2000)throw new OrderError(400,'Invalid chat message');
  await this.db.query("INSERT INTO customer_chat_messages(room_id,sender,visibility,text,event_key) VALUES($1,'admin',$2,$3,$4) ON CONFLICT(event_key) DO NOTHING",[roomId,visibility,text.trim(),eventKey]);
 }
 async topicRoom(botKey:string,topicId:string){return(await this.db.query("SELECT id FROM customer_chat_rooms WHERE topic_bot_key=$1 AND topic_id=$2 AND topic_state='active'",[botKey,topicId])).rows[0]?.id;}
 async roomForCustomer(customerId:string){
  const room=(await this.db.query('SELECT id FROM customer_chat_rooms WHERE customer_id=$1',[customerId])).rows[0];
  if(!room)throw new OrderError(404,'Customer room not found');return room.id as string;
 }
 async topic(roomId:string,botKey:string){return this.db.transaction(async tx=>{
  const row=(await tx.query('SELECT r.*,a.username FROM customer_chat_rooms r JOIN customer_accounts a ON a.id=r.customer_id WHERE r.id=$1 FOR UPDATE',[roomId])).rows[0];
  if(row.topic_state==='active'&&row.topic_bot_key===botKey)return{topicId:row.topic_id,create:false,name:''};
  if(row.topic_state!=='new')return null;
  await tx.query("UPDATE customer_chat_rooms SET topic_state='creating',topic_bot_key=$1 WHERE id=$2",[botKey,roomId]);
  return{topicId:null,create:true,name:row.username.replace(/^mock_player(\d+)$/i,'Player $1')};
 });}
 async topicCreated(roomId:string,botKey:string,id:string){await this.db.query("UPDATE customer_chat_rooms SET topic_id=$1,topic_state='active' WHERE id=$2 AND topic_bot_key=$3 AND topic_state='creating'",[id,roomId,botKey]);}
 async topicFailed(roomId:string){await this.db.query("UPDATE customer_chat_rooms SET topic_state='needs_attention' WHERE id=$1 AND topic_state='creating'",[roomId]);}
 async topicMissing(roomId:string,botKey:string,topicId:string){return this.db.transaction(async tx=>{
  const reset=await tx.query("UPDATE customer_chat_rooms SET topic_id=NULL,topic_state='new',order_icon_state=NULL,order_icon_topic_id=NULL,order_icon_retry_at=NOW() WHERE id=$1 AND topic_bot_key=$2 AND topic_id=$3 AND topic_state='active' RETURNING id",[roomId,botKey,topicId]);
  if(!reset.rows.length)return false;
  await tx.query("UPDATE customer_chat_jobs SET state='pending',attempts=0,next_at=NOW(),lease_until=NULL WHERE room_id=$1 AND state='failed'",[roomId]);return true;
 });}
 async claim(){return this.db.transaction(async tx=>{
  const job=(await tx.query("SELECT * FROM customer_chat_jobs WHERE (state='pending' AND next_at<=NOW()) OR (state='sending' AND lease_until<NOW()) ORDER BY message_id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
  if(!job)return null;await tx.query("UPDATE customer_chat_jobs SET state='sending',attempts=attempts+1,lease_until=NOW()+INTERVAL '90 seconds' WHERE id=$1",[job.id]);
  const msg=(await tx.query('SELECT text,sender,visibility FROM customer_chat_messages WHERE id=$1',[job.message_id])).rows[0];return{...job,text:msg.sender==='admin'?`${msg.visibility==='internal'?'🔒 บันทึกภายใน':'🛠 แอดมิน (Mini App)'}\n${msg.text}`:msg.text};
 });}
 async delivered(id:string){await this.db.query("UPDATE customer_chat_jobs SET state='sent',lease_until=NULL WHERE id=$1",[id]);}
 async failed(id:string){await this.db.query("UPDATE customer_chat_jobs SET state=CASE WHEN attempts>=10 THEN 'failed' ELSE 'pending' END,next_at=NOW()+INTERVAL '30 seconds',lease_until=NULL WHERE id=$1",[id]);}
 async orderIconWork(botKey:string){return(await this.db.query(`
  WITH room_status AS (
   SELECT r.id,r.topic_id,r.order_icon_state,r.order_icon_topic_id,r.order_icon_retry_at,
    CASE MIN(CASE WHEN o.status='issue' THEN 0 WHEN o.status IN ('accepted','processing') THEN 1
     WHEN o.status IN ('awaiting_payment','payment_review','paid') THEN 2 WHEN o.status='completed' THEN 3
     WHEN o.status IN ('cancelled','refunded') THEN 4 WHEN o.id IS NULL THEN 5 ELSE 2 END)
     WHEN 0 THEN 'issue' WHEN 1 THEN 'processing' WHEN 2 THEN 'pending' WHEN 3 THEN 'completed' WHEN 4 THEN 'closed' ELSE 'none' END AS order_state
   FROM customer_chat_rooms r LEFT JOIN orders o ON o.customer_id=r.customer_id
   WHERE r.topic_bot_key=$1 AND r.topic_state='active' AND r.topic_id IS NOT NULL
   GROUP BY r.id,r.topic_id,r.order_icon_state,r.order_icon_topic_id,r.order_icon_retry_at
  ) SELECT id,topic_id,order_state FROM room_status
   WHERE (order_icon_state IS DISTINCT FROM order_state OR order_icon_topic_id IS DISTINCT FROM topic_id)
    AND order_icon_retry_at<=NOW() ORDER BY order_icon_retry_at,id LIMIT 20`,[botKey])).rows;}
 async orderIconApplied(work:{id:string;topic_id:string;order_state:string},botKey:string,iconId:string){
  await this.db.query("UPDATE customer_chat_rooms SET order_icon_state=$1,order_icon_id=$2,order_icon_topic_id=$3,order_icon_retry_at=NOW() WHERE id=$4 AND topic_bot_key=$5 AND topic_id=$3 AND topic_state='active'",[work.order_state,iconId,work.topic_id,work.id,botKey]);
 }
 async orderIconFailed(work:{id:string;topic_id:string},botKey:string){
  await this.db.query("UPDATE customer_chat_rooms SET order_icon_retry_at=NOW()+INTERVAL '30 seconds' WHERE id=$1 AND topic_bot_key=$2 AND topic_id=$3",[work.id,botKey,work.topic_id]);
 }
 async adminCustomer(roomId:string,filter:'issue'|'all'='issue',offset=0){
  if(!['issue','all'].includes(filter)||!Number.isSafeInteger(offset)||offset<0||offset>999999)throw new OrderError(400,'Invalid customer history filter');
  const customer=(await this.db.query('SELECT a.id,a.username,a.created_at,a.disabled,r.id AS room_id FROM customer_accounts a JOIN customer_chat_rooms r ON r.customer_id=a.id WHERE r.id=$1',[roomId])).rows[0];
  if(!customer)throw new OrderError(404,'Customer not found');
  const counts=(await this.db.query("SELECT COUNT(*)::int AS total_orders,COUNT(*) FILTER (WHERE status='issue')::int AS issue_orders FROM orders WHERE customer_id=$1",[customer.id])).rows[0];
  const status_counts=(await this.db.query('SELECT status,COUNT(*)::int AS count FROM orders WHERE customer_id=$1 GROUP BY status ORDER BY status',[customer.id])).rows;
  const orders=(await this.db.query(`SELECT id,status,payment_verified,public_snapshot,created_at FROM orders WHERE customer_id=$1 ${filter==='issue'?"AND status='issue'":''} ORDER BY created_at DESC,id DESC LIMIT 5 OFFSET $2`,[customer.id,offset])).rows;
  return{customer,...counts,status_counts,orders,filter,offset};
 }
 async adminRooms(){return{data:(await this.db.query('SELECT r.id,a.username,r.topic_state,r.topic_id FROM customer_chat_rooms r JOIN customer_accounts a ON a.id=r.customer_id ORDER BY r.created_at DESC LIMIT 200')).rows};}
}
