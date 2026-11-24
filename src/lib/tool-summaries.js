// Tool call summaries adapt the codex-session-renderer rule engine
// (public/models/summary-rules.js, public/views/tool-summary.js and
// src/tool-summary-command.mjs): readable node titles from regex rules, while
// arguments and output always stay available verbatim in the detail panel.

export const defaultSummaryRules = [
  { id: 'pi-read-file', label: 'Read file', enabled: true, tool: 'read', pattern: '[\\s\\S]*', title: 'Read file', summary: '{path}' },
  { id: 'pi-write-file', label: 'Write file', enabled: true, tool: 'write', pattern: '[\\s\\S]*', title: 'Write file', summary: '{path}' },
  { id: 'pi-edit-file', label: 'Edit file', enabled: true, tool: 'edit', pattern: '[\\s\\S]*', title: 'Edit file', summary: '{path}' },
  { id: 'pi-subagent', label: 'Run subagents', enabled: true, tool: 'subagent', pattern: '[\\s\\S]*', title: 'Run subagents', summary: '{tasks}' },
  { id: 'pi-goal-complete', label: 'Complete goal', enabled: true, tool: 'goal_complete', pattern: '[\\s\\S]*', title: 'Complete goal', summary: '{query}' },
  { id: 'pi-bash-rg-files', label: 'List files', enabled: true, tool: 'bash', pattern: '(?:^|\\s(?:&&|\\|\\||[|;])\\s*)rg\\s+--files\\b', title: 'List files', summary: '{path}' },
  { id: 'pi-bash-rg-search', label: 'Search text', enabled: true, tool: 'bash', pattern: '(?:^|\\s(?:&&|\\|\\||[|;])\\s*)rg\\b', title: 'Search text', summary: '{query} {path}' },
  { id: 'pi-bash-verification', label: 'Run verification', enabled: true, tool: 'bash', pattern: '^(?:npm|pnpm|yarn)\\s+(?:run\\s+)?(?:test|check|lint|typecheck)\\b|^node\\s+--test\\b|^(?:npx\\s+)?(?:pytest|vitest|jest)\\b|^(?:npx\\s+)?playwright\\s+test\\b', title: 'Run verification', summary: '{cmd}' },
  { id: 'pi-bash-build', label: 'Build or typecheck', enabled: true, tool: 'bash', pattern: '^(?:npm|pnpm|yarn)\\s+(?:run\\s+)?build\\b|^(?:npx\\s+)?tsc\\b|^cargo\\s+build\\b|^go\\s+(?:build|test)\\b', title: 'Build / typecheck', summary: '{cmd}' },
  { id: 'pi-bash-git-status', label: 'Git status', enabled: true, tool: 'bash', pattern: '^git\\s+status\\b', title: 'Show git status', summary: '{cmd}' },
  { id: 'pi-bash-git-diff', label: 'Git diff', enabled: true, tool: 'bash', pattern: '^git\\s+(?:diff|show)\\b', title: 'Show git diff', summary: '{cmd}' },
  { id: 'exec-read-file-pwsh-raw-utf8', label: 'PowerShell UTF-8 read', enabled: true, tool: 'exec_command', pattern: '\\bGet-Content\\b(?=[\\s\\S]*\\b-Raw\\b)(?=[\\s\\S]*\\b-Encoding\\s+UTF8\\b)', title: 'Read file', summary: '{path}' },
  { id: 'exec-read-file', label: 'Read file', enabled: true, tool: 'exec_command', pattern: '^(?:Get-Content|gc|cat|type|sed\\s+-n)\\b', title: 'Read file', summary: '{path}' },
  { id: 'exec-rg-files', label: 'List project files', enabled: true, tool: 'exec_command', pattern: '^rg\\s+--files\\b', title: 'List files', summary: '{path}' },
  { id: 'exec-search-text', label: 'Search text', enabled: true, tool: 'exec_command', pattern: '^(?:rg|grep|findstr)\\b', title: 'Search text', summary: '{query} {path}' },
  { id: 'exec-list-dir', label: 'List directory', enabled: true, tool: 'exec_command', pattern: '^(?:Get-ChildItem|gci|ls|dir)\\b', title: 'List directory', summary: '{path}' },
  { id: 'exec-verification', label: 'Run verification', enabled: true, tool: 'exec_command', pattern: '^(?:npm|pnpm|yarn)\\s+(?:run\\s+)?(?:test|check|lint|typecheck)\\b|^node\\s+--test\\b|^(?:npx\\s+)?(?:pytest|vitest|jest)\\b|^(?:npx\\s+)?playwright\\s+test\\b', title: 'Run verification', summary: '{cmd}' },
  { id: 'exec-build', label: 'Build or typecheck', enabled: true, tool: 'exec_command', pattern: '^(?:npm|pnpm|yarn)\\s+(?:run\\s+)?build\\b|^(?:npx\\s+)?tsc\\b|^cargo\\s+build\\b|^go\\s+test\\b|^mvn\\s+test\\b|^gradle\\s+test\\b', title: 'Build / typecheck', summary: '{cmd}' },
  { id: 'exec-git-status', label: 'Git status', enabled: true, tool: 'exec_command', pattern: '^git\\s+status\\b', title: 'Show git status', summary: '{cmd}' },
  { id: 'exec-git-diff', label: 'Git diff', enabled: true, tool: 'exec_command', pattern: '^git\\s+(?:diff|show)\\b', title: 'Show git diff', summary: '{cmd}' },
  { id: 'apply-patch', label: 'Apply patch', enabled: true, tool: 'apply_patch', pattern: '[\\s\\S]*', title: 'Modify files', summary: '{path}' },
  { id: 'tool-search', label: 'Search tools', enabled: true, tool: 'tool_search_tool', pattern: '[\\s\\S]*', title: 'Search available tools', summary: '{query}' },
  { id: 'pi-bash-command', label: 'Run command', enabled: true, tool: 'bash', pattern: '[\\s\\S]*', title: 'Run command', summary: '{cmd}' },
]

