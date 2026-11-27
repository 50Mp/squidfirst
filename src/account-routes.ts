import type { FastifyInstance } from 'fastify';
import type { Accounts } from './accounts.js';
import type { CustomerChat } from './customer-chat.js';
import { sessionToken } from './session.js';
import { OrderError } from './orders.js';
import {sendChatAttachment} from './chat-attachment.js';

export function accountRoutes(app:FastifyInstance,accounts:Accounts,chat:CustomerChat){
 const customer={customerRoute:true};
 const credentials={body:{type:'object',additionalProperties:false,required:['username','password'],properties:{username:{type:'string',minLength:3,maxLength:30},password:{type:'string',minLength:12,maxLength:128}}}};
 const origin=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${process.env.PORT||3000}`;
 app.addHook('onRequest',async(req)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.routeOptions.config.customerRoute){
   if(req.headers.origin&&req.headers.origin!==origin)throw new OrderError(403,'Invalid request origin');
   if(req.headers.cookie?.includes('squid_session=')&&!req.headers.authorization&&req.headers.origin!==origin)throw new OrderError(403,'Authenticated browser writes require the configured origin');
  }
 });
 const cookie=(value:string,maxAge=2592000)=>`squid_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
 for(const action of ['register','login'] as const){
  app.post<{Body:{username:string;password:string}}>(`/auth/${action}`,{config:{...customer,rateLimit:{max:5,timeWindow:'1 minute'}},schema:credentials},async(req,reply)=>{
   const result=await accounts[action](req.body.username,req.body.password);
   return reply.header('Cache-Control','no-store').header('Set-Cookie',cookie(result.token)).send({user:result.user});
  });
 }
 app.get('/auth/me',{config:customer},async(req,reply)=>reply.header('Cache-Control','no-store').send({user:await accounts.authenticate(sessionToken(req))}));
 app.post('/auth/logout',{config:customer},async(req,reply)=>{await accounts.logout(sessionToken(req));return reply.header('Set-Cookie',cookie('',0)).send({ok:true});});
 app.get<{Querystring:{after?:string}}>('/chat',{config:customer,schema:{querystring:{type:'object',properties:{after:{type:'string',pattern:'^[0-9]{1,15}$'}}}}},async(req,reply)=>reply.header('Cache-Control','no-store').send(await chat.read(sessionToken(req),Number(req.query.after??0))));
 app.get<{Params:{messageId:string}}>('/chat/messages/:messageId/attachment',{config:customer},async(req,reply)=>
  sendChatAttachment(reply,await chat.customerAttachment(sessionToken(req),req.params.messageId)));
 app.post<{Body:{text:string;client_message_id:string}}>('/chat/messages',{config:{...customer,rateLimit:{max:10,timeWindow:'1 minute'}},schema:{body:{type:'object',required:['text','client_message_id'],additionalProperties:false,properties:{text:{type:'string',minLength:1,maxLength:2000},client_message_id:{type:'string',minLength:8,maxLength:100}}}}},req=>chat.customerMessage(sessionToken(req),req.body.text,req.body.client_message_id));
 app.get('/admin/chat-rooms',()=>chat.adminRooms());
}
