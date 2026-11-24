import {randomUUID} from 'node:crypto';
import {Accounts} from '../src/accounts.js';
import {openDatabase} from '../src/database.js';

const batch=process.argv[2]??'admin-demo-20261124';
const requested=Number(process.argv[3]??10);
if(!/^[a-z0-9-]{3,40}$/.test(batch)||!Number.isInteger(requested)||requested<1||requested>50)throw new Error('Use: create-demo-orders.ts <batch-name> <count 1-50>');

const db=await openDatabase();
try{
 const accounts=new Accounts(db);await accounts.init();
 const customerIds:string[]=[];
 for(let n=1;n<=3;n++){
  const username=`demo_player${n}`;
  let row=(await db.query('SELECT id FROM customer_accounts WHERE username=$1',[username])).rows[0];
  if(!row){const created=await accounts.register(username,'demo-orders-only-password');row={id:created.user.id};await accounts.logout(created.token);}
  customerIds.push(row.id);
 }
 let created=0;
 for(let n=1;n<=requested;n++){
  const requestKey=`${batch}-order-${String(n).padStart(2,'0')}`;
  const publicSnapshot={mock:true,name:`แพ็กเกจทดสอบ ${n}`,game_id:'free-fire',zone:'th',price_usd:'0.00',currency:'USD',player:{UID:`99${String(n).padStart(8,'0')}`}};
  const internalSnapshot={mock:true,source_id:'ไม่มีร้านต้นทาง',cost_lak:0};
  const result=await db.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id)
   VALUES($1,'unused',$2,'unused','awaiting_payment',$3,$4,$5)
   ON CONFLICT(request_key) DO NOTHING RETURNING id`,[randomUUID(),requestKey,JSON.stringify(publicSnapshot),JSON.stringify(internalSnapshot),customerIds[(n-1)%customerIds.length]]);
  created+=result.rows.length;
 }
 const verified=(await db.query(`SELECT COUNT(*)::int AS total,
  COUNT(*) FILTER(WHERE status='awaiting_payment')::int AS awaiting_payment,
  COUNT(*) FILTER(WHERE public_snapshot->>'price_usd'='0.00')::int AS zero_value,
  COUNT(DISTINCT customer_id)::int AS players
  FROM orders WHERE request_key LIKE $1 AND COALESCE(public_snapshot->>'mock','false')='true'`,[`${batch}-order-%`])).rows[0];
 console.log(JSON.stringify({batch,requested,created,...verified}));
}finally{await db.close();}
