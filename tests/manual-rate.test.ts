import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDatabase,Repository } from '../src/database.js';
import { selectLfxUsdRate,rateMetadata } from '../src/fx.js';
import { validateSnapshot } from '../src/catalog.js';
import { buildApp } from '../src/app.js';

test('user screenshot rate works outside ingestion hours without claiming an automated fetch', async () => {
  const db=await openDatabase('memory:'); const repo=new Repository(db); await repo.init();
  const quote=selectLfxUsdRate([{Time:'15:00 - 16:00',Label:'USD',Price:'22,688.45',value:'-0.39%'}]);
  try {
    const seed=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
    await repo.save(validateSnapshot(seed.games),'2026-11-18T01:00:00Z','seed');
    await repo.saveUserProvidedFxRate(quote,'evidence/lfx-usd-1500-1600.png','2026-11-18T02:30:00Z');
    const rate=await repo.latestFxRate();
    assert.equal(rate?.provenance,'user_provided'); assert.equal(rate?.fetched_at,null);
    assert.equal(rate?.published_date,null); assert.equal(rate?.data_url,null);
    assert.equal(rateMetadata(rate)?.retrieval_age_seconds,null);
    const app=buildApp(repo);
    try {
      const result=(await app.inject('/games/mobile-legends-bang-bang/packages?source=jorjee')).json();
      assert.equal(result.conversion_status,'available');assert.equal(result.data[0].price,'0.88');
      assert.equal(result.exchange_rate.provenance,'user_provided');
      assert.equal(result.data[0].original_price,20000);
    } finally {await app.close();}
    await assert.rejects(repo.saveFxRate(quote,'2026-11-18T02:30:00Z'),/15:00/);
    await repo.saveFxRate(quote,'2026-11-18T08:00:00Z');
    assert.equal((await repo.latestFxRate())?.provenance,'lfx_fetch');
  } finally {await db.close();}
});
