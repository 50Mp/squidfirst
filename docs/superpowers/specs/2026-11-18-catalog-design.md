# Catalog API

Approved direction: Node.js, TypeScript, Playwright, Fastify, PostgreSQL. Collect only public catalog data for Mobile Legends: Bang Bang and Free Fire (TH); no account lookup, orders or payments.

The API reads stored data, never scrapes during requests. A separate worker refreshes hourly. Validate both games before replacing the catalog in one transaction; failed scraping preserves the previous snapshot. Use stable package identifiers, deactivate missing packages, record source and observation timestamps, and expose last successful refresh. Seed data is explicitly dated 2026-11-18 and must not overwrite a live snapshot.

Approaches: direct scraping per API request couples uptime to the source; scheduled ingestion keeps API availability independent and is selected. External PostgreSQL is the deployment choice. An embedded PostgreSQL-compatible PGlite database is provided for running locally without Docker; the production adapter uses node-postgres.

Read API is bound to localhost by default. Optional API key protects reads. Updates run through CLI or an optional background worker in the server process (for embedded mode). No arbitrary source URLs accepted.

User scope extension: ingest GGXG Store alongside JorJee, all listed Mobile Legends and Free Fire zones. Discover GGXG game links each refresh, retain source variant URLs and labels, and store source/variant/zone independently. Atomically replace each source separately; one source failure must not block another. Provide source and variant listing and package filters. Unspecified regions remain unspecified. API supplies raw offers for comparison; do not automatically assert equivalence between unlike bonus/region/pass products.
