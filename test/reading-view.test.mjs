import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePiJsonl } from '../src/lib/parser.js'
import { filterReadingTurns, projectReadingOutline, projectReadingTurns } from '../src/lib/reading-view.js'

const session = (messageRows) => [
  { type: 'session', id: 's' },
  ...messageRows,
].map(JSON.stringify).join('\n')

const parse = (rows) => parsePiJsonl(session(rows))

test('reading projection turns messages into user, assistant and tool cards', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Run the checks' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Plan' }, { type: 'text', text: 'Running checks' }, { type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'npm test' } }], usage: { input: 10, output: 4, reasoning: 2 } } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'bash', content: [{ type: 'text', text: 'ok' }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  assert.equal(readingTurn.status, 'complete')
  assert.deepEqual(readingTurn.cards.map((card) => card.kind), ['user', 'assistant', 'tool'])
  assert.equal(readingTurn.cards[1].text, 'Running checks')
  assert.equal(readingTurn.cards[1].thinking, 'Plan')
  assert.deepEqual(readingTurn.cards[1].usage, { input: 10, output: 4, think: 2 })
  assert.equal(readingTurn.cards[2].summary.title, 'Run verification')
  assert.equal(readingTurn.cards[2].hasResult, true)
})

test('skill instruction user messages become a context card plus the user request', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: '<skill name="release" location="/repo/SKILL.md">\nChecklist.\n</skill>\nCut a release.' }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  assert.deepEqual(readingTurn.cards.map((card) => card.kind), ['context', 'user'])
  const [skillCard, userCard] = readingTurn.cards
  assert.equal(skillCard.contextKind, 'skill-declaration')
  assert.equal(skillCard.skill.name, 'release')
  assert.equal(skillCard.instruction, 'Checklist.')
  assert.equal(userCard.text, 'Cut a release.')
})

test('compaction rows become context cards with their pi accounting', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } },
    { type: 'compaction', id: 'c1', parentId: 'u1', summary: 'Compacted.', tokensBefore: 48200, retainedTailCount: 6 },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  assert.equal(readingTurn.cards.at(-1).contextKind, 'compaction')
  assert.equal(readingTurn.cards.at(-1).compact.tokensBefore, 48200)
})

test('subagent tool cards carry the projected batch state', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'run' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', stopReason: 'toolUse', content: [{ type: 'text', text: 'spawning' }, { type: 'toolCall', id: 'c1', name: 'subagent', arguments: { mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }] } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'subagent', details: { mode: 'parallel', results: [{ agent: 'tester', exitCode: 0, stopReason: 'stop' }] }, content: [{ type: 'text', text: 'done' }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  const toolCard = readingTurn.cards.find((card) => card.kind === 'tool')
  assert.equal(toolCard.batch.status, 'succeeded')
  assert.equal(toolCard.batch.evidence.coverage, 1)
})

test('goal control prompts collapse into context cards', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Continue the active /goal until it is complete:\n\n<!-- pi-goal-continuation:0d3f8a60-8f5e-4d1a-9f21-2f6a9db79c01:4:0d3f8a60-8f5e-4d1a-9f21-2f6a9db79c02 -->' }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  assert.equal(readingTurn.cards.length, 1)
  assert.equal(readingTurn.cards[0].contextKind, 'goal')
  assert.equal(readingTurn.cards[0].goal.kind, 'continuation')
})

test('the filter keeps only turns with matching cards using multi-word AND', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Check the timeline tests' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'text', text: 'Reading the log' }, { type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'src/lib/timeline.js' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: 'timeline projection' }] } },
  ])
  const readingTurns = projectReadingTurns(turns)
  assert.equal(filterReadingTurns(readingTurns, 'timeline').at(0).cards.length, 2)
  assert.equal(filterReadingTurns(readingTurns, 'timeline projection').at(0).cards.length, 1)
  assert.deepEqual(filterReadingTurns(readingTurns, 'nomatch'), [])
  assert.equal(filterReadingTurns(readingTurns, ''), readingTurns)
})

test('the outline directory projects turn titles, context entries and subagent counts', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: '<skill name="release" location="/repo/SKILL.md">\nChecklist.\n</skill>\nCut a release.' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', stopReason: 'toolUse', content: [{ type: 'text', text: 'Spawning checks' }, { type: 'toolCall', id: 'c1', name: 'subagent', arguments: { mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }, { agent: 'builder', task: 'npm run build' }] } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'subagent', details: { mode: 'parallel', results: [{ agent: 'tester', exitCode: 0, stopReason: 'stop' }] }, content: [{ type: 'text', text: 'done' }] } },
    { type: 'compaction', id: 'c9', parentId: 'r1', summary: 'Compacted.', tokensBefore: 48200 },
  ])
  const outline = projectReadingOutline(projectReadingTurns(turns), '/repo')
  assert.equal(outline.title, '/repo')
  assert.equal(outline.turns.length, 1)
  const [entry] = outline.turns
  assert.equal(entry.title, 'Cut a release.')
  assert.equal(entry.status, 'running')
  assert.equal(entry.subagentCount, 1)
  assert.equal(entry.compaction, true)
  assert.deepEqual(entry.context.map((context) => context.kind), ['skill-declaration', 'compaction'])
  assert.equal(entry.context[1].label, 'Compaction · 48200 tokens')
  assert.equal(projectReadingOutline([]).turns.length, 0)
})

test('an assistant message that only calls tools reports its tool count, not an empty record', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'Inspect the repo' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'a.js' } }, { type: 'toolCall', id: 'c2', name: 'bash', arguments: { command: 'ls' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: 'a' }] } },
    { type: 'message', id: 'r2', parentId: 'r1', message: { role: 'toolResult', toolCallId: 'c2', toolName: 'bash', content: [{ type: 'text', text: 'b' }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  const assistant = readingTurn.cards.find((card) => card.kind === 'assistant')
  assert.equal(assistant.text, '')
  assert.equal(assistant.toolCount, 2)
  // 同一步的工具卡各算一次，不含上一步的
  assert.equal(readingTurn.cards.filter((card) => card.kind === 'tool').length, 2)
})

test('tool counts stay per step, and a message with text keeps its text', () => {
  const { turns } = parse([
    { type: 'message', id: 'u1', parentId: 's', message: { role: 'user', content: [{ type: 'text', text: 'go' }] } },
    { type: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'read', arguments: { path: 'a.js' } }] } },
    { type: 'message', id: 'r1', parentId: 'a1', message: { role: 'toolResult', toolCallId: 'c1', toolName: 'read', content: [{ type: 'text', text: 'a' }] } },
    { type: 'message', id: 'a2', parentId: 'r1', message: { role: 'assistant', content: [{ type: 'text', text: 'Found it' }] } },
    { type: 'message', id: 'a3', parentId: 'a2', message: { role: 'assistant', content: [{ type: 'text', text: 'Now editing' }, { type: 'toolCall', id: 'c2', name: 'edit', arguments: { path: 'a.js' } }] } },
  ])
  const [readingTurn] = projectReadingTurns(turns)
  const assistants = readingTurn.cards.filter((card) => card.kind === 'assistant')
  assert.deepEqual(assistants.map((card) => [card.text, card.toolCount]), [
    ['', 1],
    ['Found it', 0],
    ['Now editing', 1],
  ])
})
