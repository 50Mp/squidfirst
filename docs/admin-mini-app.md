# Squid first Admin Mini App

Local implementation, not yet a public Telegram deployment. Real checkout remains controlled by `ORDERS_ENABLED` and is not enabled by this feature.

## Run and review

```powershell
npm ci
npm run check
npm run check:admin
npm test
npm run build
npx playwright test
npm start
```

The production bundle is served at `/admin-app/` by the existing API process. `npm run dev:admin` runs the client developer server, but bootstrap writes must still match the configured origin; normal development review should use the built same-origin bundle. No developer auth bypass is shipped. The normal browser shows an access gate. Browser tests provide a fake signed Telegram SDK only against an isolated in-memory fixture on port 3101; they never load `.env` or connect to Telegram. Chromium may need `npx playwright install chromium` and OS process-launch permission.

Four menus: overview, orders, customer chat, store management. Store management covers source switches/manual sync, sticky LFX/manual FX, games/zones, verified product mappings, auto/fixed supplier selection, default/per-product markup, payment instructions/accounts, operational alerts, audit and backups. New products start as drafts in the UI. Review the computed cost, rate, markup, selling price and estimated gross profit before publishing.

One customer account owns one chat room and Telegram topic. Order status actions update records and bot cards; they are not public customer chat messages. Internal notes remain admin-only. All mutations require the owner's independent admin cookie session, matching Origin, CSRF token, idempotency keys and revisions where applicable. The catalog API key is never used in the frontend. Signed Telegram bootstrap data is limited to five minutes and one exchange; reopen the app when expired. Admin sessions expire after one hour.

Data updates use authenticated durable cursor polling every four seconds, paused in the background and refreshed on foreground. A disconnected client displays its connection state. Avoid treating any locally visible old data as a new quote after a failed write; conflicts require reviewing the refreshed record. No token, local receipt path, password hash or API key is included in browser events.

## Ingestion and pricing

All shop and LFX fetches/commits remain restricted to `15:00 <= time < 16:00` Asia/Vientiane (UTC+7). Manual sync uses the same guards. A database lease prevents overlapping runs per source; a crashed run expires after 65 minutes. No source URL can be supplied by the client. Source switches also exclude that shop from all new quotes immediately. Previously saved snapshots and orders are retained.

The selected FX mode is persistent. New LFX observations do not replace a manually selected rate. An existing database bootstraps the provenance of its currently selected quote. LFX publication dates are not invented; show fetch time when the source does not publish a date. Rates supplied earlier in chat are not silently written as current live quotes.

Default markup is 1000 basis points (10% added to cost), not 10% of selling revenue. Quotes use integer/decimal arithmetic and round the selling price upward to cents. Game, zone, source, product and FX settings are read under checkout locks. Fixed supplier selection becomes unavailable when that offer cannot be used, rather than switching silently. Unknown zones cannot be published. PUBG/Roblox remain future work pending verification.

Reports exclude MOCK by default. Revenue is completed orders in the selected **order-creation date cohort** (Asia/Bangkok), not a cash-reconciliation ledger. Refunds are shown separately. Gross profit uses saved order cost/rate and is null if required snapshots are missing. Reopening/completing the same order never creates another revenue row. Payment verification and refund buttons record a manual decision; they do not transfer money.

Operational source failure and >26-hour stale-data alerts are deduplicated and retried separately. Disabling those alerts does not remove order/chat outboxes. Telegram delivery is at-least-once during ambiguous network failures; a remotely accepted send whose acknowledgement is lost can still duplicate an operational notice.

## Backups and recovery

Set `ADMIN_BACKUP_KEY` to a base64-encoded 32-byte random key generated in a secure password manager or server secret manager. Store that key separately from the backup volume. Do not commit `.env`. Archives under `data/admin-backups/<id>.sqb` contain AES-256-GCM authenticated encrypted compressed logical records and receipt contents. Manifest metadata includes archive SHA-256, table counts, byte size and receipt count. Retain the latest ten successful local archives. Failed jobs retain metadata; archives are never served as public static files. Local archives must also be copied off-host by the operator to survive disk loss.

This is a logical business-data backup, not a full server image. It preserves catalog, price/FX settings, accounts, rooms, product mappings, order snapshots, receipt records/content, chat messages, admin users/audit and canonical bot-card mappings. Active customer/admin sessions, Telegram cursors/queues, operational jobs and idempotency caches are intentionally omitted so a scratch restore cannot re-send historical jobs. Server secrets and runtime configuration must be recovered separately. Archives are capped at 200 MB compressed / receipt input; this local owner tool is intended for the current small installation.

