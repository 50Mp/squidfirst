import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, Repository } from '../src/database.js';
import { validateSnapshot } from '../src/catalog.js';
import { zoneFromName } from '../src/ggxg.js';

test('zone labels come from displayed names, never misleading source URL slugs', () => {
  assert.equal(zoneFromName('Mobile Legends ( philippines )'), 'philippines');
  assert.equal(zoneFromName('Mobile Legends ( ເຊີບອີນໂດ )'), 'indonesia');
  assert.equal(zoneFromName('Mobile Legends ( ລັດເຊຍ )'), 'russia');
  assert.equal(zoneFromName('Free Fire'), 'unspecified');
});

test('catalog survives closing and reopening its on-disk database', async () => {
  const path = await mkdtemp(join(tmpdir(), 'catalog-test-'));
  const url = `pglite://${path}`;
  const seed = JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8'));
  let db = await openDatabase(url);
  try {
    const repo = new Repository(db); await repo.init();
    await repo.save(validateSnapshot(seed.games),'2026-11-18T00:00:00Z','seed');
    await db.close();
    db = await openDatabase(url);
    const reopened = new Repository(db); await reopened.init();
    assert.equal((await reopened.packages('free-fire',false)).length,13);
    assert.equal((await reopened.status()).data_origin,'seed');
  } finally { await db.close(); await rm(path,{recursive:true,force:true}); }
});
