import {randomUUID} from 'node:crypto';
import type {SQL} from './database.js';

export async function recordAdminChatMessage(tx:SQL,roomId:string,text:string,visibility:'public'|'internal',eventKey:string,
 {attachment=null,mirrorToTelegram=true}:Readonly<{attachment?:string|null;mirrorToTelegram?:boolean}>={}){
 const row=(await tx.query(`INSERT INTO customer_chat_messages(room_id,sender,visibility,text,event_key,attachment)
  VALUES($1,'admin',$2,$3,$4,$5) RETURNING id`,[roomId,visibility,text,eventKey,attachment])).rows[0];
 if(mirrorToTelegram)await tx.query('INSERT INTO customer_chat_jobs(id,room_id,message_id) VALUES($1,$2,$3)',[randomUUID(),roomId,row.id]);
 return row.id;
}
