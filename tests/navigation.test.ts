import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from 'playwright';
import { loadCatalogHome } from '../src/scraper.js';

test('navigation failure also handles rejection of the outstanding response wait', async () => {
  const page = {
    waitForResponse: () => new Promise((_, reject) => setTimeout(() => reject(new Error('Context closed')),20)),
    goto: async () => { throw new Error('Navigation failed'); },
  } as unknown as Page;
  await assert.rejects(loadCatalogHome(page), /Navigation failed/);
  await delay(50);
});
