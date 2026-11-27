# Local runtime with Cloudflare Tunnel

Every Windows development machine uses the same commands and repository paths. No source or hostname edit is needed.

## One-time setup per machine

1. Install Node.js 22 or newer.
2. Install `cloudflared`, or place `cloudflared.exe` in `data/cloudflare/`.
3. Place the authorized remotely-managed Tunnel token in `data/cloudflare/tunnel.token`.
4. Copy `.env.example` to `.env` and add that machine's private database and Telegram values.

The `data/` and `.env` paths are ignored by Git. Never commit or send their contents.

## Commands

```powershell
npm run local:tunnel
npm run local:status
npm run local:stop
```

`local:tunnel` installs locked dependencies when needed, builds the API and Admin UI, starts the API, waits for `/health`, and starts the connector. Logs and PID files are under ignored `data/runtime/`.

Only one development machine should run the shared named Tunnel at a time. Starting the same token on multiple machines creates Cloudflare replicas, so requests can reach different local databases. Use a separate Tunnel and hostname per developer if simultaneous independent environments are required.
