// Smoke test: open the TrajectoryViewer demo, switch through the new views
// and screenshot each one. Run: node scripts/smoke-views.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
mkdirSync('tmp', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(`${base}/#/components/trajectory-viewer`)
await page.waitForSelector('.trajectory-shell', { timeout: 20000 })
await page.waitForTimeout(600)

for (const name of ['Reading', 'Trace', 'Diagnostic']) {
  await page.click(`.trajectory-views button:has-text("${name}")`)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `tmp/view-${name.toLowerCase()}.png` })
  console.log(`captured ${name}`)
}
await browser.close()
