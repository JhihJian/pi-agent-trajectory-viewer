import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePiSkillInstruction, piSkillReadFromToolCall, parsePiSubagentCall, projectPiSubagentResult, piCompactionOf, piGoalControlOf, turnStatusOf } from '../src/lib/pi-semantics.js'

test('skill instruction parsing keeps name, instruction and trailing user text', () => {
  const parsed = parsePiSkillInstruction('<skill name="release" location="/repo/.pi/skills/release/SKILL.md">\nDo the checklist.\n</skill>\nCut a release.')
  assert.equal(parsed.name, 'release')
  assert.equal(parsed.instruction, 'Do the checklist.')
  assert.equal(parsed.userText, 'Cut a release.')
  assert.equal(parsed.sourceFile, 'SKILL.md')
  assert.equal(parsed.locationKey, '/repo/.pi/skills/release/SKILL.md')
  assert.equal(parsePiSkillInstruction('just a normal message'), null)
  assert.equal(parsePiSkillInstruction('<skill name="release">no location or body</skill>'), null)
  const windows = parsePiSkillInstruction('<skill name="docs" location="C:\\repo\\docs\\SKILL.md">\nX\n</skill>')
  assert.equal(windows.locationKey, 'C:/repo/docs/SKILL.md')
})

test('skill reads are read calls targeting SKILL.md and hint the skill name', () => {
  const read = piSkillReadFromToolCall('read', { path: '/repo/.pi/skills/release/SKILL.md' })
  assert.equal(read.skillNameHint, 'release')
  assert.equal(read.sourceFile, 'SKILL.md')
  assert.equal(piSkillReadFromToolCall('read', { path: 'src/lib/timeline.js' }), null)
  assert.equal(piSkillReadFromToolCall('bash', { command: 'cat SKILL.md' }), null)
  const stringArgs = piSkillReadFromToolCall('read', '{"path":"/repo/docs/SKILL.md"}')
  assert.equal(stringArgs.skillNameHint, 'docs')
})

test('subagent calls parse mode and requested tasks, non-subagents return null', () => {
  const parallel = parsePiSubagentCall({ mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }, { agent: 'builder', task: 'npm run build' }] })
  assert.equal(parallel.mode, 'parallel')
  assert.deepEqual(parallel.requested.map((task) => task.agent), ['tester', 'builder'])
  assert.equal(parallel.status, 'pending')
  const implied = parsePiSubagentCall({ agent: 'explorer', task: 'Look around' })
  assert.equal(implied.mode, 'single')
  assert.equal(parsePiSubagentCall({ command: 'ls' }), null)
  assert.equal(parsePiSubagentCall(null), null)
})

test('subagent results project per-task status, coverage and batch status', () => {
  const batch = parsePiSubagentCall({ mode: 'parallel', tasks: [{ agent: 'tester', task: 'npm test' }, { agent: 'builder', task: 'npm run build' }] })
  const resultRow = { message: { content: [{ type: 'text', text: '2/2 subagents succeeded' }], details: { mode: 'parallel', results: [
    { agent: 'tester', exitCode: 0, stopReason: 'stop', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'All tests pass.' }] }] },
    { agent: 'builder', exitCode: 1, stopReason: 'stop' },
  ] } } }
  const projected = projectPiSubagentResult(batch, resultRow)
  assert.deepEqual(projected.results.map((result) => result.status), ['succeeded', 'failed'])
  assert.equal(projected.results[0].summary, 'All tests pass.')
  assert.equal(projected.status, 'partial')
  assert.equal(projected.evidence.coverage, 1)
  assert.equal(projected.returnInfo.recorded, true)
  assert.equal(projected.returnInfo.text, '2/2 subagents succeeded')
  const cancelled = projectPiSubagentResult(batch, { message: { isError: true, content: [{ type: 'text', text: 'Canceled: user stopped the run' }] } })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(projectPiSubagentResult(null, resultRow), null)
})

test('compaction rows keep pi accounting and ignore unrelated rows', () => {
  const compact = piCompactionOf({ type: 'compaction', summary: 'Compacted.', tokensBefore: 48200, retainedTailCount: 6, fromHook: true })
  assert.equal(compact.kind, 'pi_compaction')
  assert.equal(compact.tokensBefore, 48200)
  assert.equal(compact.retainedTailCount, 6)
  assert.equal(compact.fromHook, true)
  assert.equal(piCompactionOf({ type: 'branch_summary', summary: ['branch text'] }).kind, 'branch_summary')
  assert.equal(piCompactionOf({ type: 'message' }), null)
})

test('goal control prompts are detected by their markers and normal text is not', () => {
  assert.deepEqual(piGoalControlOf('Goal mode is active. Complete this goal fully:\n\n<goal_objective>x</goal_objective>'), { kind: 'start' })
  assert.deepEqual(piGoalControlOf('The active /goal objective was updated. The updated objective supersedes every previous goal objective.'), { kind: 'update' })
  assert.deepEqual(piGoalControlOf('The user explicitly resumed the paused /goal. Continue working toward this goal:'), { kind: 'resume', status: 'paused' })
  const continuation = 'Continue the active /goal until it is complete:\n\n<!-- pi-goal-continuation:0d3f8a60-8f5e-4d1a-9f21-2f6a9db79c01:4:0d3f8a60-8f5e-4d1a-9f21-2f6a9db79c02 -->'
  assert.deepEqual(piGoalControlOf(continuation), { kind: 'continuation' })
  assert.equal(piGoalControlOf('Normal user message'), null)
})

test('turn status comes from the open end and the last assistant stop reason', () => {
  const turn = (cells) => ({ groups: cells.map((cell) => ({ cells: [cell] })) })
  assert.equal(turnStatusOf(turn([{ kind: 'user' }])), 'waiting')
  assert.equal(turnStatusOf(turn([{ kind: 'user' }, { kind: 'message', raw: { message: { stopReason: 'toolUse' } } }, { kind: 'tool', raw: {} }])), 'running')
  assert.equal(turnStatusOf(turn([{ kind: 'user' }, { kind: 'message', raw: { message: { stopReason: 'error' } } }])), 'failed')
  assert.equal(turnStatusOf(turn([{ kind: 'message', raw: { message: { stopReason: 'aborted' } } }])), 'aborted')
  assert.equal(turnStatusOf(turn([{ kind: 'user' }, { kind: 'message', raw: { message: { stopReason: 'stop' } } }])), 'complete')
  assert.equal(turnStatusOf(turn([{ kind: 'compacted' }])), 'context')
  assert.equal(turnStatusOf({ groups: [] }), null)
})
