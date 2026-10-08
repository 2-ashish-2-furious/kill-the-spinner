/**
 * Renders a page of a PDF to a PNG and highlights real phrases in it, by
 * matching against pdf.js's text layer — so the highlight sits on the actual
 * words rather than a hand-placed box.
 *
 *   node tools/render-paper-shot.mjs
 *
 * Output: public/img/paper-primary-copy.png
 *
 * Everything is served to the browser via Playwright route interception, so
 * nothing temporary is written into the project.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const deck = resolve(here, `..`)
const require = createRequire(deck + `/x.js`)
const { chromium } = require(`/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright/index.js`)
const CHROME =
  `/Users/hyashish/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`

const PDF = process.env.PAPER_PDF || `/tmp/localfirst.pdf`


// The seven ideals are section headings spread across pages 2–8, so each one is
// cropped from the page it actually appears on.
const IDEALS = [
  { n: 1, page: 2, text: `No Spinners: Your Work at Your Fingertips` },
  { n: 2, page: 3, text: `Your Work Is Not Trapped on One Device` },
  { n: 3, page: 3, text: `The Network Is Optional` },
  { n: 4, page: 4, text: `Seamless Collaboration with Your Colleagues` },
  { n: 5, page: 7, text: `The Long Now` },
  { n: 6, page: 7, text: `Security and Privacy by Default` },
  { n: 7, page: 8, text: `You Retain Ultimate Ownership and Control` },
].map((i) => ({
  out: `ideal-${i.n}.png`,
  page: i.page,
  scale: 4,
  highlight: [i.text],
  // tight strip: the left pad picks up the "2.n" section number
  // one text column wide, one line tall: identical geometry for all seven, and
  // no bleed from the neighbouring column
  cropPad: { left: 3, right: 0, top: 9, bottom: 2 },
  fixedWidth: 252,
  tightMatch: true,
}))

const FINDINGS = [
  {
    // §4.2.4 Findings, p18 — the fair half
    out: `finding-works.png`,
    page: 18,
    scale: 4,
    highlight: [`CRDT technology works.`],
    cropPad: { left: 3, right: 0, top: 3, bottom: 3 },
    fixedWidth: 252,
    tightMatch: true,
  },
  {
    // p19 — the cost of keeping all history
    out: `finding-history.png`,
    page: 19,
    scale: 4,
    // phrase chosen to start and end on line boundaries, so tightMatch can
    // reject the neighbouring lines instead of bleeding into them
    highlight: [
      `memory/disk usage quickly became a problem because CRDTs store all history, including character-by-character text edits.`,
    ],
    cropPad: { left: 3, right: 0, top: -2, bottom: 3 },
    fixedWidth: 252,
    tightMatch: true,
  },
  {
    // p20 — the part CRDTs never claimed to solve
    out: `finding-network.png`,
    page: 20,
    scale: 4,
    highlight: [`Network communication remains an unsolved`],
    cropPad: { left: 3, right: 0, top: 3, bottom: 3 },
    fixedWidth: 252,
    tightMatch: true,

  },
]

const FINDING_PAGES = [
  {
    out: `page-works.png`,
    page: 18,
    scale: 4,
    highlight: [`CRDT technology works.`],
    tightMatch: true,
    strong: true,
    trim: 16,
  },
  {
    out: `page-history.png`,
    page: 19,
    scale: 4,
    highlight: [
      `memory/disk usage quickly became a problem because CRDTs store all history, including character-by-character text edits.`,
    ],
    tightMatch: true,
    strong: true,
    trim: 16,
  },
  {
    out: `page-network.png`,
    page: 20,
    scale: 4,
    highlight: [`Network communication remains an unsolved`],
    tightMatch: true,
    strong: true,
    trim: 16,
  },
]

const SHOTS = [
  {
    // the paper announcing the list — the provenance anchor for S7
    out: `ideals-intro.png`,
    page: 2,
    scale: 4,
    highlight: [`Here are seven ideals to strive for in local-first software.`],
    // tight to the single highlighted line, or the tail of the line above bleeds in
    cropPad: { left: 3, right: 0, top: -2, bottom: 3 },
    fixedWidth: 252,
    tightMatch: true,
  },
  {
    // the title page, rendered at high DPI so it stays sharp on retina
    // the whole title page at high DPI, heading highlighted. Rendered at 5x so
    // it stays crisp even though the body text is decorative at slide size.
    out: `paper-title.png`,
    page: 1,
    scale: 5,
    highlight: [
      `Local-First Software:`,
      `You Own Your Data, in spite of the Cloud`,
    ],
    trim: 16,
  },
  {
    out: `paper-primary-copy.png`,
    page: 2,
    // phrases to highlight, matched against the rendered text layer
    highlight: [
      `treat the copy of the data on your local device`,
      `as the primary copy`,
    ],
    // asymmetric crop padding in pdf points: keep the neighbouring column out
    // on the left, and end on a full line at the bottom
    cropPad: { left: 6, right: 16, top: 47, bottom: 40 },
  },
  ...IDEALS,
  ...FINDINGS,
  ...FINDING_PAGES,
]

const pdfLib = readFileSync(
  require.resolve(`pdfjs-dist/build/pdf.min.js`)
)
const pdfWorker = readFileSync(
  require.resolve(`pdfjs-dist/build/pdf.worker.min.js`)
)
const pdfBytes = readFileSync(PDF)

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  #wrap{position:relative;display:inline-block}
  canvas{display:block}
  .hl{position:absolute;background:rgba(255,214,0,.34);
      box-shadow:0 0 0 2px rgba(255,193,7,.55);border-radius:2px;pointer-events:none}
  .hl.strong{background:rgba(255,196,0,.52);
      box-shadow:0 0 0 5px rgba(255,150,0,.85);border-radius:1px}
</style></head><body>
<div id="wrap"><canvas id="c"></canvas></div>
<script src="/pdf.min.js"></script>
<script>
window.renderSvg = async (pageNum, phrases, scale) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  // the SVG backend embeds glyphs, so it needs the raw font data
  const doc = await pdfjsLib.getDocument({
    url: '/paper.pdf',
    fontExtraProperties: true,
  }).promise
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale })
  const opList = await page.getOperatorList()
  const gfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs)
  gfx.embedFonts = true
  const svg = await gfx.getSVG(opList, vp)

  // vector highlights, placed from the text layer in the same coordinate space
  const tc = await page.getTextContent()
  let flat = ''
  const spans = []
  for (const it of tc.items) {
    if (!it.str) continue
    const start = flat.length
    flat += it.str + ' '
    const t = pdfjsLib.Util.transform(vp.transform, it.transform)
    const h = Math.hypot(t[2], t[3])
    spans.push({ start, end: flat.length, x: t[4], y: t[5] - h, w: it.width * scale, h })
  }
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ')
  const flatN = norm(flat)
  const NS = 'http://www.w3.org/2000/svg'
  const layer = document.createElementNS(NS, 'g')
  let found = 0
  for (const phrase of phrases) {
    const at = flatN.indexOf(norm(phrase))
    if (at === -1) { console.warn('phrase not found: ' + phrase); continue }
    const to = at + norm(phrase).length
    for (const s of spans) {
      if (s.end <= at || s.start >= to) continue
      const r = document.createElementNS(NS, 'rect')
      r.setAttribute('x', s.x - 1)
      r.setAttribute('y', s.y - 1)
      r.setAttribute('width', s.w + 2)
      r.setAttribute('height', s.h + 2)
      r.setAttribute('rx', '2')
      r.setAttribute('fill', 'rgba(255,214,0,0.34)')
      r.setAttribute('stroke', 'rgba(255,193,7,0.55)')
      r.setAttribute('stroke-width', '1.5')
      layer.appendChild(r)
      found++
    }
  }
  svg.appendChild(layer)
  svg.setAttribute('viewBox', '0 0 ' + vp.width + ' ' + vp.height)
  svg.setAttribute('width', String(Math.round(vp.width)))
  svg.setAttribute('height', String(Math.round(vp.height)))
  return { svg: new XMLSerializer().serializeToString(svg), found }
}

window.pageSize = async (pageNum, scale) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  const doc = await pdfjsLib.getDocument({ url: '/paper.pdf' }).promise
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale })
  return { width: Math.ceil(vp.width), height: Math.ceil(vp.height) }
}

window.render = async (pageNum, phrases, scale, tight, strong) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  const doc = await pdfjsLib.getDocument({ url: '/paper.pdf' }).promise
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale })
  const c = document.getElementById('c')
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height)
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise

  // Walk the text layer, accumulate a flat string with per-item offsets,
  // then map each phrase back onto the item rectangles that contain it.
  const tc = await page.getTextContent()
  let flat = ''
  const spans = []
  for (const it of tc.items) {
    if (!it.str) continue
    const start = flat.length
    flat += it.str + ' '
    const t = pdfjsLib.Util.transform(vp.transform, it.transform)
    const h = Math.hypot(t[2], t[3])
    spans.push({ start, end: flat.length, text: it.str, x: t[4], y: t[5] - h, w: it.width * scale, h })
  }

  const norm = s => s.toLowerCase().replace(/\\s+/g, ' ')
  const flatN = norm(flat)
  const wrap = document.getElementById('wrap')
  // The page is reused across shots, so drop the previous shot's boxes —
  // otherwise they accumulate and show up all over a full-page render.
  wrap.querySelectorAll('.hl').forEach(el => el.remove())
  const boxes = []
  const matched = []
  for (const phrase of phrases) {
    const pN = norm(phrase)
    const at = flatN.indexOf(pN)
    if (at === -1) { console.warn('phrase not found: ' + phrase); continue }
    const to = at + pN.length
    for (const s of spans) {
      if (s.end <= at || s.start >= to) continue
      // Text items are line-chunked, so pure offset overlap also catches the
      // line before a heading. Keep a span only if its own text belongs to the
      // phrase — allowing section numbers ("2.1") and whitespace joiners.
      if (tight) {
        const own = norm(s.text).trim()
        const isSectionNo = /^\\d+(\\.\\d+)*$/.test(own)
        // Bidirectional: keep the span if its text belongs to the phrase (short
        // line items) OR the phrase belongs to its text (the phrase ends mid-line,
        // e.g. a run-in heading that continues into a hyphenated word).
        const related = pN.includes(own) || own.includes(pN)
        if (own.length && !isSectionNo && !related) continue
      }
      if (!norm(s.text).trim()) continue
      matched.push(s.text)
      const d = document.createElement('div')
      d.className = strong ? 'hl strong' : 'hl'
      d.style.left = (s.x - 1) + 'px'
      d.style.top = (s.y - 1) + 'px'
      d.style.width = (s.w + 2) + 'px'
      d.style.height = (s.h + 2) + 'px'
      wrap.appendChild(d)
      boxes.push({ x: s.x, y: s.y, w: s.w, h: s.h })
    }
  }
  return { width: c.width, height: c.height, boxes, found: boxes.length, matched }
}
</script></body></html>`

mkdirSync(resolve(deck, `public/img`), { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage({
  viewport: { width: 1400, height: 1800 },
  deviceScaleFactor: 1,
})

await page.route(`**/*`, (route) => {
  const url = route.request().url()
  if (url.endsWith(`/index.html`) || url.endsWith(`paper.local/`))
    return route.fulfill({ contentType: `text/html`, body: HTML })
  if (url.endsWith(`/pdf.min.js`))
    return route.fulfill({ contentType: `application/javascript`, body: pdfLib })
  if (url.endsWith(`/pdf.worker.min.js`))
    return route.fulfill({ contentType: `application/javascript`, body: pdfWorker })
  if (url.endsWith(`/paper.pdf`))
    return route.fulfill({ contentType: `application/pdf`, body: pdfBytes })
  return route.abort()
})

page.on(`console`, (m) => {
  if (m.type() === `warning` || m.type() === `error`) console.log(`  [page]`, m.text())
})

await page.goto(`http://paper.local/index.html`, { waitUntil: `load` })

