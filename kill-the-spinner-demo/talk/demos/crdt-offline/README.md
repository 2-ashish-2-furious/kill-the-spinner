# CRDT offline-merge demo

The 30-second CRDT contrast for **S17** of `local-first-kill-the-spinner.md` (see also the
"Optional, if you have prep time" note in Demo build notes). It shows the one thing the
server-authoritative demo cannot do: two clients edit the same data while both are offline,
survive a reload while still offline, then merge losslessly on reconnect.

Two `Y.Doc` instances in a single page. No server, no WebRTC, no websockets, no signalling.
Updates move through an in-page channel; "offline" means they queue instead of transmitting.

## Files

| File | What |
|---|---|
| `index.html` | The whole demo. Open it directly. |
| `vendor/yjs-bundle.js` | Pre-bundled `yjs` 13.6.32 + `y-indexeddb` 9.0.12 (IIFE, ~95 KB). Vendored so the demo works with wifi off. |

## Opening it

Double-click `index.html`, or:

```sh
open 'talk/demos/crdt-offline/index.html?src=local'
```

`index.html` tries a CDN first and falls back to `vendor/yjs-bundle.js`. **On stage, use
`?src=local`** — it skips the CDN entirely and boots in <100 ms instead of ~1.3 s. The chip in
the top bar tells you which one loaded (`local vendor` or `CDN`).

Use **Chrome / Chromium**. Verified working from `file://` with the network fully disconnected,
including IndexedDB. Safari is stricter about storage on `file://` — if the top bar says
`no IndexedDB`, serve the directory instead: `python3 -m http.server 8000`.

Sized for 1280×720 up to 1920×1080 with no scrolling. Don't add browser zoom; the type is
already projector-sized.

## On-stage run order (~60 seconds)

**Before you go on:** open the page, click **↻ Reset**, confirm the top bar reads
`A ≡ B IN SYNC` and both pills say `ONLINE`. Leave it on its own tab.

| # | Click | What the room sees | Say |
|---|---|---|---|
| 1 | A checkbox in **Client A** | It ticks in **Client B** too | "Two clients, one shared list. Connected." |
| 2 | **◐ Both offline** | Both panes go red and dashed | "Now both of them are offline." |
| 3 | **⚡ Clash both** — twice | Item **①** diverges: A gains `— ship it`, B gains `URGENT:`. Top bar flips to `A ≠ B DIVERGED · 4 queued`, both `▲ unsent` badges light up | "Same item. Same field. Neither one can see the other." |
| 4 | Type in A's box → **+ Add**; type in B's box → **+ Add** | Two different new items, queue counters climb | "And separate edits, on both sides." |
| 5 | **↻ Reload A from disk** | Client A's list is rebuilt from IndexedDB — unchanged, still offline, `▲ unsent` unchanged | "That's client A restarted. Its document came back off the disk. Still offline, nothing lost." |
| 6 | A's **OFFLINE** pill | A's `▲ 3 unsent` drops to 0, B's `▼ 3 incoming` lights up | "A is back on the network. B still isn't — so A's edits are sitting in the queue waiting for it." |
| 7 | B's **OFFLINE** pill | Both lists flash blue and become identical. Item ① reads `URGENT: URGENT: Rehearse the demo — ship it — ship it`. Top bar: `A ≡ B IN SYNC` | "Nothing was overwritten. Both edits to the same field survived. Nothing decided a winner — there was nothing to decide." |

Then hand back to S17: merging worked; retained history and network transport are where the
cost lives.

**Re-running back to back:** click **↻ Reset**. It clears both IndexedDB databases and reseeds
identical state on both clients, both online.

## Controls

- **ONLINE / OFFLINE pill** (per pane) — the partition. Offline queues instead of transmitting.
- **▲ unsent** — my edits that have not been transmitted (I am offline).
- **▼ incoming** — their edits waiting for me to come back online.
- **⚡ Edit item ①** (per pane) / **⚡ Clash both** — one-click same-item collision. A appends
  ` — ship it` at the end of item ①'s title, B inserts `URGENT: ` at the start. Click repeatedly
  to grow the divergence.
- **edit** (per row) — free-text editing, applied as a character-level diff on the `Y.Text`, so
  two people retyping the same title merge instead of overwriting. Enter commits, Escape cancels.
- **↻ Reload A / B from disk** — throws away that pane's `Y.Doc` and rebuilds it from IndexedDB.
  The page keeps running, so the other pane and the queue counters are untouched.
- **↻ Reset** — clears IndexedDB and reseeds.

Keyboard, if you'd rather not aim at buttons: `1` / `2` toggle A / B online, `c` clash both,
`r` reload A, `o` both offline, `p` both online.

## How it works, in case you get asked

- Shared document is `Y.Array` of `Y.Map { id, title: Y.Text, done: boolean }`. `title` is a
  `Y.Text`, which is why concurrent edits to the *same* title merge character-by-character
  instead of last-write-wins.
- `onLocalUpdate` → if online, hand the update to the other doc; if offline, push to `outbox`.
  If the *recipient* is offline it goes into their `inbox`. Coming online flushes both
  directions, then does a `Y.encodeStateVector` / `Y.encodeStateAsUpdate` reconciliation pass so
  convergence does not depend on the raw queues still being intact — that's what makes
  reconnecting work after a full page reload, where the in-memory queues are gone.
- Persistence is `y-indexeddb`, one database per client (`crdt-offline-demo-A` / `-B`). The
  online/offline flags are kept in `localStorage`, so a full page reload mid-demo comes back
  offline rather than silently reconnecting on you.
- The seed data is generated once and applied as the *same* update to both docs, so the two
  replicas share item ids and the first merge is a real merge, not a de-duplication test.

## Regenerating the vendored bundle

```sh
mkdir -p /tmp/crdt-vendor && cd /tmp/crdt-vendor
npm init -y && npm install yjs y-indexeddb
cat > entry.js <<'EOF'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
globalThis.__CRDT_VENDOR__ = { Y, IndexeddbPersistence, source: 'local vendor' }
EOF
npx esbuild entry.js --bundle --format=iife --minify --target=es2020 \
  --legal-comments=none --outfile=vendor/yjs-bundle.js
```

If you bump versions, update `YJS_VERSION` / `YIDB_VERSION` at the top of the script block in
`index.html` too — they drive the CDN URLs and the version chip in the top bar.
