import test from 'node:test'
import assert from 'node:assert/strict'
import { allFolded, flattenTurns, foldRecords, foldTargets, projectTimeline, toggleAllFolds, toggleCallGroups, toggleFold } from '../src/lib/trajectory-view.js'

const turns = [
  { turn: 1, groups: [
    { cells: [{ kind: 'user', recordId: 'u1', text: 'First request', startedAt: 1000 }] },
    { cells: [{ kind: 'message', recordId: 'a1', text: 'Inspect', startedAt: 2000, timeSeconds: 2 }, { kind: 'tool', recordId: 't1', text: 'read', startedAt: 4000, timeSeconds: 1 }, { kind: 'tool', recordId: 't2', text: 'bash', startedAt: 4000, timeSeconds: 2 }] },
    { cells: [{ kind: 'message', recordId: 'a2', text: 'Verify', startedAt: 10000, timeSeconds: null }, { kind: 'tool', recordId: 't3', text: 'bash', startedAt: 10000, timeSeconds: 1 }] },
  ] },
  { turn: 2, groups: [{ cells: [{ kind: 'user', recordId: 'u2', text: 'Second request' }] }, { cells: [{ kind: 'message', recordId: 'a3', text: 'Done' }] }] },
  { turn: 3, groups: [{ cells: [{ kind: 'user', recordId: 'u3', text: 'Pending request' }] }] },
]
const records = flattenTurns(turns)

test('equal-width projection preserves original record identity and unavailable timing', () => {
  const projected = projectTimeline(records, false)
  assert.equal(projected.length, records.length)
  projected.forEach((span, index) => {
    assert.equal(span.cell, records[index].cell)
    assert.equal(span.start, index)
    assert.equal(span.end, index + 1)
  })
  assert.equal(projected[4].cell.timeSeconds, null)
  assert.equal(projected[0].cell.startedAt, 1000)
  const large = projectTimeline(Array.from({ length: 1000 }, () => records[0]), false)
  assert.equal((large[0].end - large[0].start) / large.at(-1).end * 100, 0.1)
})

test('duration projection compresses idle gaps, preserves overlap and does not invent durations', () => {
  const projected = projectTimeline(records, true)
  assert.deepEqual(projected.map(({ start, end }) => [start, end]), [[1000,1000], [1000,3000], [3000,4000], [3000,5000], [5000,5000], [5000,6000]])
  projected.forEach((span, index) => assert.equal(span.cell, records[index].cell))
  assert.deepEqual(projectTimeline([{ cell: { startedAt: null } }], true), [])
})

test('only multi-record turns and assistants owning calls are collapsible', () => {
  assert.deepEqual(foldTargets(records), { turns: [1, 2], assistants: ['a1', 'a2'] })
  const orphan = flattenTurns([{ turn: 1, groups: [{ cells: [{ kind: 'tool', text: 'orphan' }] }] }])
  assert.deepEqual(foldTargets(orphan), { turns: [], assistants: [] })
  assert.equal(foldRecords(orphan, new Set(), new Set(['a1'])).length, 1)
})

test('global toggle folds remaining groups from a mixed state, then expands all', () => {
  const ids = foldTargets(records).assistants
  const partial = new Set(['a1'])
  assert.equal(allFolded(ids, partial), false)
  const all = toggleAllFolds(partial, ids)
  assert.equal(allFolded(ids, all), true)
  assert.deepEqual(toggleAllFolds(all, ids), new Set())
  assert.deepEqual(toggleFold(all, 'a1'), new Set(['a2']))
  assert.deepEqual(partial, new Set(['a1']))
  assert.equal(allFolded([], new Set()), false)
})

test('call summaries preserve their assistant and expand independently', () => {
  const folded = foldRecords(records, new Set(), new Set(['a1', 'a2']))
  assert.deepEqual(folded.filter(record => record.summaryKind).map(record => record.summary), ['2 tool calls · read, bash', '1 tool call · bash'])
  assert.equal(folded.filter(record => record.cell.kind === 'tool').length, 0)
  assert.equal(folded.filter(record => record.cell.recordId === 'a1' && !record.summaryKind).length, 1)
  const partial = foldRecords(records, new Set(), new Set(['a2']))
  assert.deepEqual(partial.filter(record => record.cell.kind === 'tool').map(record => record.cell.recordId), ['t1', 't2'])
  assert.equal(partial.find(record => record.summaryKind).assistantId, 'a2')
})

test('Turns then Calls reveals call groups and updates both toolbar states', () => {
  const targets = foldTargets(records)
  const turnsFolded = toggleAllFolds(new Set(), targets.turns)
  assert.equal(foldRecords(records, turnsFolded, new Set()).filter(record => record.summaryKind === 'turn').length, 2)

  const grouped = toggleCallGroups(new Set(), targets.assistants)
  const visible = foldRecords(records, grouped.collapsedTurns, grouped.collapsedAssistants)
  assert.equal(visible.some(record => record.summaryKind === 'turn'), false)
  assert.equal(visible.filter(record => record.summaryKind === 'assistant').length, 2)
  assert.equal(visible.some(record => record.cell.kind === 'tool'), false)
  assert.equal(allFolded(targets.turns, grouped.collapsedTurns), false)
  assert.equal(allFolded(targets.assistants, grouped.collapsedAssistants), true)

  // Fold Turns again while Calls is folded, then expand Calls in one action.
  assert.equal(foldRecords(records, turnsFolded, grouped.collapsedAssistants).filter(record => record.summaryKind === 'turn').length, 2)
  const expanded = toggleCallGroups(grouped.collapsedAssistants, targets.assistants)
  assert.deepEqual(foldRecords(records, expanded.collapsedTurns, expanded.collapsedAssistants), records)

  // A partially expanded Calls state still collapses every group and reveals them.
  const partial = toggleFold(grouped.collapsedAssistants, 'a1')
  const regrouped = toggleCallGroups(partial, targets.assistants)
  assert.equal(allFolded(targets.assistants, regrouped.collapsedAssistants), true)
  assert.equal(regrouped.collapsedTurns.size, 0)
})

test('turn folding takes precedence without discarding call fold state or adding empty summaries', () => {
  const calls = new Set(['a1'])
  const folded = foldRecords(records, new Set([1, 3]), calls)
  assert.deepEqual(folded.filter(record => record.turn === 1).map(record => record.summary || record.cell.text), ['First request', '2 steps · 3 tool calls'])
  assert.equal(folded.filter(record => record.turn === 3).length, 1)
  const expanded = foldRecords(records, new Set(), calls)
  assert.equal(expanded.find(record => record.summaryKind).assistantId, 'a1')
  assert.equal(expanded.find(record => record.summaryKind).turnEnd, false)
  assert.equal(expanded.find(record => record.cell.recordId === 't3').turnEnd, true)
})
