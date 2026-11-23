import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import type {Database} from '../database.js';
import {OrderError} from '../orders.js';
import type {AdminActor} from './contracts.js';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function equal(a:string,b:string){return Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export class AdminAuth{
 constructor(private db:Database,readonly options:{botToken:string;ownerTelegramId:string;origin:string}){}
 async init(){
  if(!/^\d+$/.test(this.options.ownerTelegramId)||!this.options.botToken)throw Error('Admin owner and bot configuration required');
  for(const sql of [
   `CREATE TABLE IF NOT EXISTS admin_users(id TEXT PRIMARY KEY,telegram_user_id TEXT UNIQUE NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','operator')),disabled BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
   `CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admin_users(id),csrf_hash TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,
   `CREATE TABLE IF NOT EXISTS admin_bootstraps(init_hash TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL)`,
   `CREATE TABLE IF NOT EXISTS admin_audit(id BIGSERIAL PRIMARY KEY,actor_id TEXT NOT NULL,channel TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,before_data JSONB,after_data JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  ])await this.db.query(sql);
  const id=digest('owner:'+this.options.ownerTelegramId).slice(0,32);
  await this.db.query("INSERT INTO admin_users(id,telegram_user_id,role) VALUES($1,$2,'owner') ON CONFLICT(telegram_user_id) DO NOTHING",[id,this.options.ownerTelegramId]);
 }
 verify(raw:string,now=new Date()){
  if(typeof raw!=='string'||!raw||raw.length>16384)throw new OrderError(401,'Invalid Telegram signature');
  const p=new URLSearchParams(raw),keys=[...p.keys()];
  if(new Set(keys).size!==keys.length)throw new OrderError(401,'Invalid duplicate Telegram fields');
  const hash=p.get('hash')??'';if(!/^[a-f0-9]{64}$/.test(hash))throw new OrderError(401,'Invalid Telegram signature');p.delete('hash');
  const secret=createHmac('sha256','WebAppData').update(this.options.botToken).digest();
  const data=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  if(!equal(createHmac('sha256',secret).update(data).digest('hex'),hash))throw new OrderError(401,'Invalid Telegram signature');
  const date=Number(p.get('auth_date')),age=now.getTime()/1000-date;
  if(!Number.isSafeInteger(date)||age>300||age< -30)throw new OrderError(401,'Telegram authentication expired or future age');
  let user:any;try{user=JSON.parse(p.get('user')??'');}catch{throw new OrderError(401,'Invalid Telegram user');}
  if(!Number.isSafeInteger(user?.id)||user.id<1||user.is_bot)throw new OrderError(401,'Invalid Telegram user');
  return{telegramUserId:String(user.id),initDataHash:digest(data+'\n'+hash)};
 }
 async login(raw:string){
  const verified=this.verify(raw);
  return this.db.transaction(async tx=>{
   const user=(await tx.query('SELECT id,telegram_user_id,role FROM admin_users WHERE telegram_user_id=$1 AND disabled=FALSE',[verified.telegramUserId])).rows[0];
   if(!user||user.role!=='owner'||verified.telegramUserId!==this.options.ownerTelegramId)throw new OrderError(403,'Owner permission required');
   await tx.query('DELETE FROM admin_bootstraps WHERE expires_at<NOW()');
   const used=await tx.query("INSERT INTO admin_bootstraps(init_hash,expires_at) VALUES($1,NOW()+INTERVAL '6 minutes') ON CONFLICT DO NOTHING RETURNING init_hash",[verified.initDataHash]);
   if(!used.rows.length)throw new OrderError(401,'Telegram authentication already used; reopen Mini App');
   const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
   await tx.query("INSERT INTO admin_sessions(token_hash,admin_id,csrf_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '1 hour')",[digest(token),user.id,digest(csrf)]);
   return{token,csrf,actor:{id:user.id,telegramUserId:user.telegram_user_id,role:user.role,channel:'miniapp'} as AdminActor};
  });
 }
 async authenticate(token:string):Promise<AdminActor>{
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new OrderError(401,'Admin login required');
  const user=(await this.db.query('SELECT a.id,a.telegram_user_id,a.role FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND a.disabled=FALSE',[digest(token)])).rows[0];
  if(!user||user.role!=='owner'||user.telegram_user_id!==this.options.ownerTelegramId)throw new OrderError(401,'Admin session expired or disabled');
  return{id:user.id,telegramUserId:user.telegram_user_id,role:user.role,channel:'miniapp'};
 }
 async authorizeWrite(token:string,origin:string|undefined,csrf:string){
  const actor=await this.authenticate(token);
  if(origin!==this.options.origin)throw new OrderError(403,'Invalid admin origin');
  const row=(await this.db.query('SELECT csrf_hash FROM admin_sessions WHERE token_hash=$1',[digest(token)])).rows[0];
  if(!csrf||!equal(digest(csrf),row?.csrf_hash??''))throw new OrderError(403,'Invalid CSRF token');return actor;
 }
 async logout(token:string){await this.db.query('DELETE FROM admin_sessions WHERE token_hash=$1',[digest(token)]);}
 async telegramActor():Promise<AdminActor>{
  const user=(await this.db.query("SELECT id FROM admin_users WHERE telegram_user_id=$1 AND role='owner' AND disabled=FALSE",[this.options.ownerTelegramId])).rows[0];
  if(!user)throw new OrderError(403,'Owner permission required');return{id:user.id,telegramUserId:this.options.ownerTelegramId,role:'owner',channel:'telegram'};
 }
}
