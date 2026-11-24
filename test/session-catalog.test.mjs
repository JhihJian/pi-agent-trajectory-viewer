import test from 'node:test'
import assert from 'node:assert/strict'
import { dateLabel, groupSessions, matchesSession, sessionSizeLabel } from '../src/lib/session-catalog.js'

const sessions = [
  { id: 'b', sourceId: 'pi-agent', title: 'Release checklist run', cwd: '/data/dev/app', model: 'claude-sonnet-4-5', updatedAt: '2026-02-03T14:00:00.000Z' },
  { id: 'a', sourceId: 'pi-agent', title: 'Debug the timeline tests on CI', cwd: '/data/dev/app', model: 'claude-sonnet-4-5', updatedAt: '2026-02-03T09:41:00.000Z' },
  { id: 'c', sourceId: 'archive', title: 'Legacy tool refactor notes', cwd: '/data/dev/legacy-tool', model: 'glm-4.6', updatedAt: '2026-01-28T11:52:00.000Z' },
]

test('grouping sorts by activity and nests per source and day', () => {
  const grouped = groupSessions(sessions)
  assert.deepEqual([...grouped.keys()], ['pi-agent', 'archive'])
  const piGroups = grouped.get('pi-agent')
  assert.equal(piGroups.length, 1, 'same-day sessions share one group')
  assert.deepEqual(piGroups[0].sessions.map((session) => session.id), ['b', 'a'])
  assert.equal(grouped.get('archive')[0].sessions[0].id, 'c')
})

test('search filters with multi-word AND over title, cwd, model and ids', () => {
  assert.deepEqual(groupSessions(sessions, { query: 'timeline' }).get('pi-agent')[0].sessions.map(s => s.id), ['a'])
  assert.equal(groupSessions(sessions, { query: 'legacy' }).has('pi-agent'), false)
  assert.deepEqual(groupSessions(sessions, { query: 'release checklist' }).get('pi-agent')[0].sessions.map(s => s.id), ['b'])
  assert.equal(groupSessions(sessions, { query: 'nomatch' }).size, 0)
  assert.equal(groupSessions(sessions, { query: '' }).size, 2)
})

test('size labels stay honest for unknown and small sessions', () => {
  assert.equal(sessionSizeLabel(48200), '47 KB')
  assert.equal(sessionSizeLabel(900), '900 B')
  assert.equal(sessionSizeLabel(undefined), '—')
  assert.equal(dateLabel('2026-02-03T09:00:00.000Z'), dateLabel('2026-02-03T10:00:00.000Z'))
  assert.equal(dateLabel(undefined), 'Undated')
})
