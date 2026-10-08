/**
 * Renders the slide-4 code screenshots from the REAL source files in this repo,
 * using the deck's own Shiki theme, palette and vendored fonts so they match.
 *
 *   node tools/render-code-shots.mjs
 *
 * Output: public/img/before-toggle.png, public/img/after-toggle.png
 *
 * Highlighting policy (see the talk doc): mark only the lines that carry the
 * argument, dim everything else. Two marks on the before shot (the two awaits),
 * one on the after shot (the collection call).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const deck = resolve(here, `..`)
const repo = resolve(deck, `../..`)

const require = createRequire(import.meta.url)
const shikiPath = resolve(
  deck,
  `node_modules/.pnpm/shiki@4.4.3/node_modules/shiki/dist/index.mjs`
)
const { codeToHtml } = await import(shikiPath)

const chromium = (() => {
  const pw = require(`/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright/index.js`)
  return pw.chromium
})()
const CHROME =
  `/Users/hyashish/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`

/** Pull an inclusive 1-indexed line range out of a source file. */
function slice(relPath, from, to) {
  const all = readFileSync(resolve(repo, relPath), `utf8`).split(`\n`)
  return { code: all.slice(from - 1, to).join(`\n`), from }
}

const SHOTS = [
  {
    // THE READ PATH, before: a request/response fetch the UI has to wait for,
    // with an isLoading flag flipped on either side of it.
    out: `before-read.png`,
    file: `src/routes/_authenticated/demo-before/$projectId.tsx`,
    from: 95,
    to: 116,
    badge: `isLoading`,
    badgeKind: `bad`,
    hot: [96, 101, 116],
    marks: { 96: `spinner on`, 116: `spinner off` },
    elide: [
      97, 98, 99, 100, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
      113, 114, 115,
    ],
  },
  {
    // THE READ PATH, after: a live query over the local replica. No flag,
    // no fetch, no branch.
    out: `after-read.png`,
    file: `src/routes/_authenticated/demo-large.tsx`,
    from: 95,
    to: 109,
    badge: `no loading state`,
    badgeKind: `good`,
    hot: [95, 98],
    marks: { 95: `live query` },
    elide: [99, 100, 101, 102, 103, 104, 105, 106, 107, 108],
  },
  {
    // WALL 1 (S11): the whole authorization decision for a shape, in one function.
    // Session check, server-side project resolution, fail-closed, then the filter
    // that IS the perimeter.
    out: `wall1-authz.png`,
    file: `src/routes/api/demo-issues.ts`,
    from: 40,
    to: 64,
    width: 1100,
    fontSize: 19,
    badge: `the security perimeter`,
    badgeKind: `warn`,
    hot: [48, 49, 60, 62, 63],
    marks: {
      48: `server-side`,
      60: `fail closed`,
      62: `the perimeter`,
    },
    // drop the drizzle plumbing, keep the two lines that name the session
    elide: [42, 43, 44, 45, 50, 51, 52, 53, 54],
  },
  {
    // WALL 2 (S12): the entire data-loading decision is one config line.
    out: `wall2-syncmode.png`,
    file: `src/lib/demo-collections.ts`,
    from: 50,
    to: 55,
    width: 780,
    fontSize: 19,
    badge: `the data-loading decision`,
    badgeKind: `warn`,
    hot: [55],
    marks: { 55: `one line` },
    // the ---- banner comment is decoration, not argument
    elide: [53, 54],
  },
  {
    // WALL 3 (S13): what ISN'T here is the point — no version, no compare-and-swap,
    // no updated_at guard. The write just lands.
    out: `wall3-lww.png`,
    file: `src/lib/trpc/demo-issues.ts`,
    from: 61,
    to: 72,
    width: 820,
    fontSize: 19,
    badge: `last write wins`,
    badgeKind: `warn`,
    hot: [64, 65],
    marks: { 65: `no version check` },
    elide: [66, 67, 68, 69, 70, 71],
  },
]

const FONT_DIR = resolve(deck, `public/fonts`)
const FONT_CSS = `
@font-face{font-family:'JetBrains Mono';src:url('file://${FONT_DIR}/jetbrains-mono-normal.woff2') format('woff2');font-weight:400 700;font-display:block}
@font-face{font-family:'Inter';src:url('file://${FONT_DIR}/inter-normal.woff2') format('woff2');font-weight:400 700;font-display:block}
`

