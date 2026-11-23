import { readFile } from 'node:fs/promises';
import { openDatabase, Repository } from './database.js';
import { validateSnapshot } from './catalog.js';
import { intervalMs } from './config.js';
import { runWorker, syncOnce,syncFxOnce } from './sync.js';
import { SOURCES } from './catalog.js';
import { requireSyncWindow } from './schedule.js';
import { selectLfxUsdRate } from './fx.js';

async function main() {
  const command = process.argv[2];
  if (!['init', 'seed', 'sync', 'fx-sync', 'fx-reference', 'worker'].includes(command)) throw new Error('Use init, seed, sync, fx-sync, fx-reference or worker');
  if (command === 'seed') requireSyncWindow();
  const db = await openDatabase(); const repo = new Repository(db);
  try {
    await repo.init();
    if (command === 'seed') {
      const seed = JSON.parse(await readFile(new URL('../jorjee-game-packages.json', import.meta.url), 'utf8'));
      await repo.save(validateSnapshot(seed.games), `${seed.retrieved_date}T00:00:00+07:00`, 'seed');
      console.log('Seed imported (observation date retained):', seed.retrieved_date);
    }
    if (command === 'sync') {
      const source = process.argv[3];
      if (source) await syncOnce(repo, source);
      else {
        let failed = false;
        try { await syncFxOnce(repo); } catch (error) { console.error(error); failed=true; }
        for (const source of SOURCES) {
          try { await syncOnce(repo, source.id); }
          catch (error) { console.error(error); failed = true; }
        }
        if (failed) throw new Error('One or more sources failed; successful sources were saved');
      }
    }
    if (command === 'fx-sync') await syncFxOnce(repo);
    if (command === 'fx-reference') {
      const [price,evidence]=process.argv.slice(3);
      if (!price || !evidence) throw new Error('Usage: fx-reference <LAK-per-USD> <evidence-path-or-description>');
      const quote=selectLfxUsdRate([{Time:'15:00 - 16:00',Label:'USD',Price:price}]);
      await repo.saveUserProvidedFxRate(quote,evidence);
      console.log('User-provided 15:00–16:00 reference saved; no external fetch:',quote.lak_per_usd);
    }
    if (command === 'worker') {
      const controller = new AbortController();
      process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
      await runWorker(repo, intervalMs(), controller.signal);
    }
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
