import { randomBytes,randomUUID,createHash,scrypt,timingSafeEqual } from 'node:crypto';
import type { Database,SQL } from './database.js';
import { OrderError } from './orders.js';

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export type Customer={id:string;username:string;room_id:string};
export class Accounts{
 constructor(private db:Database){}
 async init(){for(const sql of [
  `CREATE TABLE IF NOT EXISTS customer_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,disabled BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `ALTER TABLE customer_accounts
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS avatar_data_url TEXT,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS customer_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT REFERENCES customer_accounts(id),expires_at TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS customer_chat_rooms(id TEXT PRIMARY KEY,customer_id TEXT UNIQUE NOT NULL REFERENCES customer_accounts(id),topic_id TEXT,topic_bot_key TEXT,topic_state TEXT NOT NULL DEFAULT 'new',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(topic_bot_key,topic_id))`,
 ])await this.db.query(sql);}
 private username(value:string){if(typeof value!=='string'||!/^[A-Za-z0-9_]{3,30}$/.test(value))throw new OrderError(400,'Username must be 3–30 letters, digits or underscores');return value.toLowerCase();}
 private password(value:string){if(typeof value!=='string'||value.length<12||value.length>128)throw new OrderError(400,'Password must be 12–128 characters');}
 private async session(tx:SQL,user:Customer){const token=randomBytes(32).toString('base64url');await tx.query("INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[digest(token),user.id]);return{token,user};}
 async register(username:string,password:string){
  const name=this.username(username);this.password(password);const salt=randomBytes(16).toString('hex'),key=await derive(password,salt);
  try{return await this.db.transaction(async tx=>{
   const user={id:randomUUID(),username:name,room_id:randomUUID()};
   await tx.query('INSERT INTO customer_accounts(id,username,password_salt,password_hash) VALUES($1,$2,$3,$4)',[user.id,name,salt,key.toString('hex')]);
   await tx.query('INSERT INTO customer_chat_rooms(id,customer_id) VALUES($1,$2)',[user.room_id,user.id]);return this.session(tx,user);
  });}catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new OrderError(409,'Username is unavailable');throw error;}
 }
 async login(username:string,password:string){
  const name=this.username(username);this.password(password);
  const row=(await this.db.query('SELECT a.*,r.id AS room_id FROM customer_accounts a JOIN customer_chat_rooms r ON r.customer_id=a.id WHERE a.username=$1',[name])).rows[0];
  const key=await derive(password,row?.password_salt??'0'.repeat(32));
  const expected=row?Buffer.from(row.password_hash,'hex'):Buffer.alloc(64);
  if(!row||row.disabled||!timingSafeEqual(key,expected))throw new OrderError(401,'Invalid username or password');
  return this.db.transaction(tx=>this.session(tx,{id:row.id,username:row.username,room_id:row.room_id}));
 }
 async authenticate(token:string,sql:SQL=this.db):Promise<Customer>{
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new OrderError(401,'Customer login required');
  const row=(await sql.query(`SELECT a.id,a.username,r.id AS room_id FROM customer_sessions s JOIN customer_accounts a ON a.id=s.customer_id JOIN customer_chat_rooms r ON r.customer_id=a.id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND a.disabled=FALSE`,[digest(token)])).rows[0];
  if(!row)throw new OrderError(401,'Customer session expired; login required');return row;
 }
 async logout(token:string){await this.db.query('DELETE FROM customer_sessions WHERE token_hash=$1',[digest(token)]);}
}
