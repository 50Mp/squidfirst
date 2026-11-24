import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrapeCatalog } from '../src/scraper.js';

test('an unsuccessful JorJee response cannot be imported', async () => {
  await assert.rejects(scrapeCatalog(undefined, async () => new Response(null,{status:503})), /HTTP 503/);
  await assert.rejects(scrapeCatalog(undefined, async () => Response.json({success:false,data:[]})), /Invalid JorJee catalog response/);
});
