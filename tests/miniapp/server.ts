// Isolated browser fixture. Never loads .env, never starts Telegram or ingestion workers.
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {copyPreviewOrders} from './preview-orders.js';
import {Backups} from '../../src/operations/backup.js';
import {runOrderMaintenance} from '../../src/order-maintenance.js';
import {openDatabase,Repository} from '../../src/database.js';import {Accounts} from '../../src/accounts.js';import {CustomerChat} from '../../src/customer-chat.js';import {OrderService} from '../../src/orders.js';import {AdminAuth} from '../../src/admin/auth.js';import {AdminService} from '../../src/admin/service.js';import {buildApp} from '../../src/app.js';import {readFile,mkdtemp,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {selectLfxUsdRate} from '../../src/fx.js';
const preview=process.argv.includes('--preview');
const designPreview=process.argv.includes('--design-preview');
if(preview&&designPreview)throw new Error('Select only one preview mode');
const port=designPreview?Number(process.env.SQUID_DESIGN_PREVIEW_PORT??3103):preview?3102:3101;
const host=(designPreview?'localhost':'127.0.0.1')+':'+port;
const origin='http://'+host;
const previewRoot=fileURLToPath(new URL('../../artifacts/local-preview/',import.meta.url));
const db=await openDatabase(preview?'pglite://'+join(previewRoot,'database'):'memory:'),repo=new Repository(db),accounts=new Accounts(db),chat=new CustomerChat(db,accounts),orders=new OrderService(db,()=>repo.effectiveFxRate(),accounts);await repo.init();await accounts.init();await chat.init();await orders.init();const auth=new AdminAuth(db,{botToken:'123:fake-browser-only',ownerTelegramId:'123',origin});await auth.init();const service=new AdminService(db,orders,chat,repo);await service.init();const seed=JSON.parse(await readFile(new URL('../../jorjee-game-packages.json',import.meta.url),'utf8'));await repo.save(seed.games,'2026-11-18T08:00:00Z','live');await repo.saveFxRate(selectLfxUsdRate([{Time:'15:00-16:00',Label:'USD',Price:'22688.45'}]),'2026-11-18T08:00:00Z');const offer=(await repo.packages('free-fire',false))[0];if(!preview&&!designPreview)await service.createProduct(await auth.telegramActor(),{name:'Free Fire diamonds',game_id:'free-fire',zone:'th',offer_ids:[offer.id],confirmed_equivalent:true,published:true,use_default_markup:true,idempotency_key:'browser-product-1234'});
const dir=await mkdtemp(join(tmpdir(),'squid-browser-')),file=join(dir,'receipt.png');await writeFile(file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=','base64'));
if(!preview&&!designPreview)for(let n=1;n<=3;n++){const c=await accounts.register('Player'+n,'browser-test-password');await db.query("INSERT INTO orders(id,token_hash,request_key,request_hash,status,public_snapshot,internal_snapshot,customer_id) VALUES($1,'unused',$1,'unused','payment_review',$2,$3,$4)",['browser-order-'+n,JSON.stringify({mock:true,name:'310 Diamonds',game_id:'free-fire',zone:'th',price_usd:'0.00',player:{UID:String(n).repeat(10)}}),JSON.stringify({mock:true,source_id:'MOCK-NO-SUPPLIER',cost_lak:0}),c.user.id]);await db.query('INSERT INTO order_receipts(id,order_id,path,mime,size) VALUES($1,$2,$3,\'image/png\',1)',['receipt'+n,'browser-order-'+n,file]);await chat.customerMessage(c.token,'ข้อความจาก Player '+n,'browser-message-'+n);}
if(preview)console.log('Local preview orders:',await copyPreviewOrders(db));
const maintenance=new AbortController();
const backups=designPreview?new Backups(db,join(dir,'backups'),randomBytes(32).toString('base64')):undefined;
if(designPreview){
 const {seedDesignPreview}=await import('./design-preview-data.js');
 const actor={...await auth.telegramActor(),channel:'miniapp' as const};
 await seedDesignPreview({db,repo,accounts,chat,service,actor,directory:dir});
 await orders.expireAwaitingPayment();
 await backups!.init();
 await backups!.enqueue(actor,randomUUID());
 await backups!.stop();
}
if(preview||designPreview||process.env.SQUID_LOCAL_BUILD==='1'){
 process.chdir(previewRoot);
}
if(designPreview)process.env.PUBLIC_ORIGIN=origin;
const app=buildApp(repo,'fake-internal-key',orders,dir,designPreview,accounts,chat,{auth,service,backups});
if(designPreview){
 const assets=[['/dev-store/','index.html','text/html'],['/dev-store/shop.js','shop.js','text/javascript'],['/dev-store/shop.css','shop.css','text/css']] as const;
 for(const [path,file,type] of assets){
  app.get(path,{config:{customerRoute:true}},async(request,reply)=>{
   if(request.headers.host!==host)return reply.redirect(origin+path);
   return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff')
    .header('Content-Security-Policy',"default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    .type(type).send(await readFile(new URL('./dev-store/'+file,import.meta.url)));
  });
 }
}
// Many isolated browser contexts bootstrap from the same test IP in seconds.
app.addHook('onRoute',route=>{if(route.url==='/admin/v1/session')route.config.rateLimit={max:100,timeWindow:'1 minute'};});
if(preview||designPreview){
 app.get('/preview',{config:{adminRoute:true}},async (request,reply)=>{
  if(designPreview&&request.headers.host!==host)return reply.redirect(origin+'/preview');
  const fields=new URLSearchParams({
   auth_date:String(Math.floor(Date.now()/1000)),
   query_id:randomUUID(),
   user:JSON.stringify({id:123}),
  });
  const key=createHmac('sha256','WebAppData').update(auth.options.botToken).digest();
  const payload=[...fields].map(([name,value])=>`${name}=${value}`).join('\n');
  fields.set('hash',createHmac('sha256',key).update(payload).digest('hex'));
  const session=await app.inject({
   method:'POST',url:'/admin/v1/session',headers:{origin:auth.options.origin},
   payload:{initData:fields.toString()},
  });
  const cookies=session.headers['set-cookie'];
  if(session.statusCode!==200||!cookies)return reply.code(503).send('Local preview session unavailable');
  const requested=(request.query as {order?:unknown})?.order;
  const order=typeof requested==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requested)?requested:null;
  const location=designPreview?'/admin-app/?design_preview=1'+(order?'#/orders/'+order:''):'/admin-app/';
  return reply.header('Set-Cookie',cookies).header('Cache-Control','no-store').redirect(location);
 });
}
await app.listen({host:'127.0.0.1',port});
const expiry=designPreview?runOrderMaintenance(orders,maintenance.signal):undefined;
process.once('SIGTERM',()=>{maintenance.abort();void app.close().then(()=>expiry).then(()=>backups?.stop()).then(()=>db.close());});
