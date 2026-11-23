import { setTimeout as delay } from 'node:timers/promises';
import type { Repository } from './database.js';
import { scrapeCatalog } from './scraper.js';
import { scrapeGgxg } from './ggxg.js';
import { SOURCES } from './catalog.js';
import type { Snapshot } from './catalog.js';
import { fetchLfxRate,type LfxQuote } from './fx.js';
import { inSyncWindow,nextOpening,requireSyncWindow,ingestionSignal,workerDelay,SYNC_TIMEZONE,SYNC_WINDOW } from './schedule.js';

type Options = { now?:()=>Date; signal?:AbortSignal };
function skipped(now: Date) {
  const result = {status:'skipped' as const,reason:'Outside ingestion window',time_window:SYNC_WINDOW,timezone:SYNC_TIMEZONE,next_open_at:nextOpening(now).toISOString()};
  console.log(result); return result;
}

async function catalogRun(repo: Repository, sourceId = 'jorjee', options: Options & {scrape?:(source:string,signal:AbortSignal)=>Promise<Snapshot[]>} = {}) {
  const now = options.now ?? (()=>new Date());
  if (!SOURCES.some(s => s.id === sourceId)) throw new Error('Unknown source');
  const started = now();
  if (!inSyncWindow(started)) return skipped(started);
  if(repo.sourceEnabled&&!(await repo.sourceEnabled(sourceId)))return{status:'skipped' as const,reason:'Source disabled',source:sourceId};
  const signal = ingestionSignal(started,options.signal);
  const scrape = options.scrape ?? ((id:string,s:AbortSignal) => id === 'ggxg' ? scrapeGgxg(s) : scrapeCatalog(s));
  const snapshot = await scrape(sourceId,signal);
  requireSyncWindow(now()); signal.throwIfAborted();
  const observedAt = started.toISOString();
  await repo.save(snapshot, observedAt, 'live', sourceId,()=>{requireSyncWindow(now());signal.throwIfAborted();});
  const result = { status:'updated' as const,source: sourceId, observed_at: observedAt, variants: snapshot.length, packages: snapshot.reduce((n, g) => n + g.packages.length, 0) };
  console.log('Catalog sync succeeded', result);
  return result;
}

async function fxRun(repo: Repository, options: Options & {fetchQuote?:(signal:AbortSignal)=>Promise<LfxQuote>} = {}) {
  const now = options.now ?? (()=>new Date()); const started=now();
  if (!inSyncWindow(started)) return skipped(started);
  const signal = ingestionSignal(started,options.signal);
  const quote = await (options.fetchQuote ?? fetchLfxRate)(signal);
  const fetchedAt=now(); requireSyncWindow(fetchedAt); signal.throwIfAborted();
  await repo.saveFxRate(quote,fetchedAt.toISOString(),()=>{requireSyncWindow(now());signal.throwIfAborted();});
  console.log('LFX USD quote updated', {lak_per_usd:quote.lak_per_usd,time_window:quote.time_window,published_date:quote.published_date});
  return {status:'updated' as const,lak_per_usd:quote.lak_per_usd,fetched_at:fetchedAt.toISOString()};
}

async function tracked<T>(repo:Repository,source:string,now:Date,run:()=>Promise<T>){
 if(!inSyncWindow(now)||!repo.beginSync)return run();
 const id=await repo.beginSync(source);if(!id)return{status:'skipped' as const,reason:'Sync already running',source};
 try{const result=await run();await repo.finishSync(id,'completed',result);return result;}catch(error){await repo.finishSync(id,'failed',{reason:'Fetch or validation failed; previous snapshot retained'});throw error;}
}
export function syncOnce(repo:Repository,sourceId='jorjee',options:Parameters<typeof catalogRun>[2]={}){return tracked(repo,sourceId,(options.now??(()=>new Date()))(),()=>catalogRun(repo,sourceId,options));}
export function syncFxOnce(repo:Repository,options:Parameters<typeof fxRun>[1]={}){return tracked(repo,'lfx',(options.now??(()=>new Date()))(),()=>fxRun(repo,options));}

export async function runWorker(repo: Repository, intervalMs: number, signal: AbortSignal) {
  // Await every run before sleeping: a slow source never creates overlapping runs.
  while (!signal.aborted) {
    if (!inSyncWindow(new Date())) {
      const wait = workerDelay(new Date(),intervalMs);
      console.log('Waiting for daily ingestion window', {timezone:SYNC_TIMEZONE,window:SYNC_WINDOW,next_open_at:nextOpening(new Date()).toISOString()});
      try { await delay(wait,undefined,{signal}); } catch (error) { if (!signal.aborted) throw error; }
      continue;
    }
    try { await syncFxOnce(repo,{signal}); }
    catch (error) { console.error('LFX sync failed; stored quote retained:',error); }
    for (const source of SOURCES) {
      if (signal.aborted) break;
      try { await syncOnce(repo, source.id,{signal}); }
      catch (error) { console.error(`${source.id} sync failed; previous snapshot retained:`, error); }
    }
    if (signal.aborted) break;
    try { await delay(workerDelay(new Date(),intervalMs), undefined, { signal }); }
    catch (error) { if (!signal.aborted) throw error; }
  }
}
