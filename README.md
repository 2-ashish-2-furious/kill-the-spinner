# Local-First: Kill the Spinner

Demo app and talk materials for the conference talk **"Local-First: Kill the Spinner"**.

## What's inside

| Path | What it is |
| --- | --- |
| `kill-the-spinner-demo/` | The demo app: TanStack Start + TanStack DB + Electric + Postgres |
| `kill-the-spinner-demo/talk/` | Talk script and slide outline |

The demo has two versions of the same screen:

- **Before** (`/demo-before`): fetch-on-demand with tRPC. You see a spinner on every load, filter, and edit.
- **After** (`/`, `/demo-large`): data syncs from Electric into TanStack DB collections, and the UI reads it with live queries. `/demo-large` uses query-driven sync over roughly 500k rows.

## Quickstart

Prerequisites: Docker, [Caddy](https://caddyserver.com) (run `caddy trust` once), and Node with pnpm. See `.tool-versions` for versions.

```sh
cd kill-the-spinner-demo
cp .env.example .env   # then set BETTER_AUTH_SECRET
pnpm install
pnpm backend:up        # Postgres + Electric
pnpm migrate
pnpm seed:large        # optional: 500k rows for /demo-large (use --count=50000 for rehearsals)
pnpm dev
```

## Demo flags

These are optional and all off by default. Set them in `.env` and restart the dev server:

- `DEMO_BEFORE_LATENCY_MS=400`: adds latency to `/demo-before` so its spinner is visible on a local database.
- `DEMO_SLOW_ROLLBACK=true` and `DEMO_ROLLBACK_DELAY_MS=2000`: keeps a failed optimistic write on screen for a moment before it rolls back.

See `src/lib/demo-flags.ts` for details.