for (const shot of SHOTS) {
  const SCALE = shot.scale ?? 2.2

  if (shot.svg) {
    const res = await page.evaluate(
      ([p, ph, sc]) => window.renderSvg(p, ph, sc),
      [shot.page, shot.highlight, 1]
    )
    if (!res.found) throw new Error(`no phrases matched on page ${shot.page}`)
    const out = resolve(deck, `public/img`, shot.out)
    writeFileSync(out, res.svg)
    const kb = Math.round(Buffer.byteLength(res.svg) / 1024)
    console.log(`✓ ${shot.out}  page ${shot.page}  ${res.found} highlights  vector  ${kb} KB`)
    continue
  }
  const size = await page.evaluate(
    ([p, sc]) => window.pageSize(p, sc),
    [shot.page, SCALE]
  )
  await page.setViewportSize({
    width: size.width + 40,
    height: Math.min(size.height + 40, 20000),
  })

  const info = await page.evaluate(
    ([p, ph, sc, tg, st]) => window.render(p, ph, sc, tg, st),
    [shot.page, shot.highlight, SCALE, !!shot.tightMatch, !!shot.strong]
  )
  if (process.env.DEBUG_MATCH) console.log(`   matched spans:`, JSON.stringify(info.matched))
  if (!info.found) throw new Error(`no phrases matched on page ${shot.page}`)

  if (shot.trim !== undefined) {
    const t = shot.trim * SCALE
    await page.screenshot({
      path: resolve(deck, `public/img`, shot.out),
      clip: {
        x: t,
        y: t,
        width: info.width - t * 2,
        height: info.height - t * 2,
      },
    })
    console.log(
      `✓ ${shot.out}  page ${shot.page}  ${info.found} highlight boxes  ` +
        `full page @${SCALE}x  ${Math.round(info.width - t * 2)}px wide`
    )
    continue
  }

  // crop tightly around the highlighted region
  const xs = info.boxes.map((b) => b.x)
  const ys = info.boxes.map((b) => b.y)
  const x2 = Math.max(...info.boxes.map((b) => b.x + b.w))
  const y2 = Math.max(...info.boxes.map((b) => b.y + b.h))
  const pad = shot.cropPad
  const clip = {
    x: Math.max(0, Math.min(...xs) - pad.left * SCALE),
    y: Math.max(0, Math.min(...ys) - pad.top * SCALE),
    width: 0,
    height: 0,
  }
  clip.width = shot.fixedWidth
    ? Math.min(info.width - clip.x, shot.fixedWidth * SCALE)
    : Math.min(info.width - clip.x, x2 - clip.x + pad.right * SCALE)
  clip.height = Math.min(info.height - clip.y, y2 - clip.y + pad.bottom * SCALE)

  await page.screenshot({ path: resolve(deck, `public/img`, shot.out), clip })
  console.log(
    `✓ ${shot.out}  page ${shot.page}  ${info.found} highlight boxes  ` +
      `clip ${Math.round(clip.width)}x${Math.round(clip.height)}`
  )
}

await browser.close()
