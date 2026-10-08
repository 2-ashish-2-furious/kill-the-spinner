/**
 * Screenshots slides from the running dev server and reports whether the
 * content overflows the 900px slide box.
 *
 *   node tools/shoot.mjs 9            # one slide
 *   node tools/shoot.mjs 9 10 11      # several
 *   SETTLE=6000 node tools/shoot.mjs 8   # wait for timed animations
 *
 * Output: preview/slide-NN.png at 2x DPR.
 */

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const deck = resolve(here, `..`)
const require = createRequire(deck + `/x.js`)
const { chromium } = require(`/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright/index.js`)
const CHROME =
  `/Users/hyashish/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`

const BASE = process.env.BASE || `http://localhost:3030`
const SETTLE = Number(process.env.SETTLE || 1400)
const slides = process.argv.slice(2).map(Number)
if (!slides.length) {
  console.error(`usage: node tools/shoot.mjs <slide-number> [...]`)
  process.exit(1)
}

mkdirSync(resolve(deck, `preview`), { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
})

for (const n of slides) {
  await page.goto(`${BASE}/${n}`, { waitUntil: `networkidle` })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(SETTLE)

  // Measure real content extents against the 900px slide box. Overflow shows up
  // as content above the top edge (Slidev centres, so it crops both ends) or
  // below the bottom.
  const fit = await page.evaluate(() => {
    const root = document.querySelector(`#slide-content`)
    if (!root) return null
    const rb = root.getBoundingClientRect()
    const H = Math.round(rb.height)
    const W = Math.round(rb.width)
    const top0 = rb.top
    let min = Infinity
    let max = -Infinity
    for (const el of root.querySelectorAll(`*`)) {
      const r = el.getBoundingClientRect()
      if (!r.height || !r.width) continue
      // Skip full-bleed containers (the layout wrappers and Slidev's drawing
      // SVG all span the canvas, so they'd pin the answer at 0…H).
      if (r.width >= W - 1 && r.height >= H - 1) continue
      min = Math.min(min, r.top - top0)
      max = Math.max(max, r.bottom - top0)
    }
    return { slideHeight: H, top: Math.round(min), bottom: Math.round(max) }
  })

  const out = resolve(deck, `preview`, `slide-${String(n).padStart(2, `0`)}.png`)
  await page.screenshot({ path: out })
  const over = fit && (fit.bottom > fit.slideHeight + 1 || fit.top < -1)
  console.log(
    `${over ? `✗` : `✓`} slide ${n}  ` +
      (fit ? `content ${fit.top}…${fit.bottom} of ${fit.slideHeight}px` : `no fit data`) +
      (over ? `  ← OVERFLOWS` : ``)
  )
}

await browser.close()
