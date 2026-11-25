import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/database.js';
import {buildAcceptanceConfig,prepareAcceptance,acceptanceReport} from '../scripts/lib/telegram-acceptance.js';

const source={TELEGRAM_API_TOKEN_BOT:'123:isolated-test',TELEGRAM_ADMIN_CHAT_ID:'123',TELEGRAM_ADMIN_USER_ID:'123',DATABASE_URL:'postgres://production.invalid/live',API_KEY:'production-secret',AUTO_SYNC:'true'};
test('Telegram acceptance requires explicit existing-bot reuse and pins isolated storage/origin',()=>{
 assert.throws(()=>buildAcceptanceConfig(process.cwd(),source,false),/explicit/i);
 const config=buildAcceptanceConfig(process.cwd(),source,true);
 assert.equal(config.origin,'https://admin-test.cffirst.com');assert.equal(config.port,3200);assert.equal(config.host,'127.0.0.1');
 assert.match(config.databaseUrl,/telegram-acceptance/);assert.notEqual(config.databaseUrl,source.DATABASE_URL);assert.notEqual(config.apiKey,source.API_KEY);
 assert.throws(()=>buildAcceptanceConfig(process.cwd(),{...source,TELEGRAM_ADMIN_CHAT_ID:'999'},true),/owner/i);
});
test('isolated acceptance seeds idempotent UUID cases and expiry never queues a completion',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'squid-uat-')),receipt=join(directory,'test.png');await writeFile(receipt,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=','base64'));
 const config=buildAcceptanceConfig(directory,source,true),catalog=JSON.parse(await readFile(new URL('../jorjee-game-packages.json',import.meta.url),'utf8')).games,db=await openDatabase('memory:');
 try{
  const first=await prepareAcceptance(db,config,catalog,{path:receipt,size:(await readFile(receipt)).length});
  const again=await prepareAcceptance(db,config,catalog,{path:receipt,size:1});assert.deepEqual(again.run,first.run);
  assert.match(first.run.completion_order_id,/^[0-9a-f-]{36}$/);assert.equal((await acceptanceReport(db)).completion.status,'payment_review');assert.equal((await acceptanceReport(db)).expiry.status,'awaiting_payment');
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM telegram_outbox')).rows[0].n,0);
  for(const action of ['approve','accept','start','complete'])await first.orders.action(first.run.completion_order_id,action,'acceptance-'+action,{actor:first.actor});
  const expiry=(await db.query('SELECT created_at FROM orders WHERE id=$1',[first.run.expiry_order_id])).rows[0];await first.orders.expireAwaitingPayment(new Date(new Date(expiry.created_at).getTime()+15*60000));
  const report=await acceptanceReport(db);assert.equal(report.completion.status,'completed');assert.equal(report.expiry.status,'cancelled');assert.equal(report.completion.notifications.length,1);assert.equal(report.expiry.notifications.length,0);
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,2);
 }finally{await db.close();}
});
