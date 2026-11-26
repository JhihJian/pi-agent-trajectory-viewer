import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePiJsonl } from '../src/lib/parser.js'
import { executionReport, filterTraceTurns, projectTraceTurns } from '../src/lib/trace-view.js'

const session = (messageRows) => [
  { type: 'session', id: 's', cwd: '/repo' },
  ...messageRows,
].map(JSON.stringify).join('\n')

const parse = (rows) => parsePiJsonl(session(rows))

test('trace projection lists ordered items with per-call status and duration', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'Fix the test' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', durationMs: 1200, content: [{ type: 'thinking', thinking: 'Plan' }, { type: 'text', text: 'Looking' }, { type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'src/a.js' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', timestamp: '2026-01-01T00:00:02Z', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', isError: true, durationMs: 400, content: [{ type: 'text', text: 'boom' }] } },
    { type: 'message', id: 'a2', parentId: 'r1', timestamp: '2026-01-01T00:00:03Z', message: { role: 'assistant', stopReason: 'error', content: [{ type: 'text', text: 'Gave up' }] } },
  ])
  const [traceTurn] = projectTraceTurns(turns)
  assert.equal(traceTurn.status, 'failed')
  assert.equal(traceTurn.steps, 2)
  assert.equal(traceTurn.calls, 1)
  assert.equal(traceTurn.errors, 1)
  assert.deepEqual(traceTurn.items.map((item) => item.kind), ['user', 'assistant', 'tool', 'assistant'])
  const tool = traceTurn.items[2]
  assert.equal(tool.summary.title, 'Read file')
  assert.equal(tool.summary.summary, 'src/a.js')
  assert.equal(tool.isError, true)
  assert.equal(tool.durationSeconds, 0.4)
  assert.equal(traceTurn.items[1].durationSeconds, 1.2)
  assert.equal(traceTurn.items[1].step, 1)
})

test('execution report is honest plain text covering turns, tools, subagents and errors', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Ship it' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', stopReason: 'toolUse', content: [{ type: 'text', text: 'Spawning checks' }, { type: 'toolCall', id: 'c1', name: 'subagent', arguments: { mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }, { agent: 'builder', task: 'npm run build' }] } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'subagent', details: { mode: 'parallel', results: [{ agent: 'tester', exitCode: 0, stopReason: 'stop' }, { agent: 'builder', exitCode: 1, stopReason: 'stop' }] }, content: [{ type: 'text', text: 'partial' }] } },
  ])
  const report = executionReport(turns, { id: 's', cwd: '/repo' })
  assert.match(report, /^Pi Agent execution report/)
  assert.match(report, /cwd: \/repo/)
  assert.match(report, /Turn 1 \[running\] · 1 steps · 1 tool calls/)
  assert.match(report, /user: Ship it/)
  assert.match(report, /tool subagent -> ok/)
  assert.match(report, /subagents partial: 2 requested, 2 returned \(coverage 100%\)/)
})

test('report marks errored tool output and unreachable results distinctly', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'go' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'npm test' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'bash', isError: true, content: [{ type: 'text', text: '2 tests failed' }] } },
  ])
  const report = executionReport(turns)
  assert.match(report, /tool bash · npm test -> error/)
  assert.match(report, /error: 2 tests failed/)
})

test('the trace filter keeps turns with matching items and empty query is identity', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Check the timeline' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'text', text: 'Reading' }, { type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'src/lib/timeline.js' } }] } },
  ])
  const traceTurns = projectTraceTurns(turns)
  assert.equal(filterTraceTurns(traceTurns, 'timeline').at(0).items.length, 2)
  assert.deepEqual(filterTraceTurns(traceTurns, 'nothing'), [])
  assert.equal(filterTraceTurns(traceTurns, ''), traceTurns)
})

test('a tool-only assistant step carries the tool count for its summary', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'go' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'a.js' } }, { type: 'toolCall', id: 'c2', name: 'bash', arguments: { command: 'ls' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: 'a' }] } },
    { type: 'message', id: 'r2', parentId: 'r1', message: { role: 'toolResult', toolCallId: 'c2', toolName: 'bash', content: [{ type: 'text', text: 'b' }] } },
    { type: 'message', id: 'a2', parentId: 'r2', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } },
  ])
  const [traceTurn] = projectTraceTurns(turns)
  const assistants = traceTurn.items.filter((item) => item.kind === 'assistant')
  assert.deepEqual(assistants.map((item) => [item.text, item.toolCount]), [['', 2], ['done', 0]])
})
