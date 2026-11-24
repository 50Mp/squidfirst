import { createHash,randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { GAMES, SOURCE, SOURCES, snapshotGameId, validateSnapshot, type Snapshot } from './catalog.js';
import {initOperationalTables,resolveEffectiveFxRate} from './operations/settings.js';
import { selectLfxUsdRate, type LfxQuote, type StoredRate } from './fx.js';
import { requireSyncWindow } from './schedule.js';

export interface SQL { query(sql: string, params?: any[]): Promise<{ rows: any[] }> }
export interface Database extends SQL { transaction<T>(fn: (sql: SQL) => Promise<T>): Promise<T>; close(): Promise<void> }

export async function openDatabase(url = process.env.DATABASE_URL || 'pglite://./data/catalog'): Promise<Database> {
  if (url === 'memory:' || url.startsWith('pglite://')) {
    const path = url === 'memory:' ? undefined : resolve(url.slice('pglite://'.length));
    if (path) await mkdir(path, { recursive: true });
    const db = new PGlite(path);
    await db.waitReady;
    return {
      query: (s, p) => db.query(s, p),
      transaction: fn => db.transaction(tx => fn({ query: (s, p) => tx.query(s, p) })),
      close: () => db.close(),
    };
  }
  if (!/^postgres(?:ql)?:\/\//.test(url)) throw new Error('DATABASE_URL must be postgres://, postgresql:// or pglite://');
  const pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 10000 });
  pool.on('error', error => console.error('Database pool error:', error.message));
  return {
    query: (s, p) => pool.query(s, p),
    transaction: async fn => {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

export class Repository {
  constructor(private db: Database) {}
  async beginSync(source:string){return this.db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['sync:'+source]);await tx.query("UPDATE sync_runs SET status='failed',finished_at=NOW(),lease_until=NULL WHERE source_id=$1 AND status='running' AND lease_until<NOW()",[source]);if((await tx.query("SELECT id FROM sync_runs WHERE source_id=$1 AND status='running'",[source])).rows.length)return null;const id=randomUUID();await tx.query("INSERT INTO sync_runs(id,source_id,status,lease_until) VALUES($1,$2,'running',NOW()+INTERVAL '65 minutes')",[id,source]);return id;});}
  async finishSync(id:string,status:string,result:unknown){await this.db.query('UPDATE sync_runs SET status=$1,result=$2,finished_at=NOW(),lease_until=NULL WHERE id=$3',[status,JSON.stringify(result),id]);}
  async init() {
    // Separate statements work with both the wire-protocol driver and embedded PostgreSQL.
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS catalog_state (id INTEGER PRIMARY KEY CHECK (id=1), last_success_at TIMESTAMPTZ, data_origin TEXT)`,
      `INSERT INTO catalog_state (id) VALUES (1) ON CONFLICT DO NOTHING`,
      `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, source_url TEXT NOT NULL)`,
      `ALTER TABLE games ADD COLUMN IF NOT EXISTS required_fields JSONB`,
      `CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), name TEXT NOT NULL, note TEXT NOT NULL,
        price INTEGER NOT NULL CHECK (price>0), currency TEXT NOT NULL CHECK (currency='LAK'),
        active BOOLEAN NOT NULL DEFAULT TRUE, position INTEGER NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL, UNIQUE(game_id,name))`,
      `CREATE INDEX IF NOT EXISTS packages_game_active ON packages(game_id,active)`,
      `CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS source_state(source_id TEXT PRIMARY KEY REFERENCES sources(id),last_success_at TIMESTAMPTZ,data_origin TEXT)`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT 'jorjee'`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS variant_id TEXT NOT NULL DEFAULT 'default'`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS zone TEXT NOT NULL DEFAULT 'unspecified'`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS source_game_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT 'https://jorjeegamestore.com/'`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS source_game_id TEXT`,
      `ALTER TABLE packages ADD COLUMN IF NOT EXISTS source_package_id TEXT`,
      `ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_game_id_name_key`,
      `CREATE UNIQUE INDEX IF NOT EXISTS packages_source_variant_legacy_name ON packages(source_id,game_id,variant_id,name) WHERE source_package_id IS NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS packages_source_variant_supplier_id ON packages(source_id,game_id,variant_id,source_package_id) WHERE source_package_id IS NOT NULL`,
      `DROP INDEX IF EXISTS packages_source_variant_name`,
      `CREATE TABLE IF NOT EXISTS fx_rates (
        id TEXT PRIMARY KEY, quote JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL,
        CHECK ((fetched_at AT TIME ZONE 'Asia/Vientiane')::time >= TIME '15:00:00' AND
               (fetched_at AT TIME ZONE 'Asia/Vientiane')::time < TIME '16:00:00'))`,
      `CREATE INDEX IF NOT EXISTS fx_rates_latest ON fx_rates(fetched_at DESC)`,
      `CREATE TABLE IF NOT EXISTS user_fx_rates (
        id TEXT PRIMARY KEY,quote JSONB NOT NULL,evidence TEXT NOT NULL,provided_at TIMESTAMPTZ NOT NULL)`,
    ]) await this.db.query(sql);
    for (const game of GAMES) {
      await this.db.query(`INSERT INTO games(id,name,source_url,required_fields) VALUES($1,$2,$3,$4)
        ON CONFLICT(id) DO UPDATE SET required_fields=EXCLUDED.required_fields WHERE games.required_fields IS NULL`,
      [game.id,game.name,SOURCE,JSON.stringify(game.required_fields)]);
    }
    await initOperationalTables(this.db);
    for (const source of SOURCES) {
      await this.db.query('INSERT INTO sources(id,name,url) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.id,source.name,source.url]);
      if (source.id === 'jorjee') await this.db.query(`INSERT INTO source_state(source_id,last_success_at,data_origin) SELECT 'jorjee',last_success_at,data_origin FROM catalog_state WHERE id=1 ON CONFLICT DO NOTHING`);
      else await this.db.query('INSERT INTO source_state(source_id) VALUES($1) ON CONFLICT DO NOTHING', [source.id]);
    }
    // Upgrade the initial TH-only Free Fire identifier without losing its stored prices.
    await this.db.transaction(async tx => {
      const legacy = (await tx.query("SELECT * FROM games WHERE id='free-fire-th'")).rows[0];
      if (!legacy) return;
      const rows = (await tx.query("SELECT * FROM packages WHERE game_id='free-fire-th'")).rows;
      for (const row of rows) {
        const id = createHash('sha256').update(`free-fire\0${row.name}`).digest('hex').slice(0,32);
        const existing = (await tx.query('SELECT id FROM packages WHERE id=$1', [id])).rows[0];
        if (existing) await tx.query('DELETE FROM packages WHERE id=$1', [row.id]);
        else await tx.query("UPDATE packages SET id=$1,game_id='free-fire',zone='th',source_game_name='Free Fire (TH)' WHERE id=$2", [id,row.id]);
      }
      await tx.query("DELETE FROM games WHERE id='free-fire-th'");
    });
  }
  async save(input: Snapshot[], observedAt: string, origin: 'seed' | 'live', sourceId = 'jorjee', beforeCommit?: () => void) {
    const source = SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error('Unknown source');
    const snapshot = validateSnapshot(input,sourceId);
    if (!Number.isFinite(Date.parse(observedAt))) throw new Error('Invalid observation date');
    await this.db.transaction(async tx => {
      const state = (await tx.query('SELECT * FROM source_state WHERE source_id=$1 FOR UPDATE', [sourceId])).rows[0];
      const enabled=(await tx.query('SELECT enabled FROM source_settings WHERE source_id=$1 FOR SHARE',[sourceId])).rows[0];
      if(enabled?.enabled===false)throw new Error('Source disabled before catalog commit');
      if (origin === 'seed' && state.data_origin === 'live') throw new Error('Seed cannot overwrite live data');
      if (state.last_success_at && Date.parse(observedAt) < new Date(state.last_success_at).getTime()) throw new Error('Older snapshot rejected');
      const discovered = snapshot.some(variant => variant.source_game_id);
      if (discovered) await tx.query('UPDATE packages SET active=FALSE WHERE source_id=$1 AND active=TRUE', [sourceId]);
      else for (const game of GAMES) await tx.query('UPDATE packages SET active=FALSE WHERE game_id=$1 AND source_id=$2 AND active=TRUE',[game.id,sourceId]);

      const oldIds = new Map<string,string>();
      if (discovered) {
        const {rows} = await tx.query('SELECT id,game_id,variant_id,source_package_id FROM packages WHERE source_id=$1 AND source_package_id IS NOT NULL',[sourceId]);
        for (const row of rows) oldIds.set(`${row.game_id}\0${row.variant_id}\0${row.source_package_id}`,row.id);
      }
      const linkedIds = new Set(oldIds.values());
      for (const variant of snapshot) {
          const gameId = snapshotGameId(variant.game,variant.source_game_id)!;
          const url = variant.source_url ?? source.url;
          if (new URL(url).origin !== new URL(source.url).origin) throw new Error('Source URL origin mismatch');
          if (variant.source_game_id) await tx.query(`INSERT INTO games(id,name,source_url) VALUES($1,$2,$3)
            ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name WHERE games.id LIKE 'jorjee-%' AND games.name IS DISTINCT FROM EXCLUDED.name`,[gameId,variant.game,url]);
          const counts = new Map<string,number>();
          for (const p of variant.packages) counts.set(p.name,(counts.get(p.name)??0)+1);
          for (const [position, p] of variant.packages.entries()) {
            const scopedKey = `${gameId}\0${variant.variant_id}\0${p.source_package_id ?? p.name}`;
            const legacy = sourceId === 'jorjee' && variant.variant_id === 'default' && counts.get(p.name) === 1;
            const sourceIdentity = createHash('sha256').update(`${sourceId}\0${scopedKey}`).digest('hex').slice(0,32);
            const legacyId = legacy ? createHash('sha256').update(`${gameId}\0${p.name}`).digest('hex').slice(0,32) : sourceIdentity;
            const id = oldIds.get(scopedKey) ?? (p.source_package_id && linkedIds.has(legacyId) ? sourceIdentity : legacyId);
            await tx.query(`INSERT INTO packages(id,game_id,name,note,price,currency,active,position,observed_at,source_id,variant_id,zone,source_game_name,source_url,source_game_id,source_package_id)
              VALUES($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,
                note=CASE WHEN EXCLUDED.source_package_id IS NOT NULL AND EXCLUDED.note='' THEN packages.note ELSE EXCLUDED.note END,
                price=EXCLUDED.price,active=TRUE,position=EXCLUDED.position,observed_at=EXCLUDED.observed_at,zone=EXCLUDED.zone,
                source_game_name=EXCLUDED.source_game_name,source_url=EXCLUDED.source_url,
                source_game_id=COALESCE(EXCLUDED.source_game_id,packages.source_game_id),
                source_package_id=COALESCE(EXCLUDED.source_package_id,packages.source_package_id)`,
            [id,gameId,p.name,p.note,p.price,p.currency,position,observedAt,sourceId,variant.variant_id,variant.zone,variant.source_game_name,url,variant.source_game_id??null,p.source_package_id??null]);
          }
      }
      await tx.query('UPDATE source_state SET last_success_at=$1,data_origin=$2 WHERE source_id=$3', [observedAt, origin,sourceId]);
      beforeCommit?.();
    });
  }
  async health() { await this.db.query('SELECT 1'); }
  async sourceEnabled(id:string){return(await this.db.query('SELECT enabled FROM source_settings WHERE source_id=$1',[id])).rows[0]?.enabled!==false;}
  async status(source = 'jorjee') { return (await this.db.query('SELECT source_id,last_success_at,data_origin FROM source_state WHERE source_id=$1', [source])).rows[0]; }
  async sources() { return (await this.db.query('SELECT s.*,st.last_success_at,st.data_origin FROM sources s JOIN source_state st ON st.source_id=s.id ORDER BY s.id')).rows; }
  async games() { return (await this.db.query(`SELECT g.id,g.name,COUNT(p.id)::INTEGER AS package_count FROM games g LEFT JOIN packages p ON p.game_id=g.id AND p.active=TRUE GROUP BY g.id,g.name ORDER BY g.id`)).rows; }
  async game(id:string) { return (await this.db.query('SELECT id,name,required_fields FROM games WHERE id=$1',[id])).rows[0]; }
  async packages(id: string, includeInactive: boolean, filter: {source?: string; zone?: string; variant?: string} = {}) {
    const params: any[] = [id]; const clauses = ['game_id=$1'];
    if (!includeInactive) clauses.push('active=TRUE');
    for (const [column,value] of [['source_id',filter.source],['zone',filter.zone],['variant_id',filter.variant]]) {
      if (value !== undefined) { params.push(value); clauses.push(`${column}=$${params.length}`); }
    }
    return (await this.db.query(`SELECT id,game_id,source_id,variant_id,zone,source_game_name,source_url,source_game_id,source_package_id,name,note,price,currency,active,observed_at FROM packages WHERE ${clauses.join(' AND ')} ORDER BY source_id,variant_id,position,id`, params)).rows;
  }
  async variants(id: string) { return (await this.db.query(`SELECT source_id,variant_id,zone,source_game_name,source_url,COUNT(*)::INTEGER AS package_count FROM packages WHERE game_id=$1 AND active=TRUE GROUP BY source_id,variant_id,zone,source_game_name,source_url ORDER BY source_id,variant_id`, [id])).rows; }
  async saveFxRate(input: LfxQuote, fetchedAt: string, beforeCommit?:()=>void) {
    requireSyncWindow(new Date(fetchedAt));
    const quote = selectLfxUsdRate([input.raw_row]);
    if (quote.lak_per_usd !== input.lak_per_usd) throw new Error('Quote does not match source row');
    const id = createHash('sha256').update(`${new Date(fetchedAt).toISOString()}\0${quote.lak_per_usd}`).digest('hex').slice(0,32);
    await this.db.transaction(async tx => {
      await tx.query('INSERT INTO fx_rates(id,quote,fetched_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id,JSON.stringify(quote),fetchedAt]);
      beforeCommit?.();
    });
  }
  async latestFxRate(sql:SQL=this.db): Promise<StoredRate | null> {
    const row = (await sql.query(`SELECT * FROM (
      SELECT id,quote,fetched_at,NULL::TIMESTAMPTZ AS provided_at,'lfx_fetch' AS provenance,NULL::TEXT AS evidence FROM fx_rates
      UNION ALL
      SELECT id,quote,NULL::TIMESTAMPTZ AS fetched_at,provided_at,'user_provided' AS provenance,evidence FROM user_fx_rates
      ) rates ORDER BY COALESCE(fetched_at,provided_at) DESC,id DESC LIMIT 1`)).rows[0];
    return row ? { ...row.quote,id:row.id,fetched_at:row.fetched_at,provided_at:row.provided_at,
      provenance:row.provenance,evidence:row.evidence,data_url:row.provenance === 'user_provided' ? null : row.quote.data_url } : null;
  }
  async effectiveFxRate(sql:SQL=this.db):Promise<StoredRate|null>{
    return resolveEffectiveFxRate(sql,await this.latestFxRate(sql));
  }
  async saveUserProvidedFxRate(input:LfxQuote,evidence:string,providedAt=new Date().toISOString()) {
    if (!Number.isFinite(Date.parse(providedAt)) || typeof evidence !== 'string' || !evidence.trim() || evidence.length>1000) throw new Error('Invalid user-provided rate evidence');
    const quote=selectLfxUsdRate([input.raw_row]);
    if (quote.lak_per_usd !== input.lak_per_usd) throw new Error('Quote does not match user evidence');
    const id=createHash('sha256').update(`user\0${quote.lak_per_usd}\0${providedAt}\0${evidence}`).digest('hex').slice(0,32);
    // An explicit user-supplied reference is separate from automatic, window-restricted ingestion.
    await this.db.query('INSERT INTO user_fx_rates(id,quote,evidence,provided_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [id,JSON.stringify({...quote,data_url:null}),evidence.trim(),providedAt]);
  }
}
