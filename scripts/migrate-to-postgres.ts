import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { openDatabase,Repository } from '../src/database.js';

// Offline copy of this application's catalog, never a new scrape or FX update.
const sourceUrl=process.env.DATABASE_URL || 'pglite://./data/catalog';
if (!sourceUrl.startsWith('pglite://')) throw new Error('Migration source must be the existing PGlite database');
if (!process.env.POSTGRES_PASSWORD) throw new Error('POSTGRES_PASSWORD is required');
const targetUrl=`postgresql://catalog:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@127.0.0.1:5432/catalog`;
const tables=['sources','catalog_state','source_state','games','packages','fx_rates','user_fx_rates'] as const;
const source=await openDatabase(sourceUrl);
const target=await openDatabase(targetUrl);
function normalize(value:any):any {
  if(value instanceof Date) return value.toISOString();
  if(Array.isArray(value)) return value.map(normalize);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
  return value;
}
try {
  await new Repository(target).init();
  for(const table of ['games','packages','fx_rates','user_fx_rates']) {
    const n=(await target.query(`SELECT COUNT(*)::INTEGER AS n FROM ${table}`)).rows[0].n;
    if(n!==0) throw new Error(`Target ${table} is not empty; refusing to overwrite it`);
  }
  const data:Record<string,any[]>={};
  for(const table of tables) data[table]=(await source.query(`SELECT * FROM ${table}`)).rows;
  await mkdir('data/backups',{recursive:true});
  const backup=`data/backups/pglite-before-postgres-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  await writeFile(backup,JSON.stringify({created_at:new Date().toISOString(),tables:data},null,2),{flag:'wx'});
  console.log('Offline data backup saved:',backup);
  await target.transaction(async tx=>{
    for(const table of tables) {
      for(const row of data[table]) {
        const columns=Object.keys(row);
        const primary=table==='source_state' ? 'source_id':'id';
        const update=columns.filter(c=>c!==primary).map(c=>`"${c}"=EXCLUDED."${c}"`).join(',');
        await tx.query(`INSERT INTO ${table}(${columns.map(c=>`"${c}"`).join(',')}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(',')}) ON CONFLICT(${primary}) DO UPDATE SET ${update}`,columns.map(c=>row[c]));
      }
    }
    for(const table of tables) {
      const copied=(await tx.query(`SELECT * FROM ${table}`)).rows;
      const sort=(rows:any[])=>normalize(rows).sort((a:any,b:any)=>String(a.id??a.source_id).localeCompare(String(b.id??b.source_id)));
      assert.deepEqual(sort(copied),sort(data[table]),`Copied ${table} differs from source`);
    }
  });
  console.log('Migration committed; every row and column verified against source.');
  for(const table of tables) console.log(table,data[table].length,'rows');
  console.log('Original PGlite directory retained. DATABASE_URL has not been changed by this script.');
} finally {await source.close();await target.close();}
