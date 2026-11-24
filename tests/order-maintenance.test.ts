import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrderMaintenance } from '../src/order-maintenance.js';

test('order maintenance sweeps immediately, repeats, and stops cleanly on abort', async () => {
 const controller = new AbortController();
 let calls = 0;
 let secondSweep!: () => void;
 const sweptTwice = new Promise<void>(resolve => { secondSweep = resolve; });
 const service = {
  async expireAwaitingPayment() {
   calls += 1;
   if (calls === 2) secondSweep();
   return [];
  },
 };

 const running = runOrderMaintenance(service, controller.signal, 5);
 assert.equal(calls, 1, 'the startup sweep must begin before the first interval');
 await sweptTwice;
 controller.abort();
 await running;

 const callsAtAbort = calls;
 await delay(20);
 assert.equal(calls, callsAtAbort, 'abort must leave no interval running');
});
