import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveTrajectoryTimeline, trajectoryTimelineFocusIndexes, matchesSearch } from '../src/timeline.js'

const turns = [{ turn: 1, groups: [{ cells: [
  { kind: 'user', recordId: 'u', text: 'hello', startedAt: null },
  { kind: 'message', recordId: 'a', text: 'answer', startedAt: 1000, timeSeconds: null },
  { kind: 'tool', recordId: 'c', text: 'bash', callId: 'call-exact', inputDetail: 'first keyword', outputDetail: 'second result', startedAt: 1000, timeSeconds: 2 },
] }] }]

test('timeline range uses stable positions, inclusive overlap and reverse endpoints', () => {
  assert.deepEqual([...trajectoryTimelineFocusIndexes(turns, { start: 1.2, end: 2.2 })], [2, 3])
  assert.deepEqual([...trajectoryTimelineFocusIndexes(turns, { start: 2.2, end: 1.2 })], [2, 3])
  assert.deepEqual([...trajectoryTimelineFocusIndexes(turns, { start: 1, end: 1 })], [1, 2])
  assert.deepEqual([...trajectoryTimelineFocusIndexes(turns, { start: 10, end: 11 })], [])
  assert.equal(trajectoryTimelineFocusIndexes(turns, null), null)
})

test('duration focus excludes missing timestamps without inventing missing duration', () => {
  const model = deriveTrajectoryTimeline(turns, 'duration')
  assert.deepEqual(model.spans.map(({ index, start, end }) => ({ index, start, end })), [{ index: 2, start: 1000, end: 1000 }, { index: 3, start: 1000, end: 3000 }])
  assert.deepEqual([...trajectoryTimelineFocusIndexes(turns, { start: 1500, end: 2500 }, 'duration')], [3])
  assert.equal(deriveTrajectoryTimeline([], 'duration'), null)
  assert.equal(deriveTrajectoryTimeline([{ turn: 1, groups: [{ cells: [{ kind: 'user', startedAt: null }] }] }], 'duration'), null)
})

test('zero-length duration domains fall back to distinct record positions', () => {
  const zero = [{ turn: 1, groups: [{ cells: [{ kind: 'user', startedAt: 1000 }, { kind: 'message', startedAt: 2000, timeSeconds: 0 }] }] }]
  const model = deriveTrajectoryTimeline(zero, 'duration')
  assert.equal(model.durationFallback, true)
  assert.deepEqual(model.spans.map(({ start, end }) => [start, end]), [[0, 1], [1, 2]])
  assert.deepEqual([...trajectoryTimelineFocusIndexes(zero, { start: 1.2, end: 1.8 }, 'duration')], [2])
})

test('search matches separate terms, turn identity and call identity', () => {
  const cell = turns[0].groups[0].cells[2]
  assert.equal(matchesSearch(cell, 'second first'), true)
  assert.equal(matchesSearch(cell, 'CALL-EXACT'), true)
  assert.equal(matchesSearch(cell, 'turn 1', 1), true)
  assert.equal(matchesSearch(cell, 'missing first'), false)
})
