import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {openDatabase,type Database} from '../../src/database.js';

// Only the standalone loopback preview uses this import. Customer data and
// transport queues are intentionally absent from the preview database.
export async function copyPreviewOrders(target:Database){
 const {DATABASE_URL:sourceUrl}=parseEnv(await readFile(new URL('../../.env',import.meta.url),'utf8'));
 const url=new URL(sourceUrl??'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
  throw new Error('Preview order import requires a local PostgreSQL source');
 }
 const source=await openDatabase(url.href);
 try{
  const {rows}=await source.transaction(async tx=>{
   await tx.query('SET TRANSACTION READ ONLY');
   return tx.query(`SELECT id,status,payment_verified,created_at,
    jsonb_build_object('name',public_snapshot->'name','game_id',public_snapshot->'game_id',
     'zone',public_snapshot->'zone','price_usd',public_snapshot->'price_usd') AS details,
    jsonb_build_object('source_id',internal_snapshot->'source_id','cost_lak',internal_snapshot->'cost_lak',
     'lak_per_usd',internal_snapshot->'lak_per_usd','markup_bps',internal_snapshot->'markup_bps') AS costs
    FROM orders WHERE COALESCE(public_snapshot->>'mock','false')='false'
    ORDER BY created_at DESC,id DESC LIMIT 10`);
  });
  let imported=0;
  await target.transaction(async tx=>{
   for(const row of rows){
    const id=createHash('sha256').update('local-preview:'+row.id).digest('hex');
    const result=await tx.query(`INSERT INTO orders(id,token_hash,request_key,request_hash,status,
      payment_verified,public_snapshot,internal_snapshot,created_at)
      VALUES($1,'preview',$1,'preview',$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING id`,
     [id,row.status,row.payment_verified,JSON.stringify(row.details),JSON.stringify(row.costs),row.created_at]);
    imported+=result.rows.length;
   }
  });
  return {available:rows.length,imported};
 }finally{await source.close();}
}
