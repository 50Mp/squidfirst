import {randomUUID} from 'node:crypto';import type {Database,Repository} from '../database.js';import {SOURCES} from '../catalog.js';import {inSyncWindow} from '../schedule.js';import {syncOnce} from '../sync.js';import {OrderError} from '../orders.js';import type {AdminActor} from '../admin/contracts.js';import {OperationsSettings} from './settings.js';import {appendAudit} from '../admin/audit.js';
export class SyncJobs{
 private pending=new Set<Promise<void>>();private controller=new AbortController();
 constructor(private db:Database,private repo:Repository,private settings:OperationsSettings){}
 async init(){await this.db.query("CREATE TABLE IF NOT EXISTS admin_sync_jobs(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");}
 async enqueue(actor:AdminActor,source:string,key:string){
  if(!SOURCES.some(s=>s.id===source))throw new OrderError(400,'Unknown source');if(!inSyncWindow(new Date()))throw new OrderError(409,'Sync allowed only 15:00–16:00 UTC+7');if(!await this.repo.sourceEnabled(source))throw new OrderError(409,'Source disabled');
  const result=await this.settings.mutate(actor,key,{source,kind:'manual-sync'},async tx=>{const id=randomUUID();await tx.query('INSERT INTO admin_sync_jobs(id,source_id) VALUES($1,$2)',[id,source]);await appendAudit(tx,actor,{action:'source.sync',entityType:'source',entityId:source,before:null,after:{job_id:id}});return{job_id:id};});
  const claimed=await this.db.query("UPDATE admin_sync_jobs SET status='running' WHERE id=$1 AND status='queued' RETURNING id",[result.job_id]);if(claimed.rows.length){let task:Promise<void>;task=(async()=>{try{await syncOnce(this.repo,source,{signal:this.controller.signal});await this.db.query("UPDATE admin_sync_jobs SET status='completed' WHERE id=$1",[result.job_id]);}catch{await this.db.query("UPDATE admin_sync_jobs SET status='failed' WHERE id=$1",[result.job_id]);}})().finally(()=>this.pending.delete(task));this.pending.add(task);}return result;
 }
 async stop(){this.controller.abort();await Promise.allSettled([...this.pending]);}
}
