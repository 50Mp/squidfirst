import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDatabase,Repository} from '../src/database.js';import {OrderService} from '../src/orders.js';import {adminOverview} from '../src/admin/overview.js';
test('overview excludes MOCK and pending sales, preserves totals through reopen and refund',async()=>{
 const db=await openDatabase('memory:');try{
  await new Repository(db).init();await new OrderService(db,async()=>null).init();
  for(const [id,status,mock] of [['complete','completed',false],['pending','processing',false],['mock','completed',true],['refund','refunded',false]] as const)await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,created_at) VALUES($1,'unused',$1,'unused',$2,$3,$4,'2026-11-18T18:00:00Z')",[id,status,JSON.stringify({mock,price_usd:'1.00'}),JSON.stringify({cost_lak:10000,lak_per_usd:'20000'})]);
  let report=await adminOverview(db,'2026-11-19','2026-11-19');assert.equal(report.total_orders,3);assert.equal(report.revenue_usd,'1.00');assert.equal(report.refunds_usd,'1.00');assert.equal(report.estimated_gross_profit_usd,'0.50');
  assert.deepEqual(report.daily,[{date:'2026-11-19',orders:3,revenue_usd:'1.00',gross_profit_usd:'0.50'}]);
  assert.deepEqual(report.games,[{game_id:null,orders:3}]);
  const period=await adminOverview(db,'2026-11-18','2026-11-19');
  assert.deepEqual(period.daily.map(day=>[day.date,day.orders]),[['2026-11-18',0],['2026-11-19',3]]);
  await db.query("UPDATE orders SET status='processing' WHERE id='complete'");report=await adminOverview(db,'2026-11-19','2026-11-19');assert.equal(report.revenue_usd,'0.00');
  await db.query("UPDATE orders SET status='completed' WHERE id='complete'");assert.equal((await adminOverview(db,'2026-11-19','2026-11-19')).revenue_usd,'1.00');
  assert.equal((await adminOverview(db,'2026-11-18','2026-11-18')).total_orders,0);
  await assert.rejects(adminOverview(db,'2026-02-31'),/date/i);
 }finally{await db.close();}
});