export function findRuleMatch(rules, context) {
  const text = [context.command, context.argumentText, context.summary, context.title].filter(Boolean).join('\n')
  for (const rule of rules) {
    if (!toolMatches(rule.tool, context.toolName)) continue
    const pattern = compilePattern(rule.pattern)
    if (!pattern) continue
    const match = pattern.exec(text)
    if (match) return { rule, match }
  }
  return null
}

function compilePattern(pattern) {
  const text = String(pattern || '')
  if (!text) return null
  try {
    const slash = text.match(/^\/([\s\S]+)\/([a-z]*)$/i)
    if (slash) return new RegExp(slash[1], slash[2].includes('i') ? slash[2] : `${slash[2]}i`)
    return new RegExp(text, 'is')
  } catch { return null }
}

function toolMatches(ruleTool, toolName) {
  const rule = String(ruleTool || '').trim()
  if (!rule || rule === '*') return true
  const tool = String(toolName || '').trim()
  const slash = rule.match(/^\/([\s\S]+)\/([a-z]*)$/i)
  if (slash) {
    try { return new RegExp(slash[1], slash[2].includes('i') ? slash[2] : `${slash[2]}i`).test(tool) } catch { return false }
  }
  return rule.toLowerCase() === tool.toLowerCase()
}

export function summarizeToolContext(context = {}, options = {}) {
  const matched = findRuleMatch(options.rules || defaultSummaryRules, context)
  const fallbackTitle = options.fallbackTitle || context.toolName || 'Tool call'
  if (!matched) {
    const summary = firstLine(context.command || context.argumentText || context.summary || context.output, 220)
    return { matched: false, title: fallbackTitle, summary, command: context.command || '', toolName: context.toolName || '', ruleId: null, ruleLabel: '', path: context.path || '', query: context.query || '' }
  }
  const vars = { ...context, tool: context.toolName, cmd: context.command, match: matched.match[0] || '' }
  for (const [index, value] of matched.match.entries()) vars[`match${index}`] = value || ''
  if (matched.match.groups) for (const [key, value] of Object.entries(matched.match.groups)) vars[key] = value || ''
  const title = cleanTemplateOutput(fillTemplate(matched.rule.title, vars)) || fallbackTitle
  const summary = cleanTemplateOutput(fillTemplate(matched.rule.summary, { ...vars, title })) || context.path || context.query || firstLine(context.command || context.argumentText || context.summary, 220)
  return {
    matched: true,
    title,
    summary: firstLine(summary, 220),
    command: context.command,
    toolName: context.toolName,
    ruleId: matched.rule.id,
    ruleLabel: matched.rule.label || matched.rule.id,
    path: context.path,
    query: context.query,
  }
}

// Builds the summary context for a trajectory tool cell. Raw arguments and
// output never participate in protocol parsing beyond these context fields.
export function toolContextForCell(cell) {
  const args = cell?.raw?.call?.arguments
  const argumentText = typeof args === 'string' ? args : args != null ? safeJson(args) : ''
  const parsed = args && typeof args === 'object' && !Array.isArray(args) ? args : parseMaybeJson(argumentText)
  const toolName = String(cell?.toolName || '')
  const command = extractCommand(parsed, argumentText, toolName)
  return {
    toolName,
    argumentText,
    command,
    path: extractArgumentPath(parsed) || extractCommandPath(command, toolName),
    query: extractQuery(command, parsed, argumentText, toolName),
    tasks: subagentTasksLabel(parsed),
    output: String(cell?.result ?? ''),
  }
}

