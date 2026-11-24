import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { SOURCES } from './catalog.js';
import type { Repository } from './database.js';
import { lakToUsd,rateMetadata } from './fx.js';
import { inSyncWindow,nextOpening,SYNC_TIMEZONE,SYNC_WINDOW } from './schedule.js';
import rateLimit from '@fastify/rate-limit';
import { OrderError,type OrderService } from './orders.js';
import { orderRoutes } from './order-routes.js';
import type { Accounts } from './accounts.js';
import type { CustomerChat } from './customer-chat.js';
import { accountRoutes } from './account-routes.js';
import {adminRoutes,type AdminContext} from './admin/routes.js';
import {adminStatic} from './admin/static.js';

export function buildApp(repo: Repository, apiKey?: string,orders?:OrderService,fileRoot?:string,acceptOrders=true,accounts?:Accounts,chat?:CustomerChat,admin?:AdminContext) {
  const app = Fastify({ logger: { redact: ['req.headers.x-api-key', 'req.headers.authorization','req.headers.cookie','req.headers.x-csrf-token'] } });
  app.register(rateLimit,{global:false});
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.split('?')[0] === '/health' || (admin&&request.url.split('?')[0].startsWith('/admin-app/')) || request.routeOptions.config.customerRoute || request.routeOptions.config.adminRoute || !apiKey) return;
    const key = request.headers['x-api-key'];
    if (typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(apiKey) || !timingSafeEqual(Buffer.from(key), Buffer.from(apiKey))) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
  if(admin){app.register(async routes=>adminRoutes(routes,admin));adminStatic(app);}
  app.setErrorHandler((error, request, reply) => {
    if(error instanceof OrderError)return reply.code(error.statusCode).send({error:error.message});
    if (error instanceof Error && 'validation' in error) return reply.code(400).send({ error: 'Invalid request' });
    if(error instanceof Error && 'statusCode' in error && typeof error.statusCode==='number' && [413,415,429].includes(error.statusCode))return reply.code(error.statusCode).send({error:'Request size, type or rate limit exceeded'});
    request.log.error(error);
    return reply.code(503).send({ error: 'Service unavailable' });
  });
  if(orders){app.register(async routes=>{
    if(accounts&&chat)accountRoutes(routes,accounts,chat);
    orderRoutes(routes,orders,Boolean(apiKey),fileRoot,acceptOrders,Boolean(accounts&&chat));
  });}
  app.get('/health', async () => { await repo.health(); return { status: 'ok' }; });
  app.get('/status', async () => ({ ...await repo.status(), sources: await repo.sources(),
    ingestion_schedule:{ timezone:SYNC_TIMEZONE,window:SYNC_WINDOW,in_window:inSyncWindow(new Date()),next_open_at:nextOpening(new Date()).toISOString() } }));
  app.get('/exchange-rates/usd-lak', async () => {
    const rate = await repo.effectiveFxRate();
    return { status:rate ? 'available':'unavailable',rate:rateMetadata(rate), timezone:SYNC_TIMEZONE,time_window:SYNC_WINDOW };
  });
  app.get('/sources', async () => ({ data: await repo.sources() }));
  app.get('/games', async () => ({ data: await repo.games() }));
  app.get<{ Params: { id: string } }>('/games/:id/variants', async (request, reply) => {
    const id = request.params.id === 'free-fire-th' ? 'free-fire' : request.params.id;
    if (!await repo.game(id)) return reply.code(404).send({ error: 'Game not found' });
    return { data: await repo.variants(id) };
  });
  app.get<{ Params: { id: string }; Querystring: { includeInactive?: string; source?: string; zone?: string; variant?: string; currency?: 'USD' | 'LAK' } }>('/games/:id/packages', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 100 } } },
      querystring: { type: 'object', additionalProperties: false, properties: {
        includeInactive: { type: 'string', enum: ['true', 'false'] },
        source: { type: 'string', enum: SOURCES.map(s => s.id) },
        zone: { type: 'string', minLength: 1, maxLength: 100 },
        variant: { type: 'string', minLength: 1, maxLength: 300 },
        currency: { type:'string',enum:['USD','LAK'],default:'USD' },
      } },
    },
  }, async (request, reply) => {
    const id = request.params.id === 'free-fire-th' ? 'free-fire' : request.params.id;
    if (!await repo.game(id)) return reply.code(404).send({ error: 'Game not found' });
    const zone = request.query.zone ?? (request.params.id === 'free-fire-th' ? 'th' : undefined);
    const rows = await repo.packages(id, request.query.includeInactive === 'true', { source: request.query.source, zone, variant: request.query.variant });
    const currency = request.query.currency ?? 'USD';
    const rate = currency === 'USD' ? await repo.effectiveFxRate() : null;
    return { data: rows.map(row => ({ ...row,original_price:row.price,original_currency:row.currency,
      price:currency === 'LAK' ? row.price : rate ? lakToUsd(row.price,rate.lak_per_usd) : null,currency })),
      conversion_status:currency === 'LAK' ? 'not_requested' : rate ? 'available':'unavailable',exchange_rate:rateMetadata(rate) };
  });
  return app;
}
