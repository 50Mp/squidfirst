import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDatabase, Repository } from '../src/database.js';
import { buildApp } from '../src/app.js';
import { validateSnapshot } from '../src/catalog.js';
import { selectLfxUsdRate } from '../src/fx.js';

test('USD API exposes missing-rate status, then converts using one stored quote and retains LAK originals', async () => {
  const db = await openDatabase('memory:'); const repo = new Repository(db); await repo.init();
  const seed = JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
  await repo.save(validateSnapshot(seed.games),'2026-11-18T08:00:00Z','live');
  const app = buildApp(repo);
  try {
    const missing = (await app.inject('/games/mobile-legends-bang-bang/packages')).json();
    assert.equal(missing.conversion_status,'unavailable');
    assert.equal(missing.data[0].currency,'USD'); assert.equal(missing.data[0].price,null);
    assert.equal(missing.data[0].original_price,20000); assert.equal(missing.data[0].original_currency,'LAK');
    const quote = selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22,688.45'}]);
    await assert.rejects(repo.saveFxRate(quote,'2026-11-18T07:59:59Z'), /15:00/);
    await repo.saveFxRate(quote,'2026-11-18T08:00:00Z');
    const converted = (await app.inject('/games/mobile-legends-bang-bang/packages')).json();
    assert.equal(converted.conversion_status,'available'); assert.equal(converted.data[0].price,'0.88');
    assert.equal(converted.exchange_rate.lak_per_usd,'22688.45');
    assert.equal(converted.exchange_rate.published_date,null);
    const original = (await app.inject('/games/mobile-legends-bang-bang/packages?currency=LAK')).json();
    assert.equal(original.data[0].price,20000); assert.equal(original.data[0].currency,'LAK');
    assert.equal((await app.inject('/exchange-rates/usd-lak')).json().rate.time_window,'15:00-16:00');
    assert.equal((await app.inject('/games/free-fire/packages?currency=EUR')).statusCode,400);
    await repo.saveFxRate(quote,'2026-11-18T08:00:00Z');
    assert.equal((await db.query('SELECT COUNT(*)::INTEGER AS n FROM fx_rates')).rows[0].n,1);
    await assert.rejects(repo.saveFxRate(quote,'2026-11-18T09:00:00Z'), /15:00/);
    await assert.rejects(repo.saveFxRate(quote,'2026-11-18T08:59:59Z',()=>{throw Error('Window closed before commit');}), /Window closed/);
    assert.equal((await db.query('SELECT COUNT(*)::INTEGER AS n FROM fx_rates')).rows[0].n,1);
  } finally { await app.close(); await db.close(); }
});
