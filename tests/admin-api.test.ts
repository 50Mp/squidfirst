import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,Repository} from '../src/database.js';
import {Accounts} from '../src/accounts.js';
import {CustomerChat} from '../src/customer-chat.js';
import {OrderService} from '../src/orders.js';
import {AdminAuth} from '../src/admin/auth.js';
import {AdminService} from '../src/admin/service.js';
import {buildApp} from '../src/app.js';

test('admin API has its own owner session, CSRF and safe order DTOs',async()=>{
 const db=await openDatabase('memory:'),repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,async()=>null,accounts);
 const fileRoot=await mkdtemp(join(tmpdir(),'squid-slip-test-'));
 let app:any;
 try{
  await repo.init();await accounts.init();await chat.init();await orders.init();
  const auth=new AdminAuth(db,{botToken:'123:fake',ownerTelegramId:'123',origin:'https://admin.example.com'});await auth.init();
  const service=new AdminService(db,orders,chat);await service.init();
  app=buildApp(repo,'internal-secret',orders,fileRoot,false,accounts,chat,{auth,service});
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
  await db.query("INSERT INTO admin_audit(actor_id,channel,action,entity_type,entity_id) SELECT '123','miniapp','product.create','product','product-'||n FROM generate_series(1,101) n");
  const audit = await app.inject({url:'/admin/v1/audit?category=payment',headers});
  assert.equal(audit.statusCode,200);
  assert.deepEqual(audit.json().data.map((row:{action:string})=>row.action),['order.approve']);
  const beforeApproval = await app.inject({url:'/admin/v1/audit?category=payment&before='+audit.json().data[0].id,headers});
  assert.deepEqual(beforeApproval.json().data,[]);
  assert.equal((await app.inject({url:'/admin/v1/audit?category=unknown',headers})).statusCode,400);
  await db.query(`UPDATE orders SET status='completed',
   public_snapshot='{"game_id":"free-fire","zone":"th","player":{"UID":"294810291"},"price_usd":"10.50"}'
   WHERE id='order-one'`);
  await service.sendChat(await auth.telegramActor(),user.user.id,{text:'ตรวจ UID แล้ว',visibility:'internal',idempotency_key:'profile-note-api-test'});
  const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=';
  await db.query('UPDATE customer_accounts SET display_name=$1,avatar_data_url=$2,verified_at=NOW() WHERE id=$3',['Somchai K.',avatar,user.user.id]);
  const customerProfile=await app.inject({url:'/admin/v1/customers/'+user.user.id,headers});
  assert.equal(customerProfile.statusCode,200);
  assert.equal(customerProfile.json().customer.display_name,'Somchai K.');
  assert.equal(customerProfile.json().customer.avatar_data_url,avatar);
  assert.ok(customerProfile.json().customer.verified_at);
  assert.equal(customerProfile.json().completed_spend_usd,'10.50');
  assert.deepEqual(customerProfile.json().player_ids,[{game_id:'free-fire',zone:'th',uid:'294810291'}]);
  assert.equal(customerProfile.json().latest_receipt.order_id,'order-one');
  assert.equal(customerProfile.json().latest_internal_note,'ตรวจ UID แล้ว');
  assert.doesNotMatch(customerProfile.body,/secret\/local\/path/);
  const byUid=await app.inject({url:'/admin/v1/customers?search=294810291',headers});
  assert.deepEqual(byUid.json().data.map((row:{id:string})=>row.id),[user.user.id]);
  assert.equal(byUid.json().data[0].display_name,'Somchai K.');
  assert.equal(byUid.json().data[0].latest_order.uid,'294810291');
  const other=await accounts.register('admin_api_other','a sufficiently long password');
  const chatUrl='/admin/v1/customers/'+user.user.id+'/chat';
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=','base64');
  const attachment={name:'ภาพ.png',mime:'image/png',data:bytes.toString('base64')};
  const publicInput={text:'',idempotency_key:'chat-file-public-key',visibility:'public',attachment};
  const savedFile=await app.inject({url:chatUrl,method:'POST',headers,payload:publicInput});
  assert.equal(savedFile.statusCode,200);
  const id=String(savedFile.json().message_id);
  const retryFile=await app.inject({url:chatUrl,method:'POST',headers,payload:publicInput});
  assert.equal(String(retryFile.json().message_id),id);
  const internal=await app.inject({url:chatUrl,method:'POST',headers,payload:{...publicInput,visibility:'internal',idempotency_key:'chat-file-internal-key'}});
  assert.equal(internal.statusCode,200);
  const buyerHeaders={authorization:'Bearer '+user.token};
  const buyerChat=await app.inject({url:'/chat',headers:buyerHeaders});
  assert.deepEqual(buyerChat.json().messages.find((m:any)=>String(m.id)===id).attachment,{name:'ภาพ.png',mime:'image/png',size:bytes.length});
  assert.equal(buyerChat.json().messages.some((m:any)=>String(m.id)===String(internal.json().message_id)),false);
  const fileUrl='/chat/messages/'+id+'/attachment';
  const file=await app.inject({url:fileUrl,headers:buyerHeaders});
  assert.equal(file.statusCode,200);
  assert.deepEqual(file.rawPayload,bytes);
  assert.equal((await app.inject({url:fileUrl,headers:{authorization:'Bearer '+other.token}})).statusCode,404);
  assert.equal((await app.inject({url:'/chat/messages/'+internal.json().message_id+'/attachment',headers:buyerHeaders})).statusCode,404);
  assert.equal((await app.inject({url:'/admin/v1/customers/'+other.user.id+'/chat/'+id+'/attachment',headers})).statusCode,404);
  const invalid=await app.inject({url:chatUrl,method:'POST',headers,payload:{...publicInput,idempotency_key:'chat-file-invalid-key',attachment:{...attachment,data:Buffer.from('<html>').toString('base64')}}});
  assert.equal(invalid.statusCode,400);
  const otherProfile=await app.inject({url:'/admin/v1/customers/'+other.user.id,headers});
  assert.equal(otherProfile.json().latest_receipt,null);
  assert.equal(otherProfile.json().customer.avatar_data_url,null);
  assert.equal(otherProfile.json().customer.verified_at,null);
  assert.equal(otherProfile.json().latest_internal_note,null);
  assert.deepEqual(otherProfile.json().player_ids,[]);
  await db.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id)
   VALUES('SQ-99999','unused','newer-order','unused','paid','{}','{}',$1)`,[user.user.id]);
  const byReference=await app.inject({url:'/admin/v1/customers?search=%23orderone',headers});
  assert.equal(byReference.statusCode,200);
  const [matched]=byReference.json().data;
  assert.equal(matched.id,user.user.id);
  assert.equal(matched.latest_order.id,'SQ-99999');
  assert.equal(matched.matched_order.id,'order-one');
  assert.equal(matched.latest_order.uid,null);
  assert.equal(matched.matched_order.uid,'294810291');
  await db.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id,created_at)
   VALUES('SQ-99998','unused','same-uid','unused','paid','{"player":{"UID":"294810291"}}','{}',$1,NOW()-INTERVAL '12 hours')`,[user.user.id]);
  const matchingUid=await app.inject({url:'/admin/v1/customers?search=294810291',headers});
  assert.equal(matchingUid.statusCode,200);
  assert.deepEqual(matchingUid.json().data.map((row:any)=>[row.id,row.latest_order.id,row.matched_order?.id]),[
   [user.user.id,'SQ-99999','SQ-99998'],
  ]);
  await db.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,created_at)
   SELECT id,'unused',id,'unused',status,'{"game_id":"free-fire"}',jsonb_build_object('source_id',supplier),created_at::timestamptz
   FROM (VALUES
    ('before-day','payment_review','jorjee','2026-11-24T16:59:59Z'),
    ('start-day','payment_review','jorjee','2026-11-24T17:00:00Z'),
    ('other-supplier','payment_review','ggxg','2026-11-25T03:00:00Z'),
    ('end-day','paid','jorjee','2026-11-25T16:59:59Z'),
    ('after-day','payment_review','jorjee','2026-11-25T17:00:00Z')
   ) AS fixtures(id,status,supplier,created_at)`);
  const filteredUrl='/admin/v1/orders?supplier_id=jorjee&date=2026-11-25&game_id=free-fire';
  const filtered=await app.inject({url:filteredUrl+'&limit=1',headers});
  assert.equal(filtered.statusCode,200);
  assert.deepEqual(filtered.json().data.map((row:{id:string})=>row.id),['end-day']);
  assert.deepEqual(filtered.json().counts,{paid:1,payment_review:1});
  const next=await app.inject({url:filteredUrl+'&limit=1&cursor='+encodeURIComponent(filtered.json().next_cursor),headers});
  assert.deepEqual(next.json().data.map((row:{id:string})=>row.id),['start-day']);
  assert.equal(next.json().next_cursor,null);
  assert.equal((await app.inject({url:'/admin/v1/orders?date=2026-02-30',headers})).statusCode,400);
  const issueOrder='slip-issue-api';
  await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,'unused',$1,'unused','payment_review','{}','{}',$2)",[issueOrder,user.user.id]);
  const issueUrl='/admin/v1/orders/'+issueOrder+'/actions';
  const notice='กรุณาแนบรูปหลักฐานการชำระเงินใหม่';
  const note='ตรวจเทียบแล้วอ่านเวลาไม่ได้';
  const payload={action:'issue',expected_revision:1,idempotency_key:'slip-issue-action-key',slip_issue:{reason:'blurry_slip',customer_message:notice,internal_note:note}};
  assert.equal((await app.inject({url:issueUrl,method:'POST',headers,payload:{...payload,slip_issue:{...payload.slip_issue,reason:'invalid'}}})).statusCode,400);
  const issue=await app.inject({url:issueUrl,method:'POST',headers,payload});
  assert.equal(issue.statusCode,200);
  assert.equal(issue.json().status,'issue');
  assert.equal(issue.json().payment_verified,false);
  assert.deepEqual(issue.json().slip_issue,{reason:'blurry_slip',customer_message:notice});
  assert.ok(issue.json().messages.some((m:any)=>m.visibility==='internal'&&m.text===note));
  const retryIssue=await app.inject({url:issueUrl,method:'POST',headers,payload});
  assert.equal(retryIssue.json().revision,issue.json().revision);
  const buyerIssue=await app.inject({url:'/orders/'+issueOrder,headers:buyerHeaders});
  assert.equal(buyerIssue.json().slip_issue.customer_message,notice);
  assert.doesNotMatch(buyerIssue.body,new RegExp(note));
  const inbox=(await app.inject({url:'/chat',headers:buyerHeaders})).json().messages;
  assert.equal(inbox.filter((m:any)=>m.text.includes(notice)).length,1);
  assert.equal(inbox.some((m:any)=>m.text.includes(note)),false);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_chat_jobs WHERE message_id=$1',[inbox.find((m:any)=>m.text===notice).id])).rows[0].n,0);
  const resubmitted=await app.inject({url:'/orders/'+issueOrder+'/receipts',method:'POST',headers:{...buyerHeaders,'content-type':'image/png'},payload:bytes});
  assert.equal(resubmitted.statusCode,201);
  const returned=(await app.inject({url:'/orders/'+issueOrder,headers:buyerHeaders})).json();
  assert.equal(returned.status,'payment_review');
  assert.equal(returned.slip_issue,null);
 }finally{if(app)await app.close();await db.close();await rm(fileRoot,{recursive:true,force:true});}
});
