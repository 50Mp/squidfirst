import {randomUUID} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import type {Accounts} from '../../src/accounts.js';
import type {AdminActor} from '../../src/admin/contracts.js';
import type {AdminService} from '../../src/admin/service.js';
import type {CustomerChat} from '../../src/customer-chat.js';
import type {Database,Repository} from '../../src/database.js';
import {GAMES,PUBG,type Snapshot} from '../../src/catalog.js';

const packages=[
 {game:'free-fire',name:'1,080 + 108 Diamonds',price:'10.00',cost:204000,zone:'th',source:'ggxg'},
 {game:'rov',name:'370 คูปอง',price:'4.50',cost:89600,zone:'th',source:'jorjee'},
 {game:'genshin-impact',name:'6,480 Genesis Crystals',price:'90.00',cost:1780000,zone:'asia',source:'jorjee'},
 {game:'mobile-legends-bang-bang',name:'706 Diamonds',price:'14.00',cost:269400,zone:'id',source:'ggxg'},
] as const;

const scenarios=[
 ['SQ-98421','refunded',0,0,2,true],
 ['SQ-98420','processing',1,1,6,true],
 ['SQ-98419','completed',2,2,11,true],
 ['SQ-98418','issue',3,3,18,false],
 ['SQ-98417','payment_review',0,0,23,false],
 ['SQ-98416','paid',1,1,26,true],
 ['SQ-98415','accepted',3,2,30,true],
 ['SQ-98414','awaiting_payment',0,3,0,false],
 ['SQ-98413','cancelled',1,1,42,false],
 ['SQ-98412','awaiting_payment',0,0,20,false],
] as const;

const catalog=[
 {game:GAMES[1],zone:'th',packs:[['1,080 + 108 Diamonds',204000],['Weekly Diamond Pass',42000]]},
 {game:GAMES[1],zone:'id',packs:[['Level Up Pass',14800]]},
 {game:GAMES[0],zone:'th',packs:[['257 Diamonds',71000]]},
 {game:GAMES[0],zone:'id',packs:[['706 Diamonds',269400],['Starlight Member Pass',231000]]},
 {game:PUBG,zone:'th',packs:[['60 UC',22000],['325 UC',105000]]},
] as const;

function supplierCatalog(multiplier:number):Snapshot[]{
 return catalog.map(item=>({
  game:item.game.name,variant_id:'demo-'+item.zone,zone:item.zone,
  packages:item.packs.map(([name,price])=>({name,note:'ข้อมูลจำลองสำหรับทดสอบ UI',price:Math.round(price*multiplier),currency:'LAK'})),
 }));
}

async function buildReceipt(directory:string){
 const file=join(directory,'stitch-demo-slip.png');
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:360,height:260}});
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
   body{margin:0;padding:24px;background:#eff6ff;color:#0f172a;font:16px system-ui}
   article{background:#fff;border-radius:16px;padding:20px} h1,p{margin:0 0 12px} h1{font-size:20px}
   strong{display:block;font-size:28px;margin-bottom:12px} small{color:#64748b}
  </style><article><h1>Squid First · Test receipt</h1><p>Example payment for #SQ-98417</p><strong>$10.00 USD</strong><small>SIMULATED ONLY · No funds transferred</small></article>`);
  await page.screenshot({path:file});
  return {file,size:(await stat(file)).size};
 }finally{await browser.close();}
}

export async function seedDesignPreview({db,repo,accounts,chat,service,actor,directory}:{
 db:Database;repo:Repository;accounts:Accounts;chat:CustomerChat;service:AdminService;actor:AdminActor;directory:string;
}){
 const rate='22675.43';
 const observedAt=new Date().toISOString();
 const supplierGames=JSON.parse(await readFile(new URL('./jorjee-preview-games.json',import.meta.url),'utf8')) as {id:string;name:string}[];
 for(const game of supplierGames){
  await db.query('INSERT INTO games(id,name,source_url) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[game.id,game.name,'https://jorjeegamestore.com/']);
 }
 await repo.save(supplierCatalog(1.04),observedAt,'live','jorjee');
 await repo.save(supplierCatalog(1),observedAt,'live','ggxg');
 await service.settings.setFx(actor,{mode:'manual',rate,revision:1,idempotency_key:randomUUID()});
 await service.settings.setConfig(actor,'payments',{
  instructions:'ข้อมูลสำหรับพรีวิวเท่านั้น กรุณาอย่าโอนเงินจริง',
  accounts:[{bank:'ธนาคารตัวอย่าง',name:'Squid First Demo',number:'DEMO-ONLY'}],
 },1,randomUUID());
 const customers=await Promise.all(['demo_somchai','demo_may','demo_natt','demo_anon'].map(name=>accounts.register(name,randomUUID())));
 for(const [index,entry] of customers.entries()){
  const texts=['โอนเงินแล้วครับ ช่วยตรวจสลิปให้หน่อยครับ','รับออเดอร์แล้วใช่ไหมคะ','ได้รับไอเทมเรียบร้อย ขอบคุณครับ','ขอตรวจ UID และเซิร์ฟเวอร์หน่อยครับ'];
  await chat.customerMessage(entry.token,texts[index],'design-chat-'+randomUUID());
  if(index===2)await service.sendChat(actor,entry.user.id,{text:'ขอบคุณที่ใช้บริการครับ',visibility:'public',idempotency_key:randomUUID()});
  if(index===3)await service.sendChat(actor,entry.user.id,{text:'ตรวจ UID ก่อนดำเนินการต่อ',visibility:'internal',idempotency_key:randomUUID()});
 }
 const receipt=await buildReceipt(directory);
 async function insertOrder(id:string,status:string,productIndex:number,customerIndex:number,minutesAgo:number,verified:boolean){
  const item=packages[productIndex],customer=customers[customerIndex];
  const created=new Date(Date.now()-minutesAgo*60000).toISOString();
  const player={UID:String(9817412800+Number(id.slice(-5))),...(item.game==='mobile-legends-bang-bang'?{'Zone ID':'2019'}:{})};
  await db.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,payment_verified,public_snapshot,internal_snapshot,customer_id,created_at)
   VALUES($1,'design-preview',$1,'design-preview',$2,$3,$4,$5,$6,$7)`,[id,status,verified,
   JSON.stringify({name:item.name,game_id:item.game,zone:item.zone,price_usd:item.price,player}),
   JSON.stringify({source_id:item.source,cost_lak:item.cost,lak_per_usd:rate,markup_bps:1000}),customer.user.id,created]);
  await db.query("INSERT INTO order_messages(order_id,sender,visibility,text,created_at) VALUES($1,'system','internal',$2,$3)",[id,'Order status: '+status,created]);
  if(status==='payment_review')await db.query("INSERT INTO order_receipts(id,order_id,path,mime,size,created_at) VALUES($1,$2,$3,'image/png',$4,$5)",[randomUUID(),id,receipt.file,receipt.size,created]);
 }
 for(const scenario of scenarios)await insertOrder(...scenario);
 for(let day=1;day<=7;day++){
  for(let index=0;index<1+(day%3);index++){
   await insertOrder('SQ-'+String(98300-day*3-index),'completed',(day+index)%packages.length,index,1440*day,true);
  }
 }
 for(const {game,zone,packs} of catalog){
  const offers=await repo.packages(game.id,false,{zone});
  for(const [name] of packs){
   await service.createProduct(actor,{name,game_id:game.id,zone,offer_ids:offers.filter(offer=>offer.name===name).map(offer=>offer.id),confirmed_equivalent:true,published:name!=='Starlight Member Pass',use_default_markup:true,idempotency_key:randomUUID()});
  }
 }
}
