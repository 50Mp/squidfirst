import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, Repository, type Database } from '../src/database.js';
import { OrderService } from '../src/orders.js';

const token = 'a'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date('2026-11-24T10:00:00.000Z');

async function setup() {
 const db = await openDatabase('memory:');
 const repository = new Repository(db);
 await repository.init();
 const service = new OrderService(db, async () => null);
 await service.init();
 return { db, service };
}

async function insertOrder(db: Database, id: string, status: string, createdAt: string) {
 await db.query(
  `INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,created_at)
   VALUES($1,$2,$1,'fixture',$3,'{}','{}',$4)`,
  [id, tokenHash, status, createdAt],
 );
}

test('payment expiry keeps 14:59 orders and cancels orders at exactly 15:00', async () => {
 const { db, service } = await setup();
 try {
  await insertOrder(db, 'fresh', 'awaiting_payment', '2026-11-24T09:45:01.000Z');
  await insertOrder(db, 'boundary', 'awaiting_payment', '2026-11-24T09:45:00.000Z');
  await insertOrder(db, 'already-reviewing', 'payment_review', '2026-11-24T09:40:00.000Z');

  assert.deepEqual(await service.expireAwaitingPayment(now), ['boundary']);

  const rows = (await db.query('SELECT id,status,revision FROM orders ORDER BY id')).rows;
  assert.deepEqual(rows, [
   { id: 'already-reviewing', status: 'payment_review', revision: 1 },
   { id: 'boundary', status: 'cancelled', revision: 2 },
   { id: 'fresh', status: 'awaiting_payment', revision: 1 },
  ]);
  assert.deepEqual((await db.query('SELECT order_id,sender,visibility,text FROM order_messages')).rows, [
   { order_id: 'boundary', sender: 'system', visibility: 'internal', text: 'Order status: cancelled' },
  ]);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM telegram_outbox')).rows[0].count, 0);
 } finally {
  await db.close();
 }
});

test('receipt accepted before expiry prevents cancellation', async () => {
 const { db, service } = await setup();
 try {
  await insertOrder(db, 'receipt-first', 'awaiting_payment', '2026-11-24T09:40:00.000Z');

  await service.receipt('receipt-first', token, { id: 'receipt-1', path: 'private/receipt.png', mime: 'image/png', size: 10 });
  assert.deepEqual(await service.expireAwaitingPayment(now), []);
  assert.equal((await db.query("SELECT status FROM orders WHERE id='receipt-first'")).rows[0].status, 'payment_review');
 } finally {
  await db.close();
 }
});

test('expiry committed before receipt rejects the receipt', async () => {
 const { db, service } = await setup();
 try {
  await insertOrder(db, 'expiry-first', 'awaiting_payment', '2026-11-24T09:40:00.000Z');

  assert.deepEqual(await service.expireAwaitingPayment(now), ['expiry-first']);
  await assert.rejects(
   service.receipt('expiry-first', token, { id: 'receipt-2', path: 'private/late.png', mime: 'image/png', size: 10 }),
   /not accepted/i,
  );
  assert.equal((await db.query("SELECT status FROM orders WHERE id='expiry-first'")).rows[0].status, 'cancelled');
 } finally {
  await db.close();
 }
});