// "tester, builder" style label for subagent batches, instead of raw JSON.
function subagentTasksLabel(parsed) {
  const list = Array.isArray(parsed?.tasks) ? parsed.tasks : Array.isArray(parsed?.chain) ? parsed.chain : null
  if (!list) return typeof parsed?.agent === 'string' ? parsed.agent : ''
  return list.map((task) => task?.agent || task?.task).filter(Boolean).join(', ')
}

export function summarizeToolCell(cell, options = {}) {
  return summarizeToolContext(toolContextForCell(cell), { ...options, fallbackTitle: options.fallbackTitle || cell?.toolName || cell?.text || 'Tool call' })
}

const safeJson = (value) => { try { return JSON.stringify(value) } catch { return String(value) } }

// Custom rule management, ported from public/models/summary-rules.js: custom
// rules run before the built-ins, invalid rules are filtered out, and the list
// persists in localStorage.
export const rulesStorageKey = 'pi-trajectory.tool-rules.v1'

export function normalizeRules(rules) {
  if (!Array.isArray(rules)) return []
  return rules
    .map((rule, index) => ({
      id: String(rule?.id || `custom-${index}`),
      label: String(rule?.label || rule?.title || 'Custom rule').trim() || 'Custom rule',
      enabled: rule?.enabled !== false,
      tool: String(rule?.tool || '').trim(),
      pattern: String(rule?.pattern || '').trim(),
      title: String(rule?.title || '').trim(),
      summary: String(rule?.summary || '').trim(),
    }))
    .filter((rule) => rule.pattern && rule.title)
}

export function validateRules(rules) {
  if (!Array.isArray(rules)) return []
  return rules.flatMap((rule, index) => {
    const errors = []
    if (!String(rule?.title || '').trim()) errors.push({ index, field: 'title', message: 'Title template is required.' })
    if (!String(rule?.pattern || '').trim()) errors.push({ index, field: 'pattern', message: 'Match pattern is required.' })
    else if (compilePattern(rule.pattern) === null) errors.push({ index, field: 'pattern', message: 'Not a valid JavaScript RegExp.' })
    const tool = String(rule?.tool || '').trim()
    const slash = tool.match(/^\/([\s\S]+)\/([a-z]*)$/i)
    if (slash) {
      try { new RegExp(slash[1], slash[2].includes('i') ? slash[2] : `${slash[2]}i`) } catch { errors.push({ index, field: 'tool', message: 'Not a valid JavaScript RegExp.' }) }
    }
    return errors
  })
}

export function activeRules(customRules) {
  return [...normalizeRules(customRules), ...defaultSummaryRules].filter((rule) => rule.enabled !== false)
}

export function loadStoredRules() {
  if (typeof localStorage === 'undefined') return []
  try { return normalizeRules(JSON.parse(localStorage.getItem(rulesStorageKey) ?? '[]')) } catch { return [] }
}

export function storeRules(rules) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(rulesStorageKey, JSON.stringify(normalizeRules(rules))) } catch { /* Storage may be disabled. */ }
}


