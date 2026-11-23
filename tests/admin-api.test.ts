import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {openDatabase,Repository} from '../src/database.js';
import {Accounts} from '../src/accounts.js';
import {CustomerChat} from '../src/customer-chat.js';
import {OrderService} from '../src/orders.js';
import {AdminAuth} from '../src/admin/auth.js';
import {AdminService} from '../src/admin/service.js';
import {buildApp} from '../src/app.js';

test('admin API has its own owner session, CSRF and safe order DTOs',async()=>{
 const db=await openDatabase('memory:'),repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,async()=>null);
 let app:any;
 try{
  await repo.init();await accounts.init();await chat.init();await orders.init();
  const auth=new AdminAuth(db,{botToken:'123:fake',ownerTelegramId:'123',origin:'https://admin.example.com'});await auth.init();
  const service=new AdminService(db,orders,chat);await service.init();
  app=buildApp(repo,'internal-secret',orders,undefined,false,accounts,chat,{auth,service});
  assert.equal((await app.inject('/admin/v1/orders')).statusCode,401);
  assert.equal((await app.inject('/admin/v1/navigation')).statusCode,401);
  assert.equal((await app.inject({url:'/admin/v1/orders',headers:{'x-api-key':'internal-secret'}})).statusCode,401);
  const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123})});
  const secret=createHmac('sha256','WebAppData').update('123:fake').digest();p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const login=await app.inject({method:'POST',url:'/admin/v1/session',headers:{origin:'https://admin.example.com'},payload:{initData:p.toString()}});
  assert.equal(login.statusCode,200);
  assert.match(login.headers['set-cookie'][0],/SameSite=None/);
  assert.match(login.headers['set-cookie'][0],/Secure; Partitioned/);
  const cookie=login.headers['set-cookie'].map((c:string)=>c.split(';')[0]).join('; '),csrf=login.json().csrf;
  const headers={cookie,origin:'https://admin.example.com','x-csrf-token':csrf};
  const user=await accounts.register('admin_api_customer','a sufficiently long password');
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES('order-one','unused','request','unused','payment_review','{}','{}',$1)",[user.user.id]);
  await db.query("INSERT INTO order_receipts(id,order_id,path,mime,size) VALUES('r','order-one','secret/local/path','image/png',10)");
  const list=await app.inject({url:'/admin/v1/orders',headers});assert.equal(list.statusCode,200);assert.equal(list.json().data.length,1);
  const navigation=await app.inject({url:'/admin/v1/navigation',headers});assert.equal(navigation.statusCode,200);assert.deepEqual(navigation.json(),{pending_review_orders:1,unread_chat_rooms:0,unread_messages:0});
  const detail=await app.inject({url:'/admin/v1/orders/order-one',headers});assert.equal(detail.statusCode,200);assert.doesNotMatch(detail.body,/secret\/local\/path|token_hash|password/);
  // Newer finished and MOCK records must not hide an older real queue item.
  await db.query("UPDATE orders SET created_at=NOW()-INTERVAL '1 day' WHERE id='order-one'");
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) SELECT 'finished-'||n,'unused','finished-'||n,'unused','completed','{}','{}' FROM generate_series(1,35) n");
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot) VALUES('mock-new','unused','mock-new','unused','payment_review','{\"mock\":true}','{}')");
  const queue=await app.inject({url:'/admin/v1/orders?active_only=true&include_mock=false',headers});
  assert.equal(queue.statusCode,200);assert.deepEqual(queue.json().data.map((o:{id:string})=>o.id),['order-one']);
  const urgent=await app.inject({url:'/admin/v1/orders?status=payment_review&include_mock=false&limit=1',headers});
  assert.equal(urgent.statusCode,200);assert.equal(urgent.json().data[0].id,'order-one');
  const include=await app.inject({url:'/admin/v1/orders?active_only=true&include_mock=true',headers});
  assert.deepEqual(new Set(include.json().data.map((o:{id:string})=>o.id)),new Set(['order-one','mock-new']));
  assert.equal((await app.inject({url:'/admin/v1/orders?active_only=invalid',headers})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/admin/v1/orders/order-one/actions',headers:{cookie},payload:{action:'approve',idempotency_key:'admin-approve-1234',expected_revision:1}})).statusCode,403);
  const action={action:'approve',idempotency_key:'admin-approve-1234',expected_revision:1};
  assert.equal((await app.inject({method:'POST',url:'/admin/v1/orders/order-one/actions',headers,payload:action})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/admin/v1/orders/order-one/actions',headers,payload:action})).statusCode,200);
  assert.equal((await orders.adminRead('order-one')).status,'paid');
  assert.equal((await app.inject({method:'POST',url:'/admin/v1/orders/order-one/actions',headers,payload:{action:'accept',idempotency_key:'admin-accept-12345',expected_revision:1}})).statusCode,409);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM admin_audit WHERE entity_id=$1',['order-one'])).rows[0].n,1);
 }finally{if(app)await app.close();await db.close();}
});
