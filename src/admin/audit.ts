import type {SQL} from '../database.js';
import type {AdminActor,AuditInput} from './contracts.js';
export async function appendAudit(tx:SQL,actor:AdminActor,event:AuditInput){
 await tx.query('INSERT INTO admin_audit(actor_id,channel,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.id,actor.channel,event.action,event.entityType,event.entityId,JSON.stringify(event.before),JSON.stringify(event.after)]);
}