function panel(shot, highlightedHtml) {
  // Shiki emits one <span class="line"> per line; wrap each with a gutter,
  // dim the cold ones, and hang a margin label off the marked ones.
  let n = shot.from - 1
  let prevElided = false
  const withGutters = highlightedHtml.replace(
    /<span class="line">([\s\S]*?)<\/span>(?=\n|<\/code>)/g,
    (_m, inner) => {
      n += 1
      if (shot.elide?.includes(n)) {
        return prevElided ? `` : ((prevElided = true), `<span class="row cold ellip"><span class="ln"></span><span class="code">⋯</span></span>`)
      }
      prevElided = false
      const hot = shot.hot.includes(n)
      const label = shot.marks[n]
      return (
        `<span class="row${hot ? ` hot` : ` cold`}${label ? ` has-mark` : ``}">` +
        `<span class="ln">${n}</span>` +
        `<span class="code">${inner}</span>` +
        (label
          ? `<span class="mark ${shot.badgeKind}">${label}</span>`
          : ``) +
        `</span>`
      )
    }
  )

  const compact = withGutters.replace(/\n/g, ``)

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONT_CSS}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:transparent;font-family:'JetBrains Mono',monospace}
  .panel{
    width:${shot.width ?? 820}px;background:#10141a;border:1px solid #232a32;border-radius:14px;
    overflow:hidden;
  }
  .bar{
    display:flex;align-items:center;justify-content:flex-start;gap:1rem;
    padding:14px 20px;background:#14181d;border-bottom:1px solid #232a32;
  }
  .path{font-size:14px;color:#9ba3ae;letter-spacing:0.01em}
  .path b{color:#e8eaed;font-weight:500}
  .badge{
    font-size:15px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
    padding:5px 12px;border-radius:6px;white-space:nowrap;
  }
  .badge.bad{color:#ff6b6b;background:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.45)}
  .badge.good{color:#4ade80;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.4)}
  .badge.warn{color:#ffb454;background:rgba(255,180,84,.1);border:1px solid rgba(255,180,84,.42)}
  pre{padding:16px 0 18px;font-size:${shot.fontSize ?? 19}px;line-height:1.7;background:transparent!important}
  pre code{background:transparent!important}
  .row{display:flex;align-items:flex-start;padding:0 20px;position:relative}
  .row.cold{opacity:.42}
  .row.hot{background:rgba(232,234,237,.035)}
  .ln{
    flex:none;width:46px;text-align:right;padding-right:18px;
    color:#6b747f;font-size:15px;user-select:none;
  }
  .row.hot .ln{color:#e8eaed}
  .code{white-space:pre;flex:1}
  .row.has-mark .code{padding-right:150px}
  .mark{
    position:absolute;right:18px;top:2px;font-size:15px;font-weight:700;
    letter-spacing:.09em;text-transform:uppercase;padding:2px 9px;border-radius:5px;
  }
  .mark.bad{color:#ff6b6b;background:rgba(255,107,107,.14);border:1px solid rgba(255,107,107,.5)}
  .mark.good{color:#4ade80;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.45)}
  .mark.warn{color:#ffb454;background:rgba(255,180,84,.12);border:1px solid rgba(255,180,84,.48)}
  </style></head><body>
  <div class="panel">
    <div class="bar">
      <div class="badge ${shot.badgeKind}">${shot.badge}</div>
    </div>
    ${compact}
  </div>
  </body></html>`
}

mkdirSync(resolve(deck, `public/img`), { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: CHROME })

for (const shot of SHOTS) {
  const { code } = slice(shot.file, shot.from, shot.to)
  const html = await codeToHtml(code, { lang: `tsx`, theme: `vitesse-dark` })
  const page = await browser.newPage({
    viewport: { width: (shot.width ?? 820) + 120, height: 900 },
    deviceScaleFactor: 3,
  })
  const tmp = resolve(deck, `public/img/.tmp-${shot.out}.html`)
  writeFileSync(tmp, panel(shot, html))
  await page.goto(`file://${tmp}`, { waitUntil: `load` })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const el = await page.$(`.panel`)
  await el.screenshot({
    path: resolve(deck, `public/img`, shot.out),
    omitBackground: true,
  })
  await page.close()
  console.log(`✓ ${shot.out}  ${shot.file}:${shot.from}-${shot.to}`)
}

await browser.close()
