import { openDatabase, Repository } from './database.js';
import { buildApp } from './app.js';
import { intervalMs, positiveInteger } from './config.js';
import { runWorker } from './sync.js';
import { OrderService } from './orders.js';
import { telegramConfig,runTelegram } from './telegram.js';
import { Accounts } from './accounts.js';
import { CustomerChat } from './customer-chat.js';
import {AdminAuth} from './admin/auth.js';import {AdminService} from './admin/service.js';import {SyncJobs} from './operations/jobs.js';import {Backups} from './operations/backup.js';
import {OperationsAlerts} from './operations/alerts.js';
import {runOrderMaintenance} from './order-maintenance.js';

async function main() {
  const host = process.env.HOST || '127.0.0.1';
  const port = positiveInteger(process.env.PORT, 3000, 1, 65535);
  const interval = intervalMs();
  const autoSync = process.env.AUTO_SYNC === 'true';
  if (process.env.AUTO_SYNC && !['true', 'false'].includes(process.env.AUTO_SYNC)) throw new Error('AUTO_SYNC must be true or false');
  const devCheckout = process.env.DESIGN_DEV_CHECKOUT === 'true';
  if (devCheckout && (
    process.env.DATABASE_URL !== 'pglite://./data/design-dev/database' ||
    host !== '127.0.0.1' ||
    process.env.PUBLIC_ORIGIN !== `http://127.0.0.1:${port}` ||
    process.env.TELEGRAM_POLLING !== 'false' ||
    process.env.ORDERS_ENABLED !== 'false' ||
    autoSync
  )) throw new Error('Design dev checkout requires the isolated database, loopback buyer origin, and disabled live integrations');
  const db = await openDatabase(); const repo = new Repository(db);
  const telegram=telegramConfig();
  const origin=process.env.ADMIN_APP_URL?new URL(process.env.ADMIN_APP_URL).origin:process.env.PUBLIC_ORIGIN??`http://127.0.0.1:${port}`;
  const auth=telegram?new AdminAuth(db,{botToken:telegram.token,ownerTelegramId:telegram.userId,origin}):null;
  const accounts=new Accounts(db),chat=new CustomerChat(db,accounts);
  const orders=new OrderService(db,sql=>repo.effectiveFxRate(sql),accounts,auth?()=>auth.telegramActor():undefined);
  const service=new AdminService(db,orders,chat,repo),jobs=new SyncJobs(db,repo,service.settings),backups=new Backups(db);
  const alerts=new OperationsAlerts(db);
  if(!process.env.API_KEY)throw new Error('Set API_KEY to keep internal supplier/cost endpoints private');
  const app = buildApp(repo, process.env.API_KEY,orders,devCheckout?'data/design-dev/order-files':undefined,devCheckout||(process.env.ORDERS_ENABLED==='true'&&telegram!==null),accounts,chat,auth?{auth,service,jobs,backups}:undefined);
  const controller = new AbortController();
  let worker: Promise<void> | undefined;
  let bot:Promise<void>|undefined;
  let maintenance:Promise<void>|undefined;
  let stopping = false;
  async function stop() {
    if (stopping) return; stopping = true;
    controller.abort();
    await app.close(); await Promise.all([worker,bot,maintenance]);await jobs.stop();await backups.stop(); await db.close();
  }
  process.once('SIGINT', () => { void stop(); }); process.once('SIGTERM', () => { void stop(); });
  try {
    await repo.init();
    await accounts.init();await chat.init();
    await orders.init();
    if(auth){await auth.init();await service.init();await jobs.init();await backups.init();await alerts.init();}
    await app.listen({ host, port });
    maintenance=runOrderMaintenance(orders,controller.signal);
    if (autoSync) worker = runWorker(repo, interval, controller.signal);
    if(telegram&&process.env.TELEGRAM_POLLING!=='false')bot=runTelegram(orders,telegram,controller.signal,chat,send=>alerts.tick(send));
    else if(telegram)app.log.info('Telegram polling disabled; Mini App authentication remains enabled');
    else app.log.info('Telegram not enabled; real order creation is disabled');
  } catch (error) { await stop(); throw error; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
