import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePiJsonl } from '../src/lib/parser.js'

test('parses a Pi session into turns, assistant output, and paired tool result', () => {
  const source = [
    { type: 'session', version: 3, id: 'session-1', cwd: '/tmp/demo' },
    { type: 'message', id: 'u1', parentId: 'session-1', timestamp: '2026-01-01T00:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Read the file' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Inspecting' }, { type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: 'README.md' } }], usage: { input: 10, output: 4, reasoning: 2 } } },
    { type: 'message', id: 'r1', parentId: 'a1', timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'read', content: [{ type: 'text', text: 'Hello' }], isError: false } },
  ].map(JSON.stringify).join('\n')
  const result = parsePiJsonl(source)
  assert.equal(result.stats.turns, 1)
  assert.equal(result.stats.tools, 1)
  const cells = result.turns[0].groups.flatMap((group) => group.cells)
  assert.equal(cells.find((cell) => cell.kind === 'user').text, 'Read the file')
  assert.equal(cells.find((cell) => cell.kind === 'message').think, 2)
  assert.equal(cells.find((cell) => cell.kind === 'tool').result, 'Hello')
  assert.equal(cells.find((cell) => cell.kind === 'tool').recordId, 'call-1')
  assert.deepEqual(cells.find((cell) => cell.kind === 'message').assistantMetrics, {
    timingRecorded: false, stepStartTime: null, firstTokenTime: null, completedTime: null,
    usageProvided: true, outputTokens: 4,
  })
})

test('assigns separate identities to multiple calls and preserves unavailable timing', () => {
  const source = [
    { type: 'session', id: 's' },
    { type: 'message', id: 'a', parentId: 's', timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', durationMs: 500, content: [
      { type: 'toolCall', id: 'c1', name: 'read', arguments: {} },
      { type: 'toolCall', id: 'c2', name: 'read', arguments: {} },
    ] } },
    { type: 'message', id: 'r', parentId: 'a', message: { role: 'toolResult', toolCallId: 'c2', content: [{ type: 'text', text: 'second' }] } },
  ].map(JSON.stringify).join('\n')
  const cells = parsePiJsonl(source).turns[0].groups[0].cells
  assert.deepEqual(cells.map((cell) => cell.recordId), ['a', 'c1', 'c2'])
  assert.equal(cells[2].result, 'second')
  assert.equal(cells[0].timeSeconds, 0.5)
  assert.equal(cells[0].assistantMetrics.firstTokenTime, null)
  assert.equal(cells[0].assistantMetrics.timingRecorded, false)
})

test('rejects malformed or non-Pi JSONL', () => {
  assert.throws(() => parsePiJsonl('{"type":"message"}'), /缺少 type=session/)
  assert.throws(() => parsePiJsonl('{'), /不是有效 JSON/)
})

test('invalid lines become diagnostics instead of aborting the session parse', () => {
  const source = [
    'not json at all',
    JSON.stringify({ type: 'session', id: 's' }),
    '{ broken',
    JSON.stringify({ type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'still parses' }] } }),
  ].join('\n')
  const result = parsePiJsonl(source)
  assert.deepEqual(result.diagnostics.map((diagnostic) => [diagnostic.lineNumber, diagnostic.code]), [[1, 'invalid_json'], [3, 'invalid_json']])
  assert.equal(result.diagnostics[0].preview, 'not json at all')
  assert.equal(result.stats.diagnostics, 2)
  assert.equal(result.stats.turns, 1)
  assert.equal(result.turns[0].groups[0].cells[0].text, 'still parses')
})

// ---------- 增量建 turn：尾端优先分页 ----------

import { createTurnBuilder } from '../src/lib/parser.js'

/** 一条 3 个 turn 的会话，turn 2 里有 toolCall → toolResult 配对，toolResult 是 1MB 大行。 */
function threeTurns() {
  const big = 'x'.repeat(1024 * 1024)
  return [
    { type: 'session', version: 3, id: 's', cwd: '/p' },
    { type: 'message', id: 'u1', parentId: 's', timestamp: '2026-01-01T00:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'q1' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'r1' }] } },
    { type: 'message', id: 'u2', parentId: 'a1', timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'user', content: [{ type: 'text', text: 'q2' }] } },
    { type: 'message', id: 'a2', parentId: 'u2', timestamp: '2026-01-01T00:00:03.000Z', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'f' } }] } },
    { type: 'message', id: 'r1', parentId: 'a2', timestamp: '2026-01-01T00:00:04.000Z', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: big }] } },
    { type: 'message', id: 'a3', parentId: 'r1', timestamp: '2026-01-01T00:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'r2' }] } },
    { type: 'message', id: 'u3', parentId: 'a3', timestamp: '2026-01-01T00:00:06.000Z', message: { role: 'user', content: [{ type: 'text', text: 'q3' }] } },
    { type: 'message', id: 'a4', parentId: 'u3', timestamp: '2026-01-01T00:00:07.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'r3' }] } },
  ]
}
// 每行的 turn 编号，与服务端索引器的口径一致：user 行开新 turn，头是 0
const TURNS = [0, 1, 1, 2, 2, 2, 2, 3, 3]

