// Pi-specific semantics, extracted from the codex-session-renderer pi adapter
// (src/pi-context-events.mjs, src/embedded-subagents.mjs, src/pi-goal-projection.mjs
// and src/core/turn-model.mjs) and reshaped for the trajectory cells parser.js produces.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizePath = (value) => String(value || '').trim().replaceAll('\\', '/').replace(/\/+$/, '')

const attributeValue = (attributes, name) => new RegExp(`(?:^|\\s)${name}="([^"]+)"(?:\\s|$)`).exec(String(attributes || ''))?.[1]?.trim() || ''

const parseObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null } catch { return null }
}

const stringValue = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

const finiteNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) { const number = Number(value); return Number.isFinite(number) ? number : null }
  return null
}

const integerOrNull = (value) => (Number.isInteger(value) ? value : null)

// Joins pi message content blocks into the plain text the renderer displays.
export function piContentText(content) {
  if (Array.isArray(content)) {
    return content.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('\n')
  }
  return typeof content === 'string' ? content : ''
}

// <skill name="…" location="…">instruction</skill> plus the user text after the block.
export function parsePiSkillInstruction(text) {
  const source = String(text || '')
  const opening = /^\s*<skill\s+([^>]+)>/.exec(source)
  if (!opening) return null
  const name = attributeValue(opening[1], 'name')
  const location = attributeValue(opening[1], 'location')
  if (!name || !location) return null
  const closingOffset = source.indexOf('</skill>', opening[0].length)
  if (closingOffset < 0) return null
  return {
    name,
    instruction: source.slice(opening[0].length, closingOffset).trim(),
    userText: source.slice(closingOffset + '</skill>'.length).trim(),
    sourceFile: 'SKILL.md',
    locationKey: normalizePath(location),
  }
}

// A read tool call whose target is a SKILL.md file marks a skill definition load.
export function piSkillReadFromToolCall(toolName, args) {
  if (String(toolName || '') !== 'read') return null
  const parsed = parseObject(args)
  const normalized = normalizePath(typeof parsed?.path === 'string' ? parsed.path : '')
  if (!normalized || normalized.split('/').at(-1)?.toLowerCase() !== 'skill.md') return null
  return { sourceFile: 'SKILL.md', skillNameHint: normalized.split('/').at(-2) || null, locationKey: normalized }
}

// A subagent tool call declares a batch of tasks in single, parallel or chain mode.
export function parsePiSubagentCall(args) {
  const parsed = parseObject(args)
  if (!parsed) return null
  const mode = requestedMode(parsed)
  const requested = requestedEntries(parsed, mode)
  if (!requested.length && !stringValue(parsed.mode)) return null
  return {
    source: 'pi-agent',
    mode,
    agentScope: stringValue(parsed.agentScope) || '',
    requested,
    results: [],
    status: 'pending',
    chainStopped: false,
    returnInfo: { recorded: false, text: '', error: null, cancelled: false, hasStructuredResults: false },
    evidence: evidenceState(false, 0, requested.length, 0, null),
  }
}

// Consumes the paired toolResult row of a subagent call and projects the batch state.
export function projectPiSubagentResult(batch, resultRow) {
  if (!batch || batch.source !== 'pi-agent') return batch || null
  const details = resultRow?.message?.details ?? null
  const rawResults = Array.isArray(details?.results) ? details.results : []
  const output = piContentText(resultRow?.message?.content)
  const returnInfo = returnProjection(resultRow, output, rawResults.length > 0)
  const results = rawResults.map((result, index) => resultProjection(result, index, batch)).filter(Boolean)
  const mode = validMode(stringValue(details?.mode)) || batch.mode
  const next = {
    ...batch,
    mode,
    agentScope: stringValue(details?.agentScope) || batch.agentScope,
    results,
    chainStopped: mode === 'chain' && results.some((result) => ['failed', 'rate_limited', 'cancelled'].includes(result.status)),
    returnInfo,
  }
  next.evidence = evidenceState(true, results.length, batch.requested?.length || 0, associatedResultCount(results), returnInfo)
  return { ...next, status: batchStatus(next) }
}

