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
