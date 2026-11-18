import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { build } from 'esbuild'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const image = { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=' }
const assistant = { kind: 'message', recordId: 'a', text: 'Answer', startedAt: 0, raw: { message: { content: [{ type: 'thinking', thinking: 'exact reasoning\n' }, { type: 'text', text: 'Before image\n\n```js\nconst x = 1\n```' }, image, { type: 'text', text: 'After image' }], usage: { input: 0, output: 5, cacheRead: 0, cacheWrite: 2, reasoning: 0, totalTokens: 7 } } } }
const tool = { kind: 'tool', recordId: 't', callId: 't', toolName: 'bash', text: 'bash', inputDetail: '{"command":"echo hello"}', outputDetail: 'head\n' + 'middle '.repeat(3000) + '\ntail', raw: { call: { arguments: { command: 'echo hello' } }, result: {} } }
const records = [{ cell: { kind: 'message', recordId: 'earlier', input: 3, output: 2, cacheRead: 4 }, assistantId: 'earlier' }, { cell: assistant, assistantId: 'a' }, { cell: tool, assistantId: 'a' }, { cell: { kind: 'message', recordId: 'later', input: 999 }, assistantId: 'later' }]

const ssr = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const detail = await ssr.ssrLoadModule('/src/components/Detail.jsx')
const tree = await ssr.ssrLoadModule('/src/components/JsonTree.jsx')
test.after(() => ssr.close())
const render = (cell, extra = {}) => renderToStaticMarkup(React.createElement(detail.Detail, { cell, records, onClose() {}, onNavigate() {}, ...extra }))

test('tool overview retains bounded head/tail output and SSR controls', () => {
  const html = render(tool)
  assert.match(html, /Output · 3 lines/)
  assert.match(html, /Show full/)
  assert.match(html, /hidden from view/)
  assert.match(html, /head/)
  assert.match(html, /tail/)
  assert.doesNotMatch(html, new RegExp('middle '.repeat(2000)))
  assert.match(html, /Arguments/)
  assert.match(html, /Copy JSON/)
  assert.match(html, /Parent assistant/)
  assert.match(html, /role="tab"[^>]*>Timing/)
})

test('messages preserve embedded image ordering, collapse thinking, and provide code copy', () => {
  const html = render(assistant)
  assert.match(html, /aria-expanded="true"[^>]*>.*Thinking/)
  assert.match(html, /exact reasoning/)
  assert.ok(html.indexOf('Before image') < html.indexOf('src="data:image/png;base64,'))
  assert.ok(html.indexOf('src="data:image/png;base64,') < html.indexOf('After image'))
  assert.match(html, /Copy code/)
  assert.match(html, /Tool calls \(1\)/)
  assert.match(html, /<dt>Input<\/dt><dd>0<\/dd>/)
  assert.match(html, /<dt>Cache read<\/dt><dd>0<\/dd>/)
  assert.match(html, /Before this record/)
  assert.doesNotMatch(html, />999</)
})

test('usage counts recorded zeros and only the preceding record prefix', () => {
  assert.deepEqual(detail.usageOf(assistant), { input: 0, output: 5, think: 0, cacheRead: 0, cacheWrite: 2, totalTokens: 7 })
  assert.deepEqual(detail.cumulativeUsage(assistant, records), { input: 3, output: 2, cacheRead: 4 })
  assert.deepEqual(detail.cumulativeUsage(tool, records), { input: 3, output: 7, cacheRead: 4, think: 0, cacheWrite: 2, totalTokens: 7 })
  assert.equal(detail.cumulativeUsage({ recordId: 'missing' }, records), null)
  assert.deepEqual(detail.cumulativeUsage(records[0].cell, records), {})
})

test('source blocks decode Pi image payloads and retain missing-reference explanations', () => {
  const cell = { kind: 'user', text: 'attachments', sourceBlocks: [{ type: 'text', content: JSON.stringify({ type: 'text', text: 'first' }) }, { type: 'image', content: JSON.stringify(image) }, { type: 'text', content: JSON.stringify({ type: 'text', text: 'last' }) }, { type: 'image', content: JSON.stringify({ type: 'image', path: 'missing.png' }) }] }
  assert.deepEqual(detail.contentBlocks(cell).slice(0, 3), [{ type: 'text', text: 'first' }, image, { type: 'text', text: 'last' }])
  const html = render(cell)
  assert.match(html, /Image reference: embedded image data/)
  assert.match(html, /missing.png/)
  assert.equal(detail.embeddedImageSource({ ...image, mimeType: 'text/html' }), null)
  assert.equal(detail.embeddedImageSource({ ...image, data: 'https://example.com/image' }), null)
  assert.doesNotMatch(render({ kind: 'message', outputDetail: '![remote](https://example.com/image.png)' }), /<img/)
})

test('JSON paths escape keys and tree exposes copy operations without expanding nested objects', () => {
  assert.equal(tree.jsonPath('$', 'a.b'), '$["a.b"]')
  assert.equal(tree.jsonPath('$.items', '0', true), '$.items[0]')
  const html = renderToStaticMarkup(React.createElement(tree.JsonTree, { value: { 'a.b': { secret: 'nested' }, zero: 0, empty: null, long: 'x'.repeat(1800) } }))
  assert.match(html, /Copy value at/)
  assert.match(html, /Copy path/)
  assert.match(html, /Show full string/)
  assert.match(html, /data-wrap="true"/)
  assert.doesNotMatch(html, /nested/)
})

test('tabs match record kinds, navigate with arrows, and wrap at either end', () => {
  const tabs = detail.detailTabs('tool')
  assert.deepEqual(tabs, ['overview', 'input', 'output', 'timing', 'raw'])
  assert.deepEqual(detail.detailTabs('message'), ['overview', 'preview', 'raw'])
  assert.deepEqual(detail.detailTabs('compacted'), ['overview', 'raw'])
  assert.equal(detail.tabForKey(tabs, 'overview', 'ArrowLeft'), 'raw')
  assert.equal(detail.tabForKey(tabs, 'raw', 'ArrowRight'), 'overview')
  assert.equal(detail.tabForKey(tabs, 'input', 'Home'), 'overview')
  assert.equal(detail.tabForKey(tabs, 'input', 'End'), 'raw')
  assert.equal(detail.tabForKey(tabs, 'input', 'Escape'), null)
})

test('missing tool inputs/results and orphan parent remain explicit', () => {
  const html = render({ kind: 'tool', recordId: 'orphan', text: 'read', raw: {} })
  assert.match(html, /No arguments recorded/)
  assert.match(html, /does not contain a result/)
  assert.match(html, /No parent assistant record/)
  assert.deepEqual(detail.contentBlocks({ kind: 'tool', inputDetail: 'private input', raw: { result: {} } }), [])
  assert.deepEqual(detail.contentBlocks({ kind: 'tool', sourceBlocks: [{ type: 'image', content: JSON.stringify(image) }] }), [image])
  assert.match(render({ kind: 'tool', raw: { call: { arguments: null }, result: {} } }), /json-null/)
})

async function chromeExecutable() {
  for (const candidate of [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    try { await access(candidate); return candidate } catch { /* Try the next installed browser. */ }
  }
  return null
}

async function retry(fn, timeout = 15000) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    try { const value = await fn(); if (value) return value } catch (error) { last = error }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw last ?? new Error('Timed out waiting for browser')
}

async function connectCdp(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const job = pending.get(message.id)
    if (!job) return
    pending.delete(message.id)
    clearTimeout(job.timer)
    if (message.error) job.reject(new Error(message.error.message))
    else job.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method} ${params.expression ?? ''}`)) }, 10000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { close: () => socket.close(), send, evaluate: async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  } }
}

test('browser interactions preserve tabs, copy exact values, navigate and reveal content', { timeout: 60000 }, async (t) => {
  const executable = await chromeExecutable()
  if (!executable) return t.skip('Chrome is not installed. SSR and pure behavior checks still run.')
  const fixtureModule = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom'; import {Detail} from './src/components/Detail.jsx';
    const root=createRoot(document.getElementById('root'));
    window.renderDetail=(cell,records)=>flushSync(()=>root.render(React.createElement(Detail,{cell,records,onNavigate:cell=>window.navigated=cell.recordId,onClose:()=>window.detailClosed=true})));
    window.copied=[]; Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.copied.push(value)}});
    window.ready=true;`
  const bundle = await build({ stdin: { contents: fixtureModule, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', loader: { '.css': 'empty', '.module.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } })
  const profile = await mkdtemp(join(tmpdir(), 'pi-detail-browser-'))
  let chrome
  let cdp
  try {
    chrome = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
    const port = await retry(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0])
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    cdp = await connectCdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
    await cdp.evaluate('document.body.innerHTML = \'<div id="root"></div>\'')
    await cdp.evaluate(bundle.outputFiles[0].text)
    assert.equal(await cdp.evaluate('window.ready'), true)
    const evaluate = cdp.evaluate
    const renderCell = (cell) => evaluate(`window.renderDetail(${JSON.stringify(cell)},${JSON.stringify(records)})`)
    const click = async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await evaluate('new Promise(resolve=>requestAnimationFrame(resolve))') }
    const selectedTab = () => evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')
    await renderCell(tool)
    await click('[role="tab"]:last-child')
    assert.equal(await selectedTab(), 'Raw')
    await renderCell(assistant)
    assert.equal(await selectedTab(), 'Raw')
    await evaluate('document.querySelector("[role=tab][aria-selected=true]").dispatchEvent(new KeyboardEvent("keydown",{key:"Home",bubbles:true}))')
    await evaluate('new Promise(resolve=>requestAnimationFrame(resolve))')
    assert.equal(await selectedTab(), 'Overview')
    assert.equal(await evaluate('document.activeElement.textContent'), 'Overview')
    await click('.detail-thinking-toggle')
    assert.doesNotMatch(await evaluate('document.querySelector("[role=tabpanel]").textContent'), /exact reasoning/)
    await click('.detail-thinking-toggle')
    assert.match(await evaluate('document.querySelector("[role=tabpanel]").textContent'), /exact reasoning/)
    await click('[title="Copy thinking"]')
    assert.equal(await evaluate('window.copied.at(-1)'), 'exact reasoning\n')
    await click('[title="Copy code"]')
    assert.equal(await evaluate('window.copied.at(-1)'), 'const x = 1\n')
    await click('.detail-call-list button')
    assert.equal(await evaluate('window.navigated'), 't')
    await click('[aria-label="Show Unix timestamp"]')
    assert.match(await evaluate('document.querySelector(".detail-metadata").textContent'), /0.000 Unix seconds/)
    await renderCell(tool)
    await click('.detail-navigate')
    assert.equal(await evaluate('window.navigated'), 'a')
    await click('[role="tab"]:nth-child(3)')
    assert.equal(await selectedTab(), 'Output')
    await click('[title="Copy output"]')
    assert.equal(await evaluate('window.copied.at(-1)'), tool.outputDetail)
    await click('.output-action-primary')
    assert.equal(await evaluate('document.querySelector(".long-output-content").textContent'), tool.outputDetail)
    await renderCell({ ...tool, recordId: 't2', outputDetail: '{"a.b":{"items":[0,false]},"long":"hello"}' })
    assert.equal(await selectedTab(), 'Output')
    await click('[aria-label=\'Expand $["a.b"]\']')
    await click('[aria-label=\'Copy path $["a.b"]\']')
    assert.equal(await evaluate('window.copied.at(-1)'), '$["a.b"]')
    await click('[aria-label=\'Copy value at $.long\']')
    assert.equal(await evaluate('window.copied.at(-1)'), 'hello')
    await click('[aria-label=\'Copy JSON at $["a.b"]\']')
    assert.equal(await evaluate('window.copied.at(-1)'), JSON.stringify({ items: [0, false] }, null, 2))
    await renderCell(assistant)
    assert.equal(await selectedTab(), 'Overview')
    await renderCell({ kind: 'tool', recordId: 'no-time', text: 'read', raw: {} })
    await click('[role="tab"]:nth-child(4)')
    assert.match(await evaluate('document.querySelector("[role=tabpanel]").textContent'), /No duration timing was recorded/)
    await evaluate('document.querySelector("aside").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))')
    assert.equal(await evaluate('window.detailClosed'), true)
  } finally {
    cdp?.close()
    if (chrome && chrome.exitCode === null) { const exited = once(chrome, 'exit'); chrome.kill('SIGKILL'); await exited }
    await rm(profile, { recursive: true, force: true })
  }
})
