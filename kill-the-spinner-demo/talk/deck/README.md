# Deck — Local-First: Kill the Spinner

Slidev deck for the 25-minute talk. Content source of truth is
`../local-first-kill-the-spinner.md` (including its two appendices, which contain
corrections that supersede earlier slides).

## Run

```sh
cd talk/deck
pnpm install --ignore-workspace     # first time only
pnpm dev                            # opens http://localhost:3030
```

- **`o`** — slide overview
- **`f`** — fullscreen
- **Presenter view** — open `http://localhost:3030/presenter` (or press the presenter
  icon). Shows current + next slide, a timer, and the full speaker notes for each slide.
  **Drive the talk from here** — every slide's script and timing lives in its notes.

## Build & export

```sh
pnpm build     # static SPA in dist/ — open dist/index.html, no server needed
pnpm export    # PDF (needs: pnpm approve-builds, to allow playwright-chromium)
```

`pnpm build` output is the stage backup: fully self-contained, fonts included, works with
no network.

## Design system

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0D10` | near-black, avoids projector banding |
| `--text` | `#E8EAED` | body — not pure white, reduces halation |
| `--dim` / `--faint` | `#9BA3AE` / `#6B747F` | secondary text, citations |
| `--accent` | `#6AA9FF` | emphasis, eyebrows, list markers |
| `--warn` | `#FFB454` | callouts |
| `--danger` | `#FF6B6B` | the four walls, offline failure |
| `--good` | `#4ADE80` | verified / works |

**Type:** Instrument Serif (headings + pull quotes) · Inter (body) · JetBrains Mono
(code, eyebrows, citations).

All three fonts are **vendored** in `public/fonts/` (latin subset, variable weights,
112 KB total) and declared with `@font-face` in `style.css`. Headmatter sets
`fonts.provider: none` so Slidev never calls Google Fonts. **The deck renders correctly
with no network** — verified.

## Utility classes (`style.css`)

`.eyebrow` act label · `.pull` large serif statement · `.cite` source attribution ·
`.note` secondary paragraph · `.card` bordered panel · `.callout` `.callout.danger`
`.callout.good` · `.ideals` seven-ideals grid (`.on` / `.strike` per item) ·
`.demo-marker` big live-demo word · `.cols2` two columns · `.kbd` · colour helpers
`.dim .faint .accent .good .warn .danger .mono .strike`

## Slide map

| # | Slide | Act |
|---|---|---|
| 1 | Title | 1 · hook |
| 2 | **Before** (live demo) | 1 |
| 3 | **After** (live demo) | 1 |
| 4 | Two things are gone — code delta | 2 |
| 5 | Like React, but for data loading | 2 |
| 6 | The paper — "primary copy" | 3 |
| 7 | Seven ideals | 3 |
| 8 | **We took one.** | 3 |
| 9 | Three replaceable roles | 4 |
| 10 | What else fits each slot | 4 |
| 11 | Wall 1 — authorization as a sync boundary | 5 |
| 12 | Wall 2 — data loading is a design decision again | 5 |
| 13 | Wall 3 — conflicts, last-write-wins | 5 |
| 14 | Wall 4 — migrations | 5 |
| 15 | **Offline** (live demo) | 6 |
| 16 | They already ran the experiment | 6 |
| 17 | The other camp paid too | 6 |
| 18 | Choose your row on purpose | 6 |
| 19 | The close — cold-boot spinner | 6 |
| 20 | References | — |

**Never cut:** 3 (the demo), 8 (we took one), 11 (authorization), 15 (offline rollback),
16's headline quote.

## Before you present

1. **Slide 19** — replace the mocked `Loading projects…` box with a real screenshot of the
   starter's cold-boot spinner. Evidence beats mockup.
2. **Slide 6** — verify the Ink & Switch author list before adding names (currently cited
   by title/org/date/URL only, which is safe).
3. **Slide 10** — re-check each project's positioning; this space moves fast and it's the
   slide most likely to draw an "actually…".
4. **Slide 20** — verify venue/year/authors for the CRDT papers.
5. **Demo setup** — see `../local-first-kill-the-spinner.md` for the full run order, and
   remember `DEMO_SLOW_ROLLBACK=true` for slide 15.

## Preview

`preview/slide-01.png` … `slide-20.png` — rendered at 1600×900 for layout checking.
Regenerate after edits if you want a fresh set.
