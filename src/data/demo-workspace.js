// Demo workspace fixture: two sources with several sessions each, driven by a
// row builder so the "tail window" reading (only the last N bytes are parsed)
// has a realistically long session to work against.

function sessionRows({ id, cwd, startedAt, turns }) {
  const rows = [{ type: 'session', version: 3, id, cwd }]
  let parentId = null
  let clock = Date.parse(startedAt)
  const stamp = () => new Date(clock += 1000).toISOString()
  for (let index = 1; index <= turns; index += 1) {
    rows.push({ type: 'message', id: `${id}-u${index}`, parentId, timestamp: stamp(), message: { role: 'user', content: [{ type: 'text', text: `Step ${index}: continue the checklist for ${id}.` }] } })
    parentId = `${id}-u${index}`
    rows.push({ type: 'message', id: `${id}-a${index}`, parentId, timestamp: stamp(), message: { role: 'assistant', usage: { input: 900 + index, output: 40 + index, cacheRead: 3000 }, stopReason: index % 4 === 0 ? 'toolUse' : 'stop', content: [
      { type: 'text', text: `Working on step ${index} of the ${id} checklist.` },
      { type: 'toolCall', id: `${id}-c${index}`, name: index % 3 === 0 ? 'read' : 'bash', arguments: index % 3 === 0 ? { path: `src/checklist/${index}.md` } : { command: `node scripts/step.js ${index}` } },
    ] } })
    parentId = `${id}-a${index}`
    rows.push({ type: 'message', id: `${id}-r${index}`, parentId, timestamp: stamp(), message: { role: 'toolResult', toolCallId: `${id}-c${index}`, toolName: index % 3 === 0 ? 'read' : 'bash', durationMs: 400 + index * 37, content: [{ type: 'text', text: index % 7 === 0 ? `step ${index}: check failed` : `step ${index}: ok` }] } })
  }
  return { rows, lastId: rows.at(-1).id }
}

function fixture(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n')
}

export const demoSources = [
  { id: 'pi-agent', name: 'Pi Agent', root: '~/.pi/agent/sessions' },
  { id: 'archive', name: 'Archive', root: '~/exports/agent-runs' },
]

function buildDemoSessions() {
  const ci = sessionRows({ id: 'timeline-ci', cwd: '/data/dev/pi-agent-trajectory-viewer', startedAt: '2026-02-03T09:00:00.000Z', turns: 26 })
  const release = sessionRows({ id: 'release-run', cwd: '/data/dev/pi-agent-trajectory-viewer', startedAt: '2026-02-03T14:00:00.000Z', turns: 90 })
  const refactor = sessionRows({ id: 'archive-refactor', cwd: '/data/dev/legacy-tool', startedAt: '2026-01-28T11:00:00.000Z', turns: 12 })
  const releaseRows = release.rows
  releaseRows.push(
    { type: 'message', id: 'release-run-ufinal', parentId: release.lastId, timestamp: '2026-02-03T15:30:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Wrap up the release run.' }] } },
    { type: 'message', id: 'release-run-afinal', parentId: 'release-run-ufinal', timestamp: '2026-02-03T15:30:01.000Z', message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Release run complete: checklist verified and tagged.' }] } },
  )
  return [
    { id: 'timeline-ci', sourceId: 'pi-agent', title: 'Debug the timeline tests on CI', cwd: '/data/dev/pi-agent-trajectory-viewer', model: 'claude-sonnet-4-5', startedAt: '2026-02-03T09:00:00.000Z', updatedAt: '2026-02-03T09:41:00.000Z', fixture: fixture(ci.rows) },
    { id: 'release-run', sourceId: 'pi-agent', title: 'Release checklist run', cwd: '/data/dev/pi-agent-trajectory-viewer', model: 'claude-sonnet-4-5', startedAt: '2026-02-03T14:00:00.000Z', updatedAt: '2026-02-03T15:30:01.000Z', fixture: fixture(releaseRows) },
    { id: 'archive-refactor', sourceId: 'archive', title: 'Legacy tool refactor notes', cwd: '/data/dev/legacy-tool', model: 'glm-4.6', startedAt: '2026-01-28T11:00:00.000Z', updatedAt: '2026-01-28T11:52:00.000Z', fixture: fixture(refactor.rows) },
  ]
}

export const demoSessions = buildDemoSessions()
