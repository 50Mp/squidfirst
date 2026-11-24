import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, Repository } from '../src/database.js';
import { validateSnapshot } from '../src/catalog.js';
import { selectLfxUsdRate } from '../src/fx.js';
import { OrderService } from '../src/orders.js';

async function setupSellableOrderService() {
 const db = await openDatabase('memory:');
 const repository = new Repository(db);
 await repository.init();
 const seed = JSON.parse(await readFile(new URL('../jorjee-game-packages.json', import.meta.url), 'utf8'));
 await repository.save(validateSnapshot(seed.games), '2026-11-18T08:00:00Z', 'live');
 await repository.saveFxRate(selectLfxUsdRate([{ Time: '15:00-16:00', Label: 'USD', Price: '22688.45' }]), '2026-11-18T08:00:00Z');
 const service = new OrderService(db, () => repository.latestFxRate());
 await service.init();
 const offer = (await repository.packages('free-fire', false))[0];
 const product = await service.publish({ name: 'Completion notification test', game_id: 'free-fire', zone: 'th', offer_ids: [offer.id], markup_bps: 1000 });
 return { db, service, product };
}

test('only successful completion queues an order notification', async () => {
 const { db, service, product } = await setupSellableOrderService();
 try {
  const token = 'a'.repeat(43);
  const order = await service.create({ product_id: product.id, player: { UID: '123456789' }, token, idempotency_key: 'notification-order-1234' });
  const queued = async () => (await db.query("SELECT kind,payload FROM telegram_outbox WHERE state='pending' ORDER BY created_at,id")).rows;
  assert.deepEqual(await queued(), [], 'creation must not notify Telegram');
  await service.message(order.id, token, 'customer update');
  assert.deepEqual(await queued(), [], 'order chat must not create an order notification');
  await service.receipt(order.id, token, { id: 'notification-receipt', path: 'private/receipt.png', mime: 'image/png', size: 12 });
  assert.deepEqual(await queued(), [], 'receipt upload must not notify Telegram');

  for (const [action, key] of [['approve', 'approve'], ['accept', 'accept'], ['start', 'start'], ['issue', 'issue'], ['resume', 'resume']] as const) {
   await service.action(order.id, action, `notification-${key}`);
   assert.deepEqual(await queued(), [], `${action} must not notify Telegram`);
  }
  await service.action(order.id, 'complete', 'notification-complete');
  assert.deepEqual(await queued(), [{ kind: 'status', payload: { status: 'completed' } }]);
  await service.action(order.id, 'complete', 'notification-complete');
  assert.equal((await queued()).length, 1, 'duplicate completion must be idempotent');
  await service.action(order.id, 'reopen', 'notification-reopen');
  assert.equal((await queued()).length, 1, 'reopen must not notify Telegram');
  await service.action(order.id, 'complete', 'notification-recomplete');
  assert.equal((await queued()).length, 2, 'a later completion updates the completed card');
  await service.action(order.id, 'refund', 'notification-refund');
  assert.equal((await queued()).length, 2, 'refund must not notify Telegram');

  const cancelled = await service.create({ product_id: product.id, player: { UID: '987654321' }, token, idempotency_key: 'notification-cancel-1234' });
  await service.action(cancelled.id, 'cancel', 'notification-cancel');
  assert.equal((await queued()).length, 2, 'cancel must not notify Telegram');
 } finally {
  await db.close();
 }
});

test('initialization suppresses unsent legacy jobs except completed status', async () => {
 const db = await openDatabase('memory:');
 try {
  const repository = new Repository(db);
  await repository.init();
  const service = new OrderService(db, async () => null);
  await service.init();
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) VALUES('legacy-order','unused','legacy-order','unused','completed','{}','{}')");
  for (const [id, kind, payload, state] of [
   ['pending-order', 'order', {}, 'pending'],
   ['sending-receipt', 'receipt', {}, 'sending'],
   ['pending-paid', 'status', { status: 'paid' }, 'pending'],
   ['pending-completed', 'status', { status: 'completed' }, 'pending'],
   ['sent-order', 'order', {}, 'sent'],
  ] as const) {
   await db.query('INSERT INTO telegram_outbox(id,order_id,kind,payload,state) VALUES($1,$2,$3,$4,$5)', [id, 'legacy-order', kind, JSON.stringify(payload), state]);
  }

  await service.init();

  assert.deepEqual((await db.query('SELECT id,state FROM telegram_outbox ORDER BY id')).rows, [
   { id: 'pending-completed', state: 'pending' },
   { id: 'pending-order', state: 'suppressed' },
   { id: 'pending-paid', state: 'suppressed' },
   { id: 'sending-receipt', state: 'suppressed' },
   { id: 'sent-order', state: 'sent' },
  ]);
 } finally {
  await db.close();
 }
});
