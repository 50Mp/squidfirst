import type {Database} from '../database.js';
export async function initAdminEvents(db:Database){
 await db.query('CREATE TABLE IF NOT EXISTS admin_events(id BIGSERIAL PRIMARY KEY,payload JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 await db.query('CREATE TABLE IF NOT EXISTS admin_chat_reads(admin_id TEXT NOT NULL,room_id TEXT NOT NULL,last_message_id BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(admin_id,room_id))');
 await db.query(`CREATE OR REPLACE FUNCTION squid_admin_change_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
 DECLARE item JSONB; BEGIN
 item := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 INSERT INTO admin_events(payload) VALUES(jsonb_build_object('entity',TG_TABLE_NAME,'id',COALESCE(item->>'id',item->>'source_id',item->>'game_id',item->>'product_id'),'revision',item->'revision','room_id',item->>'room_id'));
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END; $$`);
 for(const table of ['orders','customer_chat_messages','customer_accounts','shop_products','source_settings','operational_settings','game_settings','zone_settings','source_state','fx_rates','user_fx_rates','sync_runs']){
  await db.query(`DROP TRIGGER IF EXISTS squid_admin_change ON ${table}`);
  await db.query(`CREATE TRIGGER squid_admin_change AFTER INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION squid_admin_change_event()`);
 }
}
