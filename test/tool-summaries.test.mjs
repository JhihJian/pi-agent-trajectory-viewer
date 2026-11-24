import test from 'node:test'
import assert from 'node:assert/strict'
import { activeRules, defaultSummaryRules, normalizeRules, summarizeToolCell, summarizeToolContext, toolContextForCell, validateRules, firstLine, fillTemplate, cleanTemplateOutput } from '../src/lib/tool-summaries.js'

test('pi file tools summarize from the path argument', () => {
  const read = summarizeToolCell({ toolName: 'read', raw: { call: { arguments: { path: 'src/lib/timeline.js' } } } })
  assert.equal(read.matched, true)
  assert.equal(read.title, 'Read file')
  assert.equal(read.summary, 'src/lib/timeline.js')
  const write = summarizeToolCell({ toolName: 'write', raw: { call: { arguments: { path: 'README.md', content: 'ignored' } } } })
  assert.equal(write.title, 'Write file')
  assert.equal(write.summary, 'README.md')
})

test('bash commands pick the rg segment and extract query and path', () => {
  const rgFiles = summarizeToolCell({ toolName: 'bash', raw: { call: { arguments: { command: 'pwd && rg --files src' } } } })
  assert.equal(rgFiles.title, 'List files')
  assert.equal(rgFiles.summary, 'src')
  const rgSearch = summarizeToolCell({ toolName: 'bash', raw: { call: { arguments: { command: 'rg -n "deriveTrajectory" src/lib' } } } })
  assert.equal(rgSearch.title, 'Search text')
  assert.equal(rgSearch.summary, 'deriveTrajectory src/lib')
  const npmTest = summarizeToolCell({ toolName: 'bash', raw: { call: { arguments: { command: 'npm test' } } } })
  assert.equal(npmTest.title, 'Run verification')
  const other = summarizeToolCell({ toolName: 'bash', raw: { call: { arguments: { command: 'docker ps' } } } })
  assert.equal(other.title, 'Run command')
  assert.equal(other.summary, 'docker ps')
})

test('unmatched tools fall back to the tool name and first argument line', () => {
  const summary = summarizeToolCell({ toolName: 'browser', text: 'browser', raw: { call: { arguments: { url: 'https://example.com', action: 'open' } } } })
  assert.equal(summary.matched, false)
  assert.equal(summary.title, 'browser')
  assert.equal(summary.summary, '{"url":"https://example.com","action":"open"}')
})

test('summarizeToolContext fills templates with match groups and custom rules', () => {
  const rules = [{ id: 'custom-deploy', label: 'Deploy', enabled: true, tool: 'bash', pattern: 'deploy (?<env>\\S+)', title: 'Deploy to {env}', summary: '{match0}' }, ...defaultSummaryRules]
  const matched = summarizeToolContext({ toolName: 'bash', command: 'deploy staging' }, { rules })
  assert.equal(matched.ruleId, 'custom-deploy')
  assert.equal(matched.title, 'Deploy to staging')
  // The built-in bash catch-all sits behind custom rules but still matches.
  assert.equal(summarizeToolContext({ toolName: 'bash', command: 'echo hi' }).title, 'Run command')
})

test('tool context keeps command, path and query for raw inspection', () => {
  const context = toolContextForCell({ toolName: 'bash', raw: { call: { arguments: { command: 'rg --files src' } } }, result: 'a.js\nb.js' })
  assert.equal(context.command, 'rg --files src')
  assert.equal(context.path, 'src')
  assert.equal(context.query, 'src')
  assert.equal(context.output, 'a.js\nb.js')
  const globbed = toolContextForCell({ toolName: 'bash', raw: { call: { arguments: { command: 'rg --files --glob *.js' } } } })
  assert.equal(globbed.path, '.')
})

test('firstLine collapses whitespace and ellipsizes', () => {
  assert.equal(firstLine('  a\n\nb  ', 3), 'a b')
  assert.equal(firstLine('a b', 2), 'a…')
  assert.equal(firstLine(''), '')
})

test('custom rules are normalized, run before built-ins and validated', () => {
  const custom = normalizeRules([{ label: 'Deploy', tool: 'bash', pattern: 'deploy (?<env>\\S+)', title: 'Deploy to {env}', summary: '{match0}' }, { title: 'No pattern' }])
  assert.equal(custom.length, 1)
  const rules = [custom[0], ...defaultSummaryRules]
  const matched = summarizeToolContext({ toolName: 'bash', command: 'deploy staging' }, { rules })
  assert.equal(matched.ruleId, custom[0].id)
  assert.equal(matched.title, 'Deploy to staging')
  const [invalid] = validateRules([{ title: '', pattern: '(' }])
  assert.equal(invalid.field, 'title')
  assert.deepEqual(validateRules([{ title: 'T', pattern: 'ok', tool: '' }]), [])
  assert.deepEqual(validateRules([{ title: 'T', pattern: 'ok', tool: '/(/' }]).filter(error => error.field === 'tool').map(error => error.field), ['tool'])
})

test('activeRules keeps custom rules ahead of the built-in list', () => {
  const rules = activeRules([{ id: 'custom-x', tool: 'read', pattern: 'x', title: 'Custom x' }])
  assert.equal(rules[0].id, 'custom-x')
  assert.equal(rules.at(-1).id, 'pi-bash-command')
  assert.equal(activeRules(undefined).length, defaultSummaryRules.length)
})

test('fillTemplate and cleanTemplateOutput render readable summaries', () => {
  assert.equal(fillTemplate('{query} {path}', { query: 'q', path: undefined }), 'q ')
  assert.equal(cleanTemplateOutput('  a   b  ，'), 'a b')
})
