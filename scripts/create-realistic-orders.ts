import {Accounts} from '../src/accounts.js';
import {openDatabase,Repository} from '../src/database.js';
import {OrderService} from '../src/orders.js';

const base=process.env.PUBLIC_ORIGIN??`http://127.0.0.1:${process.env.PORT??3000}`;
const batch=process.argv[2]??'realistic-20261124';
const requested=Number(process.argv[3]??10);
if(!/^[a-z0-9-]{3,40}$/.test(batch)||!Number.isInteger(requested)||requested<1||requested>10)throw new Error('Use: create-realistic-orders.ts <batch-name> <count 1-10>');

async function session(username:string){
 const password='real-order-flow-password';
 let response=await fetch(base+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
 if(response.status===409)response=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
 if(!response.ok)throw new Error(`${username} authentication failed: ${response.status} ${await response.text()}`);
 const cookie=response.headers.get('set-cookie')??'';
 const token=/squid_session=([^;]+)/.exec(cookie)?.[1];
 if(!token)throw new Error(`${username} session cookie missing`);
 return token;
}

type Product={id:string;name:string;price_usd:string;required_fields:string[]};
async function readProducts(){const response=await fetch(base+'/shop/products');if(!response.ok)throw new Error(`Product read failed: ${response.status}`);return (await response.json()).data as Product[];}
let products=await readProducts();
if(!products.length){
 const db=await openDatabase();
 try{
  const repo=new Repository(db),accounts=new Accounts(db),orders=new OrderService(db,sql=>repo.effectiveFxRate(sql),accounts);
  const offers=(await db.query(`SELECT p.id,p.name,p.game_id,p.zone FROM packages p
   JOIN source_settings s ON s.source_id=p.source_id AND s.enabled=TRUE
   LEFT JOIN game_settings g ON g.game_id=p.game_id
   LEFT JOIN zone_settings z ON z.game_id=p.game_id AND z.zone=p.zone
   WHERE p.active=TRUE AND p.zone<>'unspecified' AND COALESCE(g.enabled,TRUE)=TRUE AND COALESCE(z.enabled,TRUE)=TRUE
   ORDER BY p.game_id,p.position,p.id LIMIT 3`)).rows;
  if(!offers.length)throw new Error('No active catalog offers are available to publish');
  for(const offer of offers)await orders.publish({name:offer.name,game_id:offer.game_id,zone:offer.zone,offer_ids:[offer.id],markup_bps:1000});
 }finally{await db.close();}
 products=await readProducts();
}
if(!products.length)throw new Error('Published products are still unavailable');

const customers=['noy_kham','somchai88','mali_game'];
const tokens=await Promise.all(customers.map(session));
const ids:string[]=[];
for(let n=1;n<=requested;n++){
 const product=products[(n-1)%products.length];
 const player=Object.fromEntries(product.required_fields.map(field=>[field,field==='UID'?`88${String(n).padStart(8,'0')}`:String(4000+n)]));
 const response=await fetch(base+'/orders',{method:'POST',headers:{authorization:`Bearer ${tokens[(n-1)%tokens.length]}`,'content-type':'application/json','idempotency-key':`${batch}-order-${String(n).padStart(2,'0')}`},body:JSON.stringify({product_id:product.id,player})});
 if(response.status!==201)throw new Error(`Order ${n} failed: ${response.status} ${await response.text()}`);
 const order=await response.json();
 if(order.details?.mock||order.status!=='awaiting_payment'||Number(order.details?.price_usd)<=0)throw new Error(`Order ${n} did not use the real checkout path`);
 ids.push(order.id);
}

const db=await openDatabase();
try{
 await db.transaction(async tx=>{
  await tx.query("DELETE FROM orders WHERE request_key LIKE 'admin-demo-20261124-order-%' AND COALESCE(public_snapshot->>'mock','false')='true'");
  await tx.query("DELETE FROM customer_chat_rooms WHERE customer_id IN (SELECT id FROM customer_accounts WHERE username LIKE 'demo_player%')");
  await tx.query("DELETE FROM customer_accounts WHERE username LIKE 'demo_player%'");
 });
 const verified=(await db.query(`SELECT COUNT(*)::int AS total,
  COUNT(*) FILTER(WHERE status='awaiting_payment')::int AS awaiting_payment,
  COUNT(*) FILTER(WHERE COALESCE(public_snapshot->>'mock','false')='false')::int AS real_orders,
  COUNT(*) FILTER(WHERE (public_snapshot->>'price_usd')::numeric>0)::int AS priced,
  COUNT(DISTINCT customer_id)::int AS customers
  FROM orders WHERE request_key LIKE $1`,[`${batch}-order-%`])).rows[0];
 console.log(JSON.stringify({batch,requested,ids,...verified}));
}finally{await db.close();}