test('incremental: tail-first out-of-order push equals full parse', () => {
  const rows = threeTurns()
  const full = parsePiJsonl(rows.map(JSON.stringify).join('\n'))
  // 模拟服务端从尾向前切：片 3 = 行 6-8 (a3, u3, a4)，片 2 = 行 3-5 (u2, a2, r1)，片 1 = 行 0-2 (头, u1, a1)
  // 每片内还要按到达顺序 push，但片与片之间是倒序的
  const builder = createTurnBuilder(3)
  for (const i of [6, 7, 8]) if (rows[i].type !== 'session') builder.push(rows[i], TURNS[i], i)
  for (const i of [3, 4, 5]) builder.push(rows[i], TURNS[i], i)
  for (const i of [1, 2]) builder.push(rows[i], TURNS[i], i)
  const turns = builder.finish()
  // 对拍：与全量 parse 的 turns 深相等。recordId 依赖 index 计数器，乱序时不同，比对时抹掉。
  // index/sourceSeq：增量模式是 lineNo*1000+sub，全量是计数器，数值不同但相对顺序必须一致。
  const strip = (t) => JSON.parse(JSON.stringify(t, (k, v) => (k === 'recordId' && typeof v === 'string' && v.includes(':tool:') ? undefined : v)))
  const orderOf = (ts) => ts.flatMap((t) => t.groups.flatMap((g) => g.cells)).map((c) => c.index)
  const sortedCopy = (arr) => [...arr].sort((a, b) => a - b)
  assert.deepEqual(orderOf(turns), sortedCopy(orderOf(turns)), '增量模式下 index 按文件行号单调')
  const a = strip(turns), b = strip(full.turns)
  const stripIdx = (ts) => ts.map((t) => ({ ...t, groups: t.groups.map((g) => ({ ...g, cells: g.cells.map(({ index, sourceSeq, ...c }) => c) })) }))
  assert.deepEqual(stripIdx(a), stripIdx(b))
  assert.equal(turns.length, 3)
  assert.equal(turns[2].groups[0].cells[0].kind, 'user')
  // turn 2 的 tool cell 回填了 toolResult
  const tool = turns[1].groups.flatMap((g) => g.cells).find((c) => c.kind === 'tool')
  assert.equal(tool.callId, 'c1')
  assert.equal(tool.result.length, 1024 * 1024)
  assert.equal(tool.inputDetail, '{\n  "path": "f"\n}')
  assert.equal(tool.raw.assistant.id, 'a2')
  assert.equal(tool.raw.result.id, 'r1')
  // 没有孤儿 cell 残留
  assert.equal(turns.flatMap((t) => t.groups.flatMap((g) => g.cells)).filter((c) => c.kind === 'tool').length, 1)
})

test('incremental: turn split in the middle, tail half arrives first', () => {
  const rows = threeTurns()
  // 片 1 只有 a3（turn 2 的最后一行），片 2 是 u2, a2, r1
  const builder = createTurnBuilder(3)
  builder.push(rows[6], 2, 6)
  let turns = builder.finish()
  assert.equal(turns.length, 1, "只有 turn 2 有内容")
  assert.equal(turns[0].turn, 2)
  assert.equal(turns[0].groups[0].cells[0].kind, 'message')
  for (const i of [3, 4, 5]) builder.push(rows[i], TURNS[i], i)
  turns = builder.finish()
  assert.equal(turns.length, 1)
  assert.equal(turns[0].groups[0].title, 'User', 'user 行补到了最前面')
  assert.deepEqual(turns[0].groups.map((g) => g.title), ['User', 'Step 1', 'Step 2'])
  assert.deepEqual(turns[0].groups[1].cells.map((c) => c.kind), ['message', 'tool'], 'Step 1 = a2 + 回填的 tool')
  assert.equal(turns[0].groups[1].cells[1].result.length, 1024 * 1024)
  assert.equal(turns[0].groups[2].cells[0].text, 'r2')
})

test('incremental: orphan toolResult is adopted and its empty group removed', () => {
  const rows = threeTurns()
  const builder = createTurnBuilder(3)
  // r1 (toolResult) 先到
  builder.push(rows[5], 2, 5)
  let turns = builder.finish()
  assert.equal(turns[0].groups[0].cells[0].kind, 'tool', '孤儿先建成 tool cell')
  assert.equal(turns[0].groups[0].cells[0].raw.result.id, 'r1')
  assert.equal(turns[0].groups[0].cells[0].raw.assistant, undefined)
  // a2 (toolCall) 到
  builder.push(rows[4], 2, 4)
  turns = builder.finish()
  const cells = turns[0].groups.flatMap((g) => g.cells)
  assert.equal(cells.filter((c) => c.kind === 'tool').length, 1, '孤儿被合并，不重复')
  const tool = cells.find((c) => c.kind === 'tool')
  assert.equal(tool.raw.assistant.id, 'a2')
  assert.equal(tool.raw.call.id, 'c1')
  assert.equal(tool.raw.result.id, 'r1')
  assert.equal(tool.inputDetail, '{\n  "path": "f"\n}')
  // 孤儿原来所在的空 group 被删了
  assert.deepEqual(turns[0].groups.map((g) => g.title), ['Step 1'])
  assert.ok(turns[0].groups[0].cells.length === 2)
})

test('incremental: full mode without index still numbers turns sequentially', () => {
  const rows = threeTurns()
  const builder = createTurnBuilder(0)
  for (const [i, r] of rows.entries()) if (r.type !== 'session') builder.push(r)
  const turns = builder.finish()
  assert.deepEqual(turns.map((t) => t.turn), [1, 2, 3])
  const full = parsePiJsonl(rows.map(JSON.stringify).join('\n'))
  assert.deepEqual(turns, full.turns)
})
