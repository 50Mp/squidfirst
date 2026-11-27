import type {FastifyReply} from 'fastify';
import {OrderError} from './orders.js';

const maxBytes=4*1024*1024;
const maxBase64=Math.ceil(maxBytes/3)*4;
export const chatMessageBodyLimit=maxBase64+32*1024;
export const chatAttachmentSchema={
 type:'object',additionalProperties:false,required:['name','mime','data'],
 properties:{name:{type:'string',minLength:1,maxLength:180},mime:{enum:['image/png','image/jpeg','image/webp','application/pdf']},data:{type:'string',minLength:4,maxLength:maxBase64}},
};
export interface ChatAttachmentInput {name:string;mime:string;data:string}
export interface ChatAttachment extends ChatAttachmentInput {size:number}

export function validateChatAttachment(input:ChatAttachmentInput):ChatAttachment{
 const name=input.name.trim();
 if(!name||name.length>180||/[\\/\x00-\x1f\x7f]/.test(name)||input.data.length>maxBase64)throw new OrderError(400,'Invalid attachment');
 const bytes=Buffer.from(input.data,'base64');
 if(!bytes.length||bytes.length>maxBytes||bytes.toString('base64')!==input.data)throw new OrderError(400,'Invalid attachment');
 const format=
  bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))?'image/png':
  bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))?'image/jpeg':
  bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':
  bytes.toString('ascii',0,5)==='%PDF-'?'application/pdf':null;
 if(format!==input.mime)throw new OrderError(400,'Unsupported attachment');
 return {name,mime:format,data:input.data,size:bytes.length};
}

export function sendChatAttachment(reply:FastifyReply,file:ChatAttachment){
 const filename=encodeURIComponent(Buffer.from(file.name).toString('utf8')).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 const disposition=file.mime==='application/pdf'?'attachment':'inline';
 return reply.header('Cache-Control','private, no-store')
  .header('X-Content-Type-Options','nosniff')
  .header('Content-Security-Policy',"default-src 'none'; sandbox")
  .header('Content-Disposition',disposition+"; filename*=UTF-8''"+filename)
  .type(file.mime).send(Buffer.from(file.data,'base64'));
}