function parseMaybeJson(value) {
  if (value && typeof value === 'object') return value
  const text = String(value || '').trim()
  if (!/^[{[]/.test(text)) return null
  try { return JSON.parse(text) } catch { return null }
}

export function extractCommand(parsedArgs, argumentText, toolName = '') {
  if (parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)) {
    for (const key of ['cmd', 'command', 'script', 'shellCommand', 'code', 'query']) {
      if (parsedArgs[key] != null && typeof parsedArgs[key] !== 'object') return String(parsedArgs[key]).trim()
    }
  }
  if (/apply_patch/i.test(toolName)) return firstLine(argumentText, 260)
  return String(argumentText || '').trim()
}

function extractCommandPath(command, toolName) {
  const text = commandForSummary(command, toolName)
  const tokens = shellTokens(stripShellWrapper(text))
  if (!tokens.length) return ''
  const commandName = commandBase(tokens[0])
  if (/^(Get-Content|gc|cat|type)$/i.test(commandName)) return extractPowerShellPath(tokens)
  if (/^(Get-ChildItem|gci|ls|dir)$/i.test(commandName)) return extractLastNonOption(tokens.slice(1), { defaultValue: '.' })
  if (/^(rg|grep|findstr)$/i.test(commandName)) return extractSearchPath(tokens)
  if (/^sed$/i.test(commandName)) return extractLastNonOption(tokens.slice(1))
  return ''
}

function extractPowerShellPath(tokens) {
  for (let index = 1; index < tokens.length; index += 1) {
    if (/^-(?:LiteralPath|Path)$/i.test(tokens[index]) && tokens[index + 1]) return stripOuterQuotes(tokens[index + 1])
  }
  return extractLastNonOption(tokens.slice(1), { valueOptions: new Set(['-encoding', '-filter', '-include', '-exclude', '-totalcount', '-tail']) })
}

function extractArgumentPath(parsedArgs) {
  if (!parsedArgs || typeof parsedArgs !== 'object' || Array.isArray(parsedArgs)) return ''
  for (const key of ['path', 'filePath', 'filepath', 'targetPath', 'outputPath']) {
    if (typeof parsedArgs[key] === 'string' && parsedArgs[key].trim()) return stripOuterQuotes(parsedArgs[key].trim())
  }
  return ''
}

function extractSearchPath(tokens) {
  const commandName = commandBase(tokens[0]).toLowerCase()
  const rest = tokens.slice(1)
  const valueOptions = new Set(['-g', '--glob', '-t', '--type', '-e', '--regexp', '-m', '--max-count', '-A', '-B', '-C'])
  const candidates = nonOptionTokens(rest, { valueOptions })
  if (commandName === 'rg' && rest.includes('--files')) return candidates.at(-1) || '.'
  if (candidates.length <= 1) return ''
  return candidates.slice(1).join(' ')
}

function extractQuery(command, parsedArgs, summary, toolName) {
  if (parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)) {
    for (const key of ['query', 'q', 'pattern', 'search', 'tasks']) {
      if (parsedArgs[key]) return firstLine(typeof parsedArgs[key] === 'string' ? parsedArgs[key] : safeJson(parsedArgs[key]), 120)
    }
  }
  const tokens = shellTokens(stripShellWrapper(commandForSummary(command, toolName)))
  const commandName = commandBase(tokens[0] || '').toLowerCase()
  if (['rg', 'grep', 'findstr'].includes(commandName)) {
    const candidates = nonOptionTokens(tokens.slice(1), { valueOptions: new Set(['-g', '--glob', '-t', '--type', '-e', '--regexp', '-m', '--max-count', '-A', '-B', '-C']) })
    return firstLine(candidates.find((token) => token !== '--files') || '', 120)
  }
  return firstLine(summary, 120)
}

function extractLastNonOption(tokens, options = {}) {
  const candidates = nonOptionTokens(tokens, options)
  return stripOuterQuotes(candidates.at(-1) || options.defaultValue || '')
}

function nonOptionTokens(tokens, options = {}) {
  const valueOptions = options.valueOptions || new Set()
  const result = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token || token === '|' || token === '&&' || token === ';') continue
    if (token.startsWith('-')) {
      if (valueOptions.has(token.toLowerCase()) && tokens[index + 1]) index += 1
      continue
    }
    result.push(stripOuterQuotes(token))
  }
  return result
}

function commandForSummary(command, toolName = '') {
  const commands = String(command || '')
    .split(/\s(?:&&|\|\||[|;])\s?/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (/^bash$/i.test(toolName)) return commands.find((part) => /^rg\b/i.test(stripShellWrapper(part))) || commands[0] || ''
  return commands[0] || ''
}

function stripShellWrapper(command) {
  return String(command || '')
    .trim()
    .replace(/^(?:cmd(?:\.exe)?\s+\/[cs]\s+|powershell(?:\.exe)?\s+(?:-[\w-]+\s+)*|pwsh(?:\.exe)?\s+(?:-[\w-]+\s+)*)/i, '')
    .replace(/^["'](.+)["']$/s, '$1')
    .trim()
}

function shellTokens(command) {
  const tokens = []
  let token = ''
  let quote = null
  for (const char of String(command || '')) {
    if (quote) {
      if (char === quote) quote = null
      else token += char
      continue
    }
    if (char === '\'' || char === '"') { quote = char; continue }
    if (/\s/.test(char)) {
      if (token) tokens.push(token)
      token = ''
      continue
    }
    token += char
  }
  if (token) tokens.push(token)
  return tokens
}

const commandBase = (value) => String(value || '').split(/[\\/]+/).at(-1) || ''
const stripOuterQuotes = (value) => String(value || '').replace(/^["'](.+)["']$/s, '$1')

export function firstLine(text, max = 160) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, Math.max(1, max - 1))}…` : normalized
}

export function fillTemplate(template, vars) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])))
}

export function cleanTemplateOutput(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\s+([：:，,。;；])/g, '$1').replace(/([：:，,;；])\s*$/g, '').trim()
}
