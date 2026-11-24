// Minimal Pi Agent session fixture that drives the live component previews.
// Beyond the basic message loop it also exercises the pi-specific semantics the
// reading and trace views project: skill instruction blocks, SKILL.md reads,
// embedded subagent batches and compaction events.
const rows = [
  { type: 'session', version: 3, id: 'showcase-demo', cwd: '/data/dev/pi-agent-trajectory-viewer' },
  { type: 'message', id: 'u1', parentId: 'showcase-demo', timestamp: '2026-02-03T09:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Check why the timeline tests fail on CI, then fix it.' }] } },
  { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-02-03T09:00:01.200Z', message: { role: 'assistant', provider: 'anthropic', modelId: 'claude-sonnet-4-5', usage: { input: 1250, output: 96, cacheRead: 4200, reasoning: 210 }, content: [
    { type: 'thinking', thinking: 'CI failure mentions a timeline assertion. Read the workflow log first, then the timeline test file to see which projection it expects.' },
    { type: 'text', text: 'I will read the CI log and the timeline test to pin down the failing assertion.' },
    { type: 'toolCall', id: 'call-1', name: 'bash', arguments: { command: 'gh run view 4179 --log-failed | tail -40' } },
  ] } },
  { type: 'message', id: 'r1', parentId: 'a1', timestamp: '2026-02-03T09:00:03.100Z', message: { role: 'toolResult', toolCallId: 'call-1', toolName: 'bash', content: [{ type: 'text', text: '✖ duration focus excludes missing timestamps without inventing missing duration\n  AssertionError: expected [ 2, 3 ] to deeply equal [ 2 ]' }] } },
  { type: 'message', id: 'a2', parentId: 'r1', timestamp: '2026-02-03T09:00:04.000Z', message: { role: 'assistant', usage: { input: 1480, output: 210, cacheRead: 5960 }, content: [
    { type: 'thinking', thinking: 'Records without timestamps must drop out of duration mode instead of shifting later positions. The projection should skip them and keep stable positions.' },
    { type: 'text', text: 'The projection keeps untimed records in duration mode. I will skip them and keep the positions stable.' },
    { type: 'toolCall', id: 'call-2', name: 'read', arguments: { path: 'src/lib/timeline.js' } },
  ] } },
  { type: 'message', id: 'r2', parentId: 'a2', timestamp: '2026-02-03T09:00:05.400Z', message: { role: 'toolResult', toolCallId: 'call-2', toolName: 'read', content: [{ type: 'text', text: 'export function deriveTrajectoryTimeline(turns, mode = \'sequence\') { ... }' }] } },
  { type: 'message', id: 'a3', parentId: 'r2', timestamp: '2026-02-03T09:00:06.200Z', message: { role: 'assistant', usage: { input: 1620, output: 88, cacheRead: 7100 }, stopReason: 'stop', content: [
    { type: 'text', text: 'Fixed. Records without timestamps are now skipped in duration mode, so positions stay stable.' },
    { type: 'toolCall', id: 'call-3', name: 'bash', arguments: { command: 'npm test' } },
  ] } },
  { type: 'message', id: 'r3', parentId: 'a3', timestamp: '2026-02-03T09:00:14.900Z', message: { role: 'toolResult', toolCallId: 'call-3', toolName: 'bash', content: [{ type: 'text', text: 'ℹ tests 31\nℹ pass 31\nℹ fail 0' }] } },

  { type: 'message', id: 'u2', parentId: 'r3', timestamp: '2026-02-03T09:05:00.000Z', message: { role: 'user', content: [{ type: 'text', text: '<skill name="release" location="/data/dev/pi-agent-trajectory-viewer/.pi/skills/release/SKILL.md">\nRun the release checklist end to end: verify tests, build the package, then tag the release.\n</skill>\nPlease cut a release for the timeline fix.' }] } },
  { type: 'message', id: 'a4', parentId: 'u2', timestamp: '2026-02-03T09:05:01.000Z', message: { role: 'assistant', usage: { input: 1810, output: 64, cacheRead: 8300 }, content: [
    { type: 'text', text: 'I will load the release skill first, then run its checks.' },
    { type: 'toolCall', id: 'call-4', name: 'read', arguments: { path: '/data/dev/pi-agent-trajectory-viewer/.pi/skills/release/SKILL.md' } },
  ] } },
  { type: 'message', id: 'r4', parentId: 'a4', timestamp: '2026-02-03T09:05:01.900Z', message: { role: 'toolResult', toolCallId: 'call-4', toolName: 'read', content: [{ type: 'text', text: '# Release skill\n1. npm test\n2. npm run build\n3. Tag the release and publish.' }] } },
  { type: 'message', id: 'a5', parentId: 'r4', timestamp: '2026-02-03T09:05:02.400Z', message: { role: 'assistant', usage: { input: 1902, output: 71, cacheRead: 9100 }, stopReason: 'toolUse', content: [
    { type: 'text', text: 'Running the release checks as parallel subagents.' },
    { type: 'toolCall', id: 'call-5', name: 'subagent', arguments: { mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }, { agent: 'builder', task: 'npm run build' }] } },
  ] } },
  { type: 'message', id: 'r5', parentId: 'a5', timestamp: '2026-02-03T09:05:44.000Z', message: { role: 'toolResult', toolCallId: 'call-5', toolName: 'subagent', durationMs: 41600, details: { mode: 'parallel', results: [
    { agent: 'tester', exitCode: 0, stopReason: 'stop', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'All 34 tests pass.' }] }] },
    { agent: 'builder', exitCode: 0, stopReason: 'stop', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Build completed without warnings.' }] }] },
  ] }, content: [{ type: 'text', text: '2/2 subagents succeeded' }] } },

  { type: 'compaction', id: 'c1', parentId: 'r5', timestamp: '2026-02-03T09:06:00.000Z', summary: 'Earlier CI debugging turns were compacted; release work continues from this summary.', tokensBefore: 48200, retainedTailCount: 6 },
  { type: 'message', id: 'a6', parentId: 'c1', timestamp: '2026-02-03T09:06:02.000Z', message: { role: 'assistant', usage: { input: 1500, output: 55, cacheRead: 2100 }, stopReason: 'stop', content: [
    { type: 'text', text: 'Release 0.2.0 is ready: tests pass, the build is clean and the tag is set.' },
  ] } },
]

export const sampleFixture = rows.map(row => JSON.stringify(row)).join('\n')
