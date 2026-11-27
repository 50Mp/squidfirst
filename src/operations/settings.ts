import {createHash,randomUUID} from 'node:crypto';
import type {Database,Repository,SQL} from '../database.js';
import {SOURCES,GAMES} from '../catalog.js';
import {validateDecimal,selectLfxUsdRate,rateMetadata,type StoredRate} from '../fx.js';
import {OrderError} from '../orders.js';
import type {AdminActor} from '../admin/contracts.js';
import {appendAudit} from '../admin/audit.js';

export async function initOperationalTables(db:Database){
 for(const sql of [
  `CREATE TABLE IF NOT EXISTS source_settings(source_id TEXT PRIMARY KEY,enabled BOOLEAN NOT NULL DEFAULT TRUE,revision INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS operational_settings(id TEXT PRIMARY KEY,value JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS game_settings(game_id TEXT PRIMARY KEY,enabled BOOLEAN NOT NULL DEFAULT TRUE,revision INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS zone_settings(game_id TEXT NOT NULL,zone TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,PRIMARY KEY(game_id,zone))`,
  `ALTER TABLE zone_settings ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS sync_runs(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,status TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),finished_at TIMESTAMPTZ,lease_until TIMESTAMPTZ,result JSONB)`,
  `CREATE TABLE IF NOT EXISTS admin_mutations(key TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result JSONB NOT NULL)`,
  `INSERT INTO operational_settings(id,value) VALUES('pricing','{"default_markup_bps":1000}'),('fx','{"mode":"legacy","manual_rate_id":null}'),('payments','{"instructions":"","accounts":[]}'),('alerts','{"enabled":true}') ON CONFLICT DO NOTHING`,
 ])await db.query(sql);
 for(const s of SOURCES)await db.query('INSERT INTO source_settings(source_id) VALUES($1) ON CONFLICT DO NOTHING',[s.id]);
 for(const g of GAMES)await db.query('INSERT INTO game_settings(game_id) VALUES($1) ON CONFLICT DO NOTHING',[g.id]);
 await db.query('INSERT INTO zone_settings(game_id,zone) SELECT DISTINCT game_id,zone FROM packages ON CONFLICT DO NOTHING');
}
export async function resolveEffectiveFxRate(sql:SQL,fallback:StoredRate|null):Promise<StoredRate|null>{
 const selection=(await sql.query("SELECT value FROM operational_settings WHERE id='fx'")).rows[0]?.value;
 if(!selection||selection.mode==='legacy')return fallback;
 const manual=selection.mode==='manual';
 const row=(await sql.query(manual?'SELECT id,quote,provided_at FROM user_fx_rates WHERE id=$1':'SELECT id,quote,fetched_at FROM fx_rates ORDER BY fetched_at DESC,id DESC LIMIT 1',manual?[selection.manual_rate_id]:[])).rows[0];
 return row?{...row.quote,id:row.id,fetched_at:manual?null:row.fetched_at,provided_at:manual?row.provided_at:null,provenance:manual?'user_provided':'lfx_fetch',evidence:manual?'Admin manual selection':null,data_url:manual?null:row.quote.data_url}:null;
}
export class OperationsSettings{
 constructor(readonly db:Database,readonly repo:Repository){}
 async init(){
  await initOperationalTables(this.db);
  const row=await this.get('fx'),rate=await this.repo.latestFxRate();
  if(row.value.mode==='legacy'&&rate)await this.db.query("UPDATE operational_settings SET value=$1 WHERE id='fx' AND value->>'mode'='legacy'",[JSON.stringify({mode:rate.provenance==='user_provided'?'manual':'lfx',manual_rate_id:rate.provenance==='user_provided'?rate.id:null})]);
 }
 async get(id:string){const r=(await this.db.query('SELECT value,revision FROM operational_settings WHERE id=$1',[id])).rows[0];if(!r)throw new OrderError(404,'Setting not found');return r;}
 async mutate<T>(actor:AdminActor,key:string,input:unknown,fn:(tx:SQL)=>Promise<T>):Promise<T>{
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))throw new OrderError(400,'Invalid idempotency key');
  const full=actor.id+':'+key,fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return this.db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[full]);
   const old=(await tx.query('SELECT fingerprint,result FROM admin_mutations WHERE key=$1',[full])).rows[0];
   if(old){if(old.fingerprint!==fingerprint)throw new OrderError(409,'Idempotency conflict');return old.result;}
   const result=await fn(tx);await tx.query('INSERT INTO admin_mutations(key,fingerprint,result) VALUES($1,$2,$3)',[full,fingerprint,JSON.stringify(result)]);return result;
  });
 }
 async sources(){return(await this.db.query(`SELECT s.id,s.name,s.url,t.enabled,t.revision,st.last_success_at,st.data_origin,
  (SELECT COUNT(*)::int FROM packages p WHERE p.source_id=s.id AND p.active=TRUE) AS package_count,
  (SELECT jsonb_build_object('id',r.id,'status',CASE WHEN r.status='completed' AND r.result->>'status'='skipped' THEN 'skipped' ELSE r.status END,'at',r.created_at)
   FROM sync_runs r WHERE r.source_id=s.id ORDER BY r.created_at DESC LIMIT 1) AS last_run
  FROM sources s JOIN source_settings t ON t.source_id=s.id JOIN source_state st ON st.source_id=s.id ORDER BY s.id`)).rows;}
 async setSource(actor:AdminActor,id:string,enabled:boolean,revision:number,key:string){
  if(!SOURCES.some(s=>s.id===id)||typeof enabled!=='boolean'||!Number.isSafeInteger(revision))throw new OrderError(400,'Invalid source setting');
  return this.mutate(actor,key,{id,enabled,revision},async tx=>{
   const old=(await tx.query('SELECT enabled,revision FROM source_settings WHERE source_id=$1 FOR UPDATE',[id])).rows[0];if(old.revision!==revision)throw new OrderError(409,'Source setting changed; refresh');
   await tx.query('UPDATE source_settings SET enabled=$1,revision=revision+1 WHERE source_id=$2',[enabled,id]);
   await appendAudit(tx,actor,{action:'source.toggle',entityType:'source',entityId:id,before:old,after:{enabled,revision:revision+1}});return{enabled,revision:revision+1};
  });
 }
 async fx(){const selected=await this.get('fx'),rate=await this.repo.effectiveFxRate();return{mode:selected.value.mode==='legacy'?(rate?.provenance==='user_provided'?'manual':'lfx'):selected.value.mode,revision:selected.revision,rate:rateMetadata(rate)};}
 async setFx(actor:AdminActor,input:{mode:'lfx'|'manual';rate?:string;revision:number;idempotency_key:string}){
  if(!['lfx','manual'].includes(input.mode)||!Number.isSafeInteger(input.revision))throw new OrderError(400,'Invalid FX setting');
  if(input.mode==='manual'){try{validateDecimal(input.rate??'');}catch{throw new OrderError(400,'Invalid exchange rate');}}
  return this.mutate(actor,input.idempotency_key,input,async tx=>{
   const old=(await tx.query("SELECT value,revision FROM operational_settings WHERE id='fx' FOR UPDATE")).rows[0];if(old.revision!==input.revision)throw new OrderError(409,'Exchange rate setting changed; refresh');
   let manualId:string|null=null;
   if(input.mode==='manual'){
    manualId=randomUUID();const quote=selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:input.rate}]);
    await tx.query('INSERT INTO user_fx_rates(id,quote,evidence,provided_at) VALUES($1,$2,$3,NOW())',[manualId,JSON.stringify({...quote,data_url:null}),'Manually entered by admin '+actor.id]);
   }
   const value={mode:input.mode,manual_rate_id:manualId};await tx.query("UPDATE operational_settings SET value=$1,revision=revision+1 WHERE id='fx'",[JSON.stringify(value)]);
   await appendAudit(tx,actor,{action:'fx.select',entityType:'fx',entityId:manualId??'lfx',before:old.value,after:value});return{mode:input.mode,revision:input.revision+1};
  });
 }
 async fxHistory(){return(await this.db.query("SELECT id,quote->>'lak_per_usd' AS lak_per_usd,fetched_at AS at,'lfx' AS origin FROM fx_rates UNION ALL SELECT id,quote->>'lak_per_usd',provided_at,'manual' FROM user_fx_rates ORDER BY at DESC LIMIT 100")).rows;}
 async setConfig(actor:AdminActor,id:string,value:any,revision:number,key:string){
  if(!['pricing','payments','alerts'].includes(id)||!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>10000)throw new OrderError(400,'Invalid configuration');
  if(id==='pricing'&&(!Number.isInteger(value.default_markup_bps)||value.default_markup_bps<0||value.default_markup_bps>10000||Object.keys(value).length!==1))throw new OrderError(400,'Invalid markup');
  if(id==='alerts'&&(typeof value.enabled!=='boolean'||Object.keys(value).length!==1))throw new OrderError(400,'Invalid notification setting');
  if(id==='payments'&&(typeof value.instructions!=='string'||value.instructions.length>2000||!Array.isArray(value.accounts)||value.accounts.length>5||value.accounts.some((a:any)=>!a||typeof a.bank!=='string'||typeof a.name!=='string'||typeof a.number!=='string'||[a.bank,a.name,a.number].some(s=>s.length>150))||Object.keys(value).some(k=>!['instructions','accounts'].includes(k))))throw new OrderError(400,'Invalid payment settings');
  return this.mutate(actor,key,{id,value,revision},async tx=>{
   const old=(await tx.query('SELECT value,revision FROM operational_settings WHERE id=$1 FOR UPDATE',[id])).rows[0];if(old.revision!==revision)throw new OrderError(409,'Settings changed; refresh');
   await tx.query('UPDATE operational_settings SET value=$1,revision=revision+1 WHERE id=$2',[JSON.stringify(value),id]);
   await appendAudit(tx,actor,{action:'settings.update',entityType:'settings',entityId:id,before:old.value,after:value});return{value,revision:revision+1};
  });
 }
}
