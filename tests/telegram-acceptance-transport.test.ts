import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runTelegram} from '../src/telegram.js';
import type {OrderService} from '../src/orders.js';
const config={token:'fake',chatId:'123',userId:'123',botKey:'acceptance-test'};
test('acceptance transport stops all workers on a Telegram 409 instead of competing',async()=>{
 const original=globalThis.fetch,controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),1500);let polls=0,requestSignal:AbortSignal|undefined;
 globalThis.fetch=async(_input,init)=>{polls++;requestSignal=init?.signal??undefined;return Response.json({ok:false,error_code:409,description:'Conflict'},{status:409});};
 try{
  const service={claim:async()=>null,cursor:async()=>0} as unknown as OrderService;
  await assert.rejects(runTelegram(service,config,controller.signal,undefined,undefined,{stopOnConflict:true}),error=>(error as {code?:number}).code===409);
  assert.equal(polls,1);assert.equal(requestSignal?.aborted,true);assert.equal(controller.signal.aborted,false);
 }finally{clearTimeout(deadline);controller.abort();globalThis.fetch=original;}
});
test('acceptance rejects an unrelated update without advancing its acknowledgement cursor',async()=>{
 const original=globalThis.fetch,controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),1500);let advanced=0,polls=0;
 globalThis.fetch=async()=>{polls++;return Response.json({ok:true,result:[{update_id:42,message:{from:{id:123},chat:{id:123,type:'private'},text:'production traffic'}}]});};
 try{
  const service={claim:async()=>null,cursor:async()=>0,advance:async()=>{advanced++;}} as unknown as OrderService;
  await assert.rejects(runTelegram(service,config,controller.signal,undefined,undefined,{beforeUpdate:async()=>false}),/outside.*acceptance/i);
  assert.equal(advanced,0);assert.equal(polls,1);assert.equal(controller.signal.aborted,false);
 }finally{clearTimeout(deadline);controller.abort();globalThis.fetch=original;}
});
