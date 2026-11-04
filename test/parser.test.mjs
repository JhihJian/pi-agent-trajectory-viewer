import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePiJsonl } from '../src/parser.js'

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
})

test('rejects malformed or non-Pi JSONL', () => {
  assert.throws(() => parsePiJsonl('{"type":"message"}'), /缺少 type=session/)
  assert.throws(() => parsePiJsonl('{'), /不是有效 JSON/)
})
