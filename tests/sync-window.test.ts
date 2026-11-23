import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from '../src/database.js';
import { syncOnce,syncFxOnce } from '../src/sync.js';
import { selectLfxUsdRate } from '../src/fx.js';
import { openDatabase,Repository as CatalogRepository,type Database } from '../src/database.js';
import { readFile } from 'node:fs/promises';
import { validateSnapshot } from '../src/catalog.js';

test('outside the allowed window neither shop scraping nor FX fetching nor database writes occur', async () => {
  let calls = 0;
  const repo = { save:async()=>{calls++;},saveFxRate:async()=>{calls++;} } as unknown as Repository;
  const now = () => new Date('2026-11-18T14:59:59+07:00');
  const shop = await syncOnce(repo,'jorjee',{now,scrape:async()=>{calls++;return [];} });
  const fx = await syncFxOnce(repo,{now,fetchQuote:async()=>{calls++;throw Error('must not fetch');} });
  assert.equal(shop.status,'skipped'); assert.equal(fx.status,'skipped'); assert.equal(calls,0);
});

test('a collection crossing 16:00 cannot save a new snapshot or quote', async () => {
  let calls = 0;
  const repo = { save:async()=>{calls++;},saveFxRate:async()=>{calls++;} } as unknown as Repository;
  let current = new Date('2026-11-18T15:59:59+07:00');
  const now = () => current;
  await assert.rejects(syncOnce(repo,'jorjee',{now,scrape:async()=>{ current=new Date('2026-11-18T16:00:00+07:00');return [];}}),/15:00/);
  current = new Date('2026-11-18T15:59:59+07:00');
  await assert.rejects(syncFxOnce(repo,{now,fetchQuote:async()=>{
    current=new Date('2026-11-18T16:00:00+07:00');
    return selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22,688.45'}]);
  }}),/15:00/);
  assert.equal(calls,0);
});

test('database operations delayed across closing time roll back both shop and FX writes', async () => {
  const db=await openDatabase('memory:');
  let current=new Date('2026-11-18T15:59:59+07:00');
  const delayed: Database = { ...db,transaction:fn=>db.transaction(tx=>fn({query:async(sql,params)=>{
    const result=await tx.query(sql,params);
    if (sql.startsWith('UPDATE source_state') || sql.startsWith('INSERT INTO fx_rates')) current=new Date('2026-11-18T16:00:00+07:00');
    return result;
  }})) };
  const repo=new CatalogRepository(delayed); await repo.init();
  try {
    const seed=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
    await assert.rejects(syncOnce(repo,'jorjee',{now:()=>current,scrape:async()=>validateSnapshot(seed.games)}),/15:00/);
    assert.equal((await repo.packages('free-fire',false)).length,0);
    assert.equal((await repo.status()).last_success_at,null);
    current=new Date('2026-11-18T15:59:59+07:00');
    await assert.rejects(syncFxOnce(repo,{now:()=>current,fetchQuote:async()=>selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22,688.45'}])}),/15:00/);
    assert.equal(await repo.latestFxRate(),null);
  } finally { await db.close(); }
});
