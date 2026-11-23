import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inSyncWindow, nextOpening, workerDelay } from '../src/schedule.js';
import { selectLfxUsdRate, lakToUsd } from '../src/fx.js';

test('ingestion window uses Laos wall clock and excludes the 16:00 closing instant', () => {
  assert.equal(inSyncWindow(new Date('2026-11-18T14:59:59+07:00')), false);
  assert.equal(inSyncWindow(new Date('2026-11-18T15:00:00+07:00')), true);
  assert.equal(inSyncWindow(new Date('2026-11-18T15:59:59+07:00')), true);
  assert.equal(inSyncWindow(new Date('2026-11-18T16:00:00+07:00')), false);
  assert.equal(nextOpening(new Date('2026-11-18T09:00:00+07:00')).toISOString(), '2026-11-18T08:00:00.000Z');
  assert.equal(nextOpening(new Date('2026-11-18T16:00:00+07:00')).toISOString(), '2026-11-19T08:00:00.000Z');
  assert.equal(workerDelay(new Date('2026-11-18T15:59:00+07:00'),900000),60000);
});

test('only the exact LFX USD 15–16 slot is accepted; no other hour or daily-average fallback', () => {
  const rows = [
    { Time:'14:00 - 15:00',Label:'USD',Price:'22,689.34' },
    { Time:'15:00 - 16:00',Label:'USD',Price:'22,688.45' },
    { Time:'',Label:'THB',Price:'677.02' },
  ];
  const rate = selectLfxUsdRate(rows);
  assert.equal(rate.lak_per_usd, '22688.45');
  assert.equal(rate.published_date, null);
  assert.equal(rate.time_window, '15:00-16:00');
  assert.throws(() => selectLfxUsdRate(rows.slice(0,1)), /15:00/);
  assert.throws(() => selectLfxUsdRate([...rows,rows[1]]), /ambiguous/i);
  for (const price of ['0','-20','22,68.45','NaN','22688USD','Infinity']) {
    assert.throws(() => selectLfxUsdRate([{...rows[1],Price:price}]));
  }
});

test('LAK to USD divides by LAK per USD using exact half-up cents', () => {
  assert.equal(lakToUsd(20000,'22688.45'),'0.88');
  assert.equal(lakToUsd(100,'20000'),'0.01');
  assert.equal(lakToUsd(99,'20000'),'0.00');
  assert.equal(lakToUsd(2969000,'22688.45'),'130.86');
  assert.throws(() => lakToUsd(1,'0'));
});