Restore only into a **new directory**, with no database/worker attached:

```powershell
node --env-file-if-exists=.env --import tsx scripts/restore-admin-backup.ts data/admin-backups/ARCHIVE_ID.sqb data/recovery-check-NEW
```

The tool refuses any existing destination, authenticates/decrypts the archive, verifies each receipt hash, creates an isolated PGlite database, rewrites receipt paths to the new directory and resets serial sequences. No Telegram or ingestion worker starts. Inspect snapshots, account-room relationships and receipts there before planning a separate production recovery. The tool cannot overwrite the production PostgreSQL database. Automated scratch recovery is covered by `tests/backup.test.ts`. Schema upgrades must keep this recovery test green.

## Deploy only after target review

1. Choose the actual host/domain and persistent PostgreSQL/receipt/backup storage. Keep the current bot and owner IDs; never replace credentials as part of deployment.
2. Terminate HTTPS at a proxy that forwards to the API and preserves same-origin cookies. Set `ADMIN_APP_URL=https://YOUR-DOMAIN/admin-app/` and matching `PUBLIC_ORIGIN`. The bundle contains no secret environment variables. Restrict direct database access and keep the API key server-side.
3. Build and run on that host; check `/health`, authenticated owner session/actions/receipts and a denied non-owner session. Keep `ORDERS_ENABLED=false` until storefront and real payment handling are separately verified.
4. Configure backup key/storage, create an archive and perform scratch recovery. Monitor source/FX freshness and Telegram outbox retries.
5. Review the concrete URL and visual layout with the owner. Only after authorization, run the dry-run and apply commands below. The apply command changes only the configured owner's chat menu.

```powershell
node --env-file-if-exists=.env --import tsx scripts/configure-admin-menu.ts
node --env-file-if-exists=.env --import tsx scripts/configure-admin-menu.ts --apply
```

Telegram requires an HTTPS Web App URL. The backend validates signed `initData` and the allowlisted owner independently of the menu button. References: [Mini Apps validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), [setChatMenuButton](https://core.telegram.org/bots/api#setchatmenubutton).

Rollback: stop the upgraded process, restore the prior application build/config and restart it against the preserved database and receipts. Migrations are additive. Do not delete tables, volumes, archives, or replay restored queues as a rollback shortcut. If data recovery is required, stop writes and rehearse on scratch first.

## Local Cloudflare trial selected by owner

Target: `https://admin.cffirst.com/admin-app/`. Existing root/www DNS points at the owner's Pages site and must remain unchanged. Create a dedicated remotely-managed tunnel named `squid-first-local` only after the final public-access confirmation. Keep `cloudflared` on Windows so it can reach the loopback API without exposing a LAN listener. The downloaded official connector is `data/cloudflare/cloudflared.exe` (2026.11.1 verified locally).

Publish a hostname route for `admin.cffirst.com` with path regex `^/(admin-app|admin/v1)/.*$` to service `http://127.0.0.1:3000`. Retain the default 404 fallback. This admits only the Mini App bundle and admin endpoints; do not expose the customer registration/order/catalog endpoints through this admin-only hostname. Verify `/admin-app/` loads, `/admin/v1/me` denies an anonymous request, and `/shop/products` or `/auth/register` on that hostname returns the tunnel fallback 404.

Store the dedicated tunnel token only in ignored `data/cloudflare/tunnel.token`; never put it in command arguments or logs. The launcher uses the official `--token-file` option. Configure `ADMIN_APP_URL` to the target URL, rebuild if needed, and restart the local API so admin Origin/Secure-cookie configuration matches HTTPS. Start the connector only after the owner approves publication:

```powershell
powershell -File scripts/start-local-admin.ps1
powershell -File scripts/start-local-tunnel.ps1
```

Keep this PC, Internet connection and Docker Desktop running. These launchers do not register automatic Windows services. After reboot, start Docker, the API and connector again. A Windows restart or sleep interrupts this trial deployment; moving to an always-on host is a separate operation. Stop the exact recorded connector PID to take the trial offline; do not delete database volumes or the owner's existing DNS records.

Official references: [Create a dashboard tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [token-file parameter](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/#token-file).
