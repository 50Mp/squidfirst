import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSnapshot, parsePackageText, GAMES } from '../src/catalog.js';
import { openDatabase, Repository } from '../src/database.js';
import { buildApp } from '../src/app.js';

const seed = JSON.parse(await readFile(new URL('../jorjee-game-packages.json', import.meta.url), 'utf8'));
const snapshot = () => validateSnapshot(seed.games);

test('source packages retain LAK prices and first-top-up notes', () => {
  const parsed = parsePackageText('50💎 +ໂບນັດ50💎\n\nໂບນັດເຕີມຄັ້ງແລກຂອງ ID\n\n20,000 ກີບ');
  assert.equal(parsed.price, 20000);
  assert.ok(parsed.note.includes('ID'));
  assert.throws(() => parsePackageText('Weekly\nLoading...'));
  assert.throws(() => parsePackageText('Weekly\n20.5 ກີບ'));
});

test('reject incomplete games, duplicates, invalid currency and unsafe prices', () => {
  assert.equal(snapshot().length, 2);
  for (const mutate of [
    (x: any[]) => x.pop(),
    (x: any[]) => x[0].packages.splice(0),
    (x: any[]) => x[0].packages.push(x[0].packages[0]),
    (x: any[]) => x[0].packages[0].currency = 'THB',
    (x: any[]) => x[0].packages[0].price = -1,
  ]) {
    const x = structuredClone(seed.games); mutate(x);
    assert.throws(() => validateSnapshot(x));
  }
});

test('database persists atomically, updates without duplicates, deactivates missing and protects live data from seed', async () => {
  const db = await openDatabase('memory:');
  const repo = new Repository(db);
  try {
    await repo.init();
    await repo.save(snapshot(), '2026-11-18T00:00:00Z', 'seed');
    const first = await repo.packages(GAMES[0].id, false);
    assert.equal(first.length, 14);
    await repo.save(snapshot(), '2026-11-18T01:00:00Z', 'live');
    const next = snapshot(); next[0].packages[0].price = 21000; next[0].packages.pop();
    await repo.save(next, '2026-11-18T02:00:00Z', 'live');
    const active = await repo.packages(GAMES[0].id, false);
    assert.equal(active.length, 13);
    assert.equal((await repo.packages(GAMES[0].id, true)).length, 14);
    assert.equal(active.find((x: any) => x.id === first[0].id)?.price, 21000);
    await assert.rejects(repo.save(snapshot(), '2026-11-18T00:00:00Z', 'seed'), /live|seed/i);
    assert.equal((await repo.packages(GAMES[0].id, false)).length, 13);
    await assert.rejects(repo.save(snapshot().slice(0, 1), new Date().toISOString(), 'live'));
    assert.equal((await repo.packages(GAMES[0].id, false)).length, 13);
  } finally { await db.close(); }
});

test('API reads database, protects reads, validates game and query, and reports empty state', async () => {
  const db = await openDatabase('memory:'); const repo = new Repository(db); await repo.init();
  const app = buildApp(repo, 'test-key');
  const headers = { 'x-api-key': 'test-key' };
  try {
    assert.equal((await app.inject('/health')).statusCode, 200);
    assert.equal((await app.inject('/games')).statusCode, 401);
    assert.equal((await app.inject({ url: '/status', headers })).json().last_success_at, null);
    await repo.save(snapshot(), '2026-11-18T00:00:00Z', 'seed');
    const res = await app.inject({ url: '/games/mobile-legends-bang-bang/packages', headers });
    assert.equal(res.statusCode, 200); assert.equal(res.json().data.length, 14);
    assert.equal(res.json().data[0].original_currency, 'LAK');
    assert.equal((await app.inject({ url: '/games/unknown/packages', headers })).statusCode, 404);
    assert.equal((await app.inject({ url: '/games/free-fire-th/packages?includeInactive=bad', headers })).statusCode, 400);
  } finally { await app.close(); await db.close(); }
});

test('a failure during database write rolls back the entire snapshot', async () => {
  const db = await openDatabase('memory:');
  const repo = new Repository(db); await repo.init();
  try {
    await repo.save(snapshot(), '2026-11-18T00:00:00Z', 'seed');
    const failingDb = {
      ...db,
      transaction: <T>(fn: (sql: any) => Promise<T>) => db.transaction(tx => fn({
        query: (sql: string, params: any[]) => {
          if (sql.startsWith('UPDATE source_state')) throw new Error('Injected write failure');
          return tx.query(sql, params);
        },
      })),
    };
    const next = snapshot(); next[0].packages[0].price = 12345;
    await assert.rejects(new Repository(failingDb).save(next, '2026-11-18T01:00:00Z', 'live'), /Injected/);
    assert.equal((await repo.packages(GAMES[0].id, false))[0].price, 20000);
    assert.equal((await repo.status()).data_origin, 'seed');
    await repo.save(next, '2026-11-18T02:00:00Z', 'live');
    await assert.rejects(repo.save(snapshot(), '2026-11-18T01:00:00Z', 'live'), /Older/);
    assert.equal((await repo.packages(GAMES[0].id, false))[0].price, 12345);
  } finally { await db.close(); }
});

test('sources and zones stay separate even with identical package names', async () => {
  const db = await openDatabase('memory:'); const repo = new Repository(db); await repo.init();
  try {
    await repo.save(snapshot(), '2026-11-18T00:00:00Z', 'live');
    const other = snapshot().map(g => ({ ...g, variant_id: 'main', zone: 'unspecified', source_game_name: g.game, source_url: 'https://www.ggxgstore.com/game/test' }));
    const idZone = { ...structuredClone(other[0]), variant_id: 'indo', zone: 'indonesia' };
    idZone.packages[0].price = 10000;
    await repo.save([...other, idZone], '2026-11-18T01:00:00Z', 'live', 'ggxg');
    assert.equal((await repo.packages(GAMES[0].id, false)).length, 42);
    assert.equal((await repo.packages(GAMES[0].id, false, { source: 'ggxg', zone: 'indonesia' })).length, 14);
    assert.equal((await repo.packages(GAMES[0].id, false, { source: 'jorjee' })).length, 14);
    const all = await repo.packages(GAMES[0].id, false);
    assert.equal(new Set(all.map((p: any) => p.id)).size, all.length);
    await repo.save(other, '2026-11-18T02:00:00Z', 'live', 'ggxg');
    assert.equal((await repo.packages(GAMES[0].id, false, { source: 'jorjee' })).length, 14);
    assert.equal((await repo.packages(GAMES[0].id, false, { source: 'ggxg', zone: 'indonesia' })).length, 0);
    assert.equal((await repo.sources()).length, 2);
    const app = buildApp(repo);
    try {
      const query = await app.inject('/games/mobile-legends-bang-bang/packages?source=jorjee');
      assert.equal(query.statusCode,200); assert.equal(query.json().data.length,14);
      assert.equal((await app.inject('/games/mobile-legends-bang-bang/packages?source=unknown')).statusCode,400);
      assert.equal((await app.inject('/games/mobile-legends-bang-bang/variants')).json().data.length,2);
      assert.equal((await app.inject('/sources')).json().data.length,2);
    } finally { await app.close(); }
  } finally { await db.close(); }
});
