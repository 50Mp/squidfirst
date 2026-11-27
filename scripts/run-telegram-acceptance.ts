// Owner-only acceptance runtime. No production database, preview login or supplier worker.
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openDatabase} from '../src/database.js';
import {buildApp} from '../src/app.js';
import {BotApi,TelegramApiError,runTelegram} from '../src/telegram.js';
import {runOrderMaintenance} from '../src/order-maintenance.js';
import {buildAcceptanceConfig,prepareAcceptance,acceptanceReport} from './lib/telegram-acceptance.js';

const workspace=fileURLToPath(new URL('../',import.meta.url));
async function main(){
 const args=new Set(process.argv.slice(2));
 if(!['--prepare','--serve','--report'].some(mode=>args.has(mode)))throw Error('Choose --prepare, --serve or --report, with --reuse-existing-bot');
 const config=buildAcceptanceConfig(workspace,parseEnv(await readFile(join(workspace,'.env'),'utf8')),args.has('--reuse-existing-bot'));
 const runtimeFile=join(config.directory,'runtime.json');
 if(args.has('--report')){
  const runtime=JSON.parse(await readFile(runtimeFile,'utf8'));
  const response=await fetch('http://127.0.0.1:3200/acceptance/report',{headers:{'x-api-key':runtime.apiKey},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Acceptance report unavailable');console.log(JSON.stringify(await response.json(),null,2));return;
 }
 let runtimeActive=false;try{await fetch('http://127.0.0.1:3200/health',{signal:AbortSignal.timeout(1500)});runtimeActive=true;}catch{}
 if(runtimeActive)throw Error('Acceptance runtime is already running; use --report instead of opening its database twice');
 await mkdir(config.directory,{recursive:true});
 const receiptPath=join(config.directory,'simulated-receipt.png');
 try{await stat(receiptPath);}catch(e:any){
  if(e.code!=='ENOENT')throw e;
  const browser=await chromium.launch();try{
   const page=await browser.newPage({viewport:{width:420,height:320}});
   await page.setContent('<!doctype html><html lang="en"><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#f1f5f9;color:#0f172a;font:18px system-ui}article{background:white;padding:24px;border:3px solid #dc2626;border-radius:16px}h1{color:#dc2626;margin:0 0 20px;font-size:28px}p{line-height:1.5}strong{display:block;color:#dc2626}</style><article><h1>TEST ONLY</h1><p>Squid First · Simulated receipt<br>Acceptance test on isolated data</p><strong>NO MONEY TRANSFERRED</strong><p>Do not top up a real game account.</p></article>');
   await page.screenshot({path:receiptPath});
  }finally{await browser.close();}
 }
 const db=await openDatabase(config.databaseUrl),controller=new AbortController();let app:ReturnType<typeof buildApp>|undefined,bot:Promise<void>|undefined,maintenance:Promise<void>|undefined,stopping=false;
 async function stop(){if(stopping)return;stopping=true;controller.abort();await app?.close();await Promise.allSettled([bot,maintenance]);await db.close();}
 try{
  const catalog=JSON.parse(await readFile(join(workspace,'jorjee-game-packages.json'),'utf8')).games;
  const context=await prepareAcceptance(db,config,catalog,{path:receiptPath,size:(await stat(receiptPath)).size});
  if(args.has('--prepare')){console.log(JSON.stringify(await acceptanceReport(db),null,2));await stop();return;}
  if(args.has('--transport')){
   let productionRunning=false;try{productionRunning=(await fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(1500)})).ok;}catch{}
   if(productionRunning)throw Error('Existing API is running; use a controlled single-bot cutover before --transport');
   const api=new BotApi(config.bot,controller.signal),webhook=await api.call('getWebhookInfo',{});
   if(webhook.url)throw Error('Existing webhook must be reviewed before long polling');
   // No offset is sent: this readiness probe does not acknowledge or discard pending updates.
   await api.call('getUpdates',{timeout:1,allowed_updates:['message','callback_query']});
  }
  await stat(join(config.directory,'admin-ui/dist/index.html'));
  process.chdir(config.directory);
  app=buildApp(context.repo,config.apiKey,context.orders,config.directory,false,context.accounts,context.chat,{auth:context.auth,service:context.service});
  app.get('/acceptance/report',async()=>({...await acceptanceReport(db),telegram_transport:args.has('--transport')}));
  app.post('/acceptance/stop',async()=>{setTimeout(()=>{void stop();},100);return{stopping:true};});
  await app.listen({host:config.host,port:config.port});
  await writeFile(runtimeFile,JSON.stringify({pid:process.pid,apiKey:config.apiKey,origin:config.origin,transport:args.has('--transport')}),{mode:0o600});
  maintenance=runOrderMaintenance(context.orders,controller.signal);
  if(args.has('--transport'))bot=runTelegram(context.orders,config.bot,controller.signal,context.chat);
  process.once('SIGTERM',()=>{void stop();});process.once('SIGINT',()=>{void stop();});
  console.log(JSON.stringify({acceptance:true,origin:config.origin,port:config.port,telegram_transport:args.has('--transport'),cases:context.run}));
 }catch(error){await stop();throw error;}
}
main().catch(error=>{console.error(error instanceof TelegramApiError?'Acceptance Telegram error '+error.code:'Acceptance startup stopped: '+(error instanceof Error?error.message:'unknown error'));process.exitCode=1;});