function requestedMode(args) {
  const explicit = validMode(stringValue(args.mode))
  if (explicit) return explicit
  if (Array.isArray(args.chain) && args.chain.length) return 'chain'
  if (Array.isArray(args.tasks) && args.tasks.length) return 'parallel'
  return 'single'
}

function requestedEntries(args, mode) {
  const values = mode === 'chain' ? args.chain : mode === 'parallel' ? args.tasks : [args]
  if (!Array.isArray(values)) return []
  return values.map((value, index) => requestedTask(value, index, mode)).filter(Boolean)
}

function requestedTask(value, index, mode) {
  if (!value || typeof value !== 'object') return null
  const agent = stringValue(value.agent)
  const task = stringValue(value.task)
  const cwd = stringValue(value.cwd)
  const taskId = stringValue(value.taskId) || stringValue(value.id)
  return agent || task || cwd
    ? {
        index,
        ...(mode === 'chain' ? { step: index + 1 } : {}),
        ...(taskId ? { taskId } : {}),
        agent: agent || 'Unspecified agent',
        task: task || null,
        ...(cwd ? { cwd } : {}),
      }
    : null
}

function resultProjection(value, index, batch) {
  if (!value || typeof value !== 'object') return null
  const failure = resultFailure(value)
  const stopReason = stringValue(value.stopReason)
  const exitCode = finiteNumber(value.exitCode)
  const texts = finalAssistantTexts(value.messages)
  const error = failure || null
  const taskId = stringValue(value.taskId) || stringValue(value.id)
  const step = integerOrNull(value.step)
  const summary = error || texts.join('\n\n')
  return {
    resultIndex: index,
    ...(step != null ? { step } : {}),
    ...(taskId ? { taskId } : {}),
    requestedIndex: associateRequestedIndex(value, index, batch),
    agent: stringValue(value.agent) || 'Unspecified agent',
    agentSource: stringValue(value.agentSource),
    task: stringValue(value.task),
    model: stringValue(value.model),
    status: resultStatus({ failure, stopReason, exitCode }),
    exitCode,
    stopReason,
    summary,
    summaryLength: String(summary || '').length,
    texts,
    error,
  }
}

function resultStatus({ failure, stopReason, exitCode }) {
  if (failure) return /(?:^|\D)429(?:\D|$)|rate.?limit/i.test(failure) ? 'rate_limited' : 'failed'
  if (['aborted', 'cancelled', 'canceled'].includes(stopReason)) return 'cancelled'
  if (stopReason === 'error' || (exitCode != null && exitCode !== 0 && exitCode !== -1)) return 'failed'
  if (exitCode === 0 || stopReason === 'stop') return 'succeeded'
  return 'unknown'
}

function associateRequestedIndex(value, index, batch) {
  const requested = batch.requested || []
  const taskId = stringValue(value.taskId) || stringValue(value.id)
  if (taskId) return requested.find((task) => task.taskId === taskId)?.index ?? null
  const step = integerOrNull(value.step)
  if (step != null) return requested.find((task) => task.step === step)?.index ?? null
  return requested[index]?.index ?? null
}

function returnProjection(resultRow, output, hasResults) {
  const text = String(output || '').trim()
  const isInvalidRequest = /^Invalid parameters\./i.test(text)
  const isError = resultRow?.message?.isError === true
  const isCancellation = /^(?:Canceled|Cancelled|Aborted)(?::|\b)/i.test(text)
  const error = isInvalidRequest || isCancellation ? text : isError ? text || 'Tool returned an error without a message.' : null
  return { recorded: true, text, textLength: text.length, error, cancelled: isCancellation, hasStructuredResults: hasResults }
}

function evidenceState(returnRecorded, resultCount, requestedCount, associatedCount = resultCount, returnInfo = null) {
  return {
    returnRecorded,
    resultRecorded: resultCount > 0,
    resultCount,
    requestedCount,
    associatedCount,
    coverage: requestedCount ? associatedCount / requestedCount : resultCount > 0 ? 1 : 0,
    resultMissing: returnRecorded && associatedCount < requestedCount,
    returnKind: returnInfo?.hasStructuredResults ? 'structured' : returnRecorded ? 'text_or_empty' : 'unrecorded',
  }
}

