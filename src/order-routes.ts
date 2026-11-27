import type { FastifyInstance,FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { OrderService,OrderError,type PublishInput } from './orders.js';
import { sessionToken } from './session.js';

declare module 'fastify' {interface FastifyContextConfig {customerRoute?:boolean}}
function token(req:FastifyRequest){return sessionToken(req);}
export function receiptMime(buffer:Buffer,mime:string){
 if(mime==='image/png'&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'png';
 if(mime==='image/jpeg'&&buffer.subarray(0,3).equals(Buffer.from([255,216,255])))return'jpg';
 if(mime==='application/pdf'&&buffer.subarray(0,5).toString()==='%PDF-')return'pdf';
 throw new OrderError(400,'Receipt must be a matching PNG, JPEG or PDF file');
}
export function orderRoutes(app:FastifyInstance,orders:OrderService,adminConfigured:boolean,fileRoot=resolve('data/order-files'),acceptOrders=true,accountRooms=false){
 const publicConfig={customerRoute:true};
 const writeConfig={...publicConfig,rateLimit:{max:10,timeWindow:'1 minute'}};
 app.addContentTypeParser(['image/png','image/jpeg','application/pdf'],{parseAs:'buffer',bodyLimit:5*1024*1024},(_req,body,done)=>done(null,body));
 app.get('/shop/products',{config:{...publicConfig,rateLimit:{max:60,timeWindow:'1 minute'}}},async()=>({data:await orders.products()}));
 app.post<{Body:PublishInput&{confirmed_equivalent:boolean}}>('/admin/products',{
  schema:{body:{type:'object',required:['name','game_id','zone','offer_ids','confirmed_equivalent'],additionalProperties:false,properties:{
   name:{type:'string',minLength:1,maxLength:200},game_id:{type:'string'},zone:{type:'string'},
   offer_ids:{type:'array',minItems:1,maxItems:50,items:{type:'string',maxLength:100}},markup_bps:{type:'integer',minimum:0,maximum:10000,default:1000},confirmed_equivalent:{const:true},
  }}},
 },async(req,reply)=>{if(!adminConfigured)throw new OrderError(503,'Configure API_KEY before publishing');return reply.code(201).send(await orders.publish(req.body));});
 if(accountRooms)app.get('/orders',{config:publicConfig},async(req,reply)=>reply.header('Cache-Control','private, no-store').send({data:await orders.history(token(req))}));
 app.post<{Body:{product_id:string;player:Record<string,string>;expected_price_usd?:string}}>('/orders',{
  config:writeConfig,schema:{body:{type:'object',additionalProperties:false,required:['product_id','player'],properties:{product_id:{type:'string',maxLength:100},expected_price_usd:{type:'string',pattern:'^[0-9]{1,8}[.][0-9]{2}$'},player:{type:'object',minProperties:1,maxProperties:2,additionalProperties:{type:'string',maxLength:32}}}}},
 },async(req,reply)=>{if(!acceptOrders)throw new OrderError(503,'Ordering is not enabled yet');const key=req.headers['idempotency-key'];if(typeof key!=='string')throw new OrderError(400,'Idempotency-Key is required');return reply.code(201).send(await orders.create({...req.body,token:token(req),idempotency_key:key}));});
 app.get<{Params:{id:string}}>('/orders/:id',{config:publicConfig},async(req,reply)=>reply.header('Cache-Control','private, no-store').send(await orders.read(req.params.id,token(req))));
 app.post<{Params:{id:string};Body:{text:string}}>('/orders/:id/messages',{
  config:writeConfig,schema:{body:{type:'object',required:['text'],additionalProperties:false,properties:{text:{type:'string',minLength:1,maxLength:2000}}}},
 },req=>{if(accountRooms)throw new OrderError(410,'Use /chat/messages: conversations belong to customer accounts, not orders');return orders.message(req.params.id,token(req),req.body.text);});
 app.post<{Params:{id:string}}>('/orders/:id/receipts',{config:{...writeConfig,rateLimit:{max:5,timeWindow:'1 minute'}},bodyLimit:5*1024*1024},async(req,reply)=>{
  // Authenticate before storing any bytes on disk.
  await orders.read(req.params.id,token(req));
  const buffer=req.body;if(!Buffer.isBuffer(buffer)||!buffer.length)throw new OrderError(400,'Upload raw PNG/JPEG/PDF bytes');
  const extension=receiptMime(buffer,String(req.headers['content-type']??'').split(';')[0]);
  const id=randomUUID();await mkdir(fileRoot,{recursive:true});const path=join(fileRoot,`${id}.${extension}`);
  await writeFile(path,buffer,{flag:'wx'});
  try{return reply.code(201).send(await orders.receipt(req.params.id,token(req),{id,path,mime:String(req.headers['content-type']).split(';')[0],size:buffer.length}));}
  catch(e){await unlink(path);throw e;}
 });
 app.get<{Params:{id:string;fileId:string}}>('/orders/:id/receipts/:fileId',{config:publicConfig},async(req,reply)=>{
  const file=await orders.receiptFile(req.params.id,token(req),req.params.fileId);
  return reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',`attachment; filename="receipt-${file.id}"`).type(file.mime).send(await readFile(file.path));
 });
 app.get<{Params:{id:string}}>('/admin/orders/:id',req=>{if(!adminConfigured)throw new OrderError(503,'Configure API_KEY');return orders.adminRead(req.params.id);});
 app.get('/admin/telegram/outbox',async()=>{if(!adminConfigured)throw new OrderError(503,'Configure API_KEY');return{data:await orders.outboxStatus()};});
}
