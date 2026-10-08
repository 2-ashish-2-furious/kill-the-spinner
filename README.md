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

## References

### Primary sources

- **Ink & Switch**, *Local-first software: You own your data, in spite of the cloud* (2019). This is where the seven ideals come from: [essay](https://www.inkandswitch.com/essay/local-first/) · [PDF](https://www.inkandswitch.com/essay/local-first/local-first.pdf)
- **James Arthur**, *Why Fetch When You Can Sync? Building Local-First Apps on a Sync Engine Architecture* (InfoQ, 2025): https://www.infoq.com/presentations/local-first-sync-engine/
- **James Arthur / Electric**, *A new approach to building Electric* (2024). Electric's postmortem on rebuilding as a sync engine: https://electric.ax/blog/2024/07/17/electric-next
- **Electric**, *Super fast apps on sync with TanStack DB* (2025): https://electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db

### Articles

- *The Architecture of Local-First Web Development* (Smashing Magazine, 2026): https://www.smashingmagazine.com/2026/05/architecture-local-first-web-development/
- *Electric links*, a curated reading list from the Electric team: https://electric-sql.slab.com/public/posts/electric-links-g7jzs9ax?shr=x7fygg3cg44l0nf4m5pdnuk4

### Talks

- **Martin Kleppmann**, *CRDTs: The Hard Parts*. Covers where CRDTs get expensive: https://www.youtube.com/watch?v=x7drE24geUw

### Docs: sync engines and local stores

- ElectricSQL (used in this demo): https://electric-sql.com/docs
- TanStack DB (used in this demo): https://tanstack.com/db
- Zero (Rocicorp): https://zero.rocicorp.dev/docs
- PowerSync: https://docs.powersync.com/

### Docs: CRDT libraries

- Automerge: https://automerge.org/
- Yjs: https://docs.yjs.dev/

### Community

- localfirst.fm, a podcast and resource hub: https://www.localfirst.fm/

