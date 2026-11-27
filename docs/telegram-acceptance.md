# Telegram / iPhone acceptance environment

Owner chose to reuse `@SquidfirstBot` for a controlled test window on 2026-11-24. The test database remains separate from production. Only one process may receive updates for that bot token at a time. Do not run the test transport alongside another instance or delete a webhook as a workaround.

## Isolation and commands

- Runtime: `scripts/run-telegram-acceptance.ts`; requires explicit `--reuse-existing-bot`.
- Reads only the existing bot credential and matching private owner IDs from ignored `.env`. It never copies the production database URL, API key or sync configuration.
- Storage: ignored `data/telegram-acceptance/database`; port 3200 on loopback; origin `https://admin-test.cffirst.com`.
- Uses the normal owner-only admin signature/session/CSRF implementation. There is no `/preview` login route. Customer checkout and supplier sync are disabled; orders and receipt are marked as simulated.
- The report/stop endpoints require a generated private API key saved in ignored `data/telegram-acceptance/runtime.json`. They are not routed through Cloudflare. Never print that file or its key.
- UI bundle must be built into the test directory, separately from production:

```powershell
npm run build:admin -- --outDir ../data/telegram-acceptance/admin-ui/dist
node --import tsx scripts/run-telegram-acceptance.ts --prepare --reuse-existing-bot
node --import tsx scripts/run-telegram-acceptance.ts --serve --reuse-existing-bot
node --import tsx scripts/run-telegram-acceptance.ts --report --reuse-existing-bot
```

The default server starts expiry maintenance with Telegram transport off. Preparation is idempotent and refuses to open its database again while that runtime is listening. Two UUID orders are prepared: one awaiting manual review of a visibly simulated receipt, and one awaiting payment with its real creation timestamp. No real money or provider purchase is involved.

## Controlled bot cutover — approval still pending

Automatic approval review rejected the initial `--transport` launch because reusing a live bot can compete with production updates or send messages. Do not bypass the rejection. Obtain explicit approval for a test window, temporary pause of the previous receiver, owner-only test menu URL, and restoration afterward before retrying.

Once approved, identify and pause only the verified existing receiver. Stop this test runtime gracefully through its authenticated loopback stop endpoint, then restart it with:

```powershell
node --import tsx scripts/run-telegram-acceptance.ts --serve --reuse-existing-bot --transport
```

The transport start refuses a healthy API on port 3000, refuses a configured webhook, and probes `getUpdates` without an offset so the probe does not acknowledge pending updates. A Telegram 409 means another receiver remains; stop the test launch and resolve that receiver. Do not reset the cursor or start competing pollers. Test-only topics and order IDs belong to the isolated database; avoid interacting with production cards during the test window.

Save the configured owner's original chat menu before changing it to `https://admin-test.cffirst.com/admin-app/`, and restore it after acceptance. Keep credentials in ignored files only. The normal receiver should resume only after the test receiver has stopped.

## Evidence — 2026-11-25

- Backend suite: 63/63. Acceptance helper tests cover explicit reuse, pinned test storage/origin, idempotent cases, completion-only notification and expiry with no notification. Helper/runtime type check passed.
- Tunnel connector was restarted using the current credential of the existing tunnel. No credential rotation was performed; prior local file retained for diagnosis. Old credentials must not be restored to the connector.
- Cloudflare kept the existing admin route and 404 fallback, adding only `admin-test.cffirst.com` with `^/(admin-app|admin/v1)/.*$` to loopback 3200. Its CNAME uses the same tunnel. Previous ingress configuration is saved in ignored `data/cloudflare/acceptance-ingress-before.json` for rollback.
- Test HTTPS: `/admin-app/` 200, anonymous `/admin/v1/me` 401. `/preview`, `/shop/products`, `/auth/register`, `/acceptance/report` and `/` return 404.
- Programmatically signed bootstrap: owner 200, non-owner 403, authenticated orders 200 with two cases. This is not a physical Telegram bootstrap test.
- Completion case ends in short ID `0805bb588a`: payment review with simulated receipt, no verified payment or notifications yet.
- Expiry case ends in short ID `5862ab9f1a`: cancelled by startup maintenance after its creation time exceeded fifteen minutes, no notifications. This proves overdue restart handling; it is not a continuously observed fifteen-minute iPhone test.
- Runtime is currently serving the test admin with Telegram transport off. The owner's bot menu is unchanged. iPhone session/keyboard flow, actual completion delivery and live callbacks remain unverified.
