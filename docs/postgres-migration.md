# Squid first PostgreSQL migration

On 2026-11-18, the user started Docker Desktop and the existing local catalog was migrated to PostgreSQL 17.

- Compose project: squid-first; service: db; container: squid-first-db-1.
- Database/user: catalog; loopback endpoint: 127.0.0.1:5432.
- Persistent volume: squid-first_postgres_data.
- Password is generated locally and stored only in ignored .env; never committed or printed.
- Active .env DATABASE_URL points to PostgreSQL. API remains a Node process on localhost:3000, with AUTO_SYNC=true and the existing 15:00–16:00 local schedule.
- Migrated 2 sources, 2 source states, 2 games, 237 packages and 1 user-provided FX reference. No new live source data was fetched during migration.
- Every copied row/column was compared in the target transaction before COMMIT.
- Verified PostgreSQL 17.11 after container restart/recreation: 237 packages and the screenshot rate persisted; an injected transaction failure rolled back correctly. The running HTTP API was verified against PostgreSQL for both games and USD conversion.
- Original PGlite directory data/catalog is retained. Offline JSON export: data/backups/pglite-before-postgres-2026-11-18T03-10-40-031Z.json.

The migration script scripts/migrate-to-postgres.ts refuses nonempty target catalogs and expects a PGlite source DATABASE_URL. It must run with the PGlite API stopped; it does not automatically switch .env or overwrite the source. Do not run it again against the migrated target.

To return to the preserved source, stop the Node API, set DATABASE_URL=pglite://./data/catalog and restart it. That source is a snapshot from migration time and will not contain subsequent PostgreSQL updates. Do not remove Docker volumes when stopping services if you want to retain PostgreSQL data.