const associatedResultCount = (results) => new Set(results.map((result) => result.requestedIndex).filter((index) => index != null)).size

function batchStatus(batch) {
  const results = batch.results || []
  if (!results.length) {
    if (batch.returnInfo?.error) {
      if (batch.returnInfo.cancelled) return 'cancelled'
      return /^Invalid parameters\./i.test(batch.returnInfo.error) ? 'invalid_request' : 'failed'
    }
    return batch.returnInfo?.recorded ? 'unknown' : 'pending'
  }
  const recorded = new Set(results.map((result) => result.requestedIndex).filter((index) => index != null))
  if ((batch.requested?.length || 0) > recorded.size) return 'partial'
  const statuses = new Set(results.map((result) => result.status))
  return statuses.size === 1 ? results[0].status : 'partial'
}

function resultFailure(result) {
  const direct = stringValue(result.errorMessage) || stringValue(result.error?.message) || stringValue(result.error)
  if (direct) return direct
  for (const message of [...(Array.isArray(result.messages) ? result.messages : [])].reverse()) {
    const error = stringValue(message?.errorMessage) || stringValue(message?.error?.message) || stringValue(message?.error)
    if (error) return error
  }
  return ''
}

function finalAssistantTexts(messages) {
  if (!Array.isArray(messages)) return []
  const final = [...messages].reverse().find((message) => message?.role === 'assistant')
  if (!final) return []
  return (Array.isArray(final.content) ? final.content : [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).filter((text) => text.length > 0)
}

const validMode = (value) => (['single', 'parallel', 'chain'].includes(value) ? value : null)

// Compaction rows keep their pi-specific accounting (tokens before, retained tail).
export function piCompactionOf(row) {
  if (!row || (row.type !== 'compaction' && row.type !== 'branch_summary')) return null
  return {
    source: 'pi',
    kind: row.type === 'compaction' ? 'pi_compaction' : 'branch_summary',
    summary: typeof row.summary === 'string' ? row.summary : piContentText(row.summary) || piContentText(row.message?.content),
    tokensBefore: finiteNumber(row.tokensBefore),
    retainedTailCount: integerOrNull(row.retainedTailCount),
    firstKeptEntryId: stringValue(row.firstKeptEntryId),
    fromHook: row.fromHook === true,
  }
}

// Goal-mode control prompts. The full renderer matches complete prompt templates
// against a goal-state event; trajectory cells no longer carry that event, so
// detection stays on the decisive markers instead of pretending to infer state.
export function piGoalControlOf(text) {
  const source = String(text || '')
  if (!source) return null
  if (source.startsWith('Goal mode is active. Complete this goal fully:')) return { kind: 'start' }
  if (source.startsWith('The active /goal objective was updated.')) return { kind: 'update' }
  const resume = /^The user explicitly resumed the (paused|blocked|usage-limited|budget-limited) \/goal\./.exec(source)
  if (resume) return { kind: 'resume', status: resume[1] }
  if (/<!--\s*pi-goal-continuation:[0-9a-f:-]+\s*-->\s*$/.test(source)) return { kind: 'continuation' }
  return null
}

// Open-turn status, adapted from turn-model.mjs inferOpenTurnStatus. A turn whose
// last record is an unanswered tool call is running; stop reasons map the rest.
export function turnStatusOf(turn) {
  const cells = (turn?.groups ?? []).flatMap((group) => group.cells)
  if (!cells.length) return null
  const last = cells.at(-1)
  if (last.kind === 'tool' && !last.raw?.result) return 'running'
  const assistant = [...cells].reverse().find((cell) => cell.kind === 'message')
  if (!assistant) return cells.some((cell) => cell.kind === 'user') ? 'waiting' : 'context'
  const stopReason = assistant.raw?.message?.stopReason
  if (stopReason === 'error') return 'failed'
  if (['aborted', 'cancelled', 'canceled'].includes(stopReason)) return 'aborted'
  if (stopReason === 'toolUse') return 'running'
  return 'complete'
}
