/**
 * Locates phrases in a PDF and reports which page each lands on, so the
 * screenshot tool can target the right page and crop.
 *
 *   node tools/find-pdf-page.mjs /tmp/localfirst.pdf "primary copy" "No spinners"
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(process.cwd() + `/x.js`)
// 3.x ships CJS at legacy/build/pdf.js (no .mjs) — resolve from the deck dir
const pdfjs = require(`pdfjs-dist/legacy/build/pdf.js`)

const [file, ...needles] = process.argv.slice(2)
const data = new Uint8Array(readFileSync(file))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise

console.log(`pages: ${doc.numPages}`)

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const text = (await page.getTextContent()).items
    .map((i) => i.str)
    .join(` `)
    .replace(/\s+/g, ` `)
  for (const needle of needles) {
    const at = text.toLowerCase().indexOf(needle.toLowerCase())
    if (at !== -1) {
      const excerpt = text.slice(Math.max(0, at - 90), at + 160)
      console.log(`\npage ${n}  ← "${needle}"`)
      console.log(`  …${excerpt}…`)
    }
  }
}
