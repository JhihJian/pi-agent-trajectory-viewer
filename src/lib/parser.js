const textOf = (content) => {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : ''
  return content.filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

const jsonOf = (value) => {
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

const timeOf = (row) => {
  const timestamp = Date.parse(row.timestamp ?? '')
  return Number.isFinite(timestamp) ? timestamp : null
}

const blocksOf = (content) => Array.isArray(content) ? content : []

function activeBranch(rows) {
  const byId = new Map(rows.filter((row) => typeof row.id === 'string').map((row) => [row.id, row]))
  const latest = rows.at(-1)
  if (!latest || typeof latest.id !== 'string') return rows

  const selected = new Set()
  let cursor = latest
  while (cursor) {
    if (typeof cursor.id === 'string') selected.add(cursor.id)
    cursor = typeof cursor.parentId === 'string' ? byId.get(cursor.parentId) : undefined
  }
  return rows.filter((row) => row.type === 'session' || (typeof row.id === 'string' && selected.has(row.id)))
}

function newTurn(turn) { return { turn, groups: [] } }

function ensureTurn(turns, current, number) {
  if (current) return current
  const created = newTurn(number)
  turns.push(created)
  return created
}

function cellBase(kind, row, index, text) {
  const time = timeOf(row)
  return {
    index,
    recordId: row.id,
    raw: row,
    kind,
    text: text || '(empty)',
    sourceSeq: index,
    timeSeconds: null,
    startedAt: time,
  }
}

function usageOf(message) {
  const usage = message?.usage
  if (!usage || typeof usage !== 'object') return {}
  return {
    input: Number.isFinite(usage.input) ? usage.input : undefined,
    output: Number.isFinite(usage.output) ? usage.output : undefined,
    cacheRead: Number.isFinite(usage.cacheRead) ? usage.cacheRead : undefined,
    cacheWrite: Number.isFinite(usage.cacheWrite) ? usage.cacheWrite : undefined,
    think: Number.isFinite(usage.reasoning) ? usage.reasoning : undefined,
  }
}

function assistantText(message) {
  return blocksOf(message?.content).filter((block) => block?.type === 'text')
    .map((block) => block.text).join('\n').trim()
}

function assistantThinking(message) {
  return blocksOf(message?.content).filter((block) => block?.type === 'thinking')
    .map((block) => block.thinking).filter(Boolean).join('\n').trim()
}

/**
 * 增量建 turn 的状态机。`buildRows` 是它的全量用法；尾端优先的分页加载是增量用法：
 * 先 push 尾片的行（turn 编号由索引给），再 push 前面的片。turns 按 turn 编号定位，
 * 前面的片没到时是稀疏数组的空位。toolResult 先于 toolCall 到达时先建孤儿 cell，
 * toolCall 到了再回填并把孤儿挪到 toolCall 所在的 group。
 */
export function createTurnBuilder(turnCount = 0) {
  const turns = turnCount > 0 ? Array.from({ length: turnCount }, () => null) : []
  const tools = new Map()
  // 孤儿 toolResult：toolCallId → cell。回填时按这个找到它。
  const orphans = new Map()
  // 全量模式没有索引，turn 按出现顺序编号；current 是最后一个被 push 过的 turn。
  let current = null
  let step = 0
  let index = 0
  let sparse = turnCount > 0

  const pushGroup = (turn, title, cells) => {
    const group = { title, cells }
    turn.groups.push(group)
    return group
  }

  // 定位 turn：有编号用编号，没有就沿用 current 或建一个新的。
  const ensureTurn = (turnNo) => {
    if (sparse) {
      if (turnNo == null) return current
      if (!turns[turnNo - 1]) turns[turnNo - 1] = newTurn(turnNo)
      current = turns[turnNo - 1]
      return current
    }
    if (turnNo != null && turns[turnNo - 1]) { current = turns[turnNo - 1]; return current }
    if (current) return current
    const created = newTurn(turns.length + 1)
    turns.push(created)
    current = created
    return current
  }

  // toolCall 到达时，如果它的 toolResult 已经先到（孤儿），把孤儿挪进这个 group 并补齐字段。
  const adoptOrphan = (tool, callId, group) => {
    const orphan = orphans.get(callId)
    if (!orphan) return
    orphans.delete(callId)
    const { cell, fromGroup } = orphan
    const at = fromGroup.cells.indexOf(cell)
    if (at >= 0) fromGroup.cells.splice(at, 1)
    Object.assign(tool, {
      outputDetail: cell.outputDetail, result: cell.result, outputBlocks: cell.outputBlocks,
      isError: cell.isError, timeSeconds: cell.timeSeconds,
      raw: { ...tool.raw, result: cell.raw?.result },
    })
    // group.cells.push(tool) 由调用方做；这里只负责把孤儿挪走、把空 group 删掉。
    const owner = turns.find((t) => t?.groups?.includes(fromGroup))
    if (owner && fromGroup !== group && fromGroup.cells.length === 0) owner.groups.splice(owner.groups.indexOf(fromGroup), 1)
  }

  // 增量模式下 index 由行号推出：一个 assistant 行可能带多个 toolCall，各占一个 index，
  // 所以留 1000 的间隔。全量模式沿用计数器，与历史行为一致。
  const nextIndex = (lineNo, sub = 0) => {
    if (sparse && lineNo != null) return lineNo * 1000 + sub
    index += 1
    return index
  }

  const push = (row, turnNo, lineNo) => {
    if (row.type === 'message' && row.message?.role === 'user') {
      step = 0
      // user 行无条件开新 turn。增量模式按编号定位（同一行不会 push 两次），全量模式按顺序追加。
      let turn
      if (sparse) {
        turn = turns[turnNo - 1] ?? (turns[turnNo - 1] = newTurn(turnNo))
      } else {
        turn = newTurn(turns.length + 1)
        turns.push(turn)
      }
      current = turn
      index = nextIndex(lineNo)
      const content = textOf(row.message.content)
      const cell = {
        ...cellBase('user', row, index, content),
        inputDetail: content,
        sourceBlocks: blocksOf(row.message.content).map((block) => ({ type: block.type, content: jsonOf(block) })),
      }
      pushGroup(turn, 'User', [cell])
      return
    }

    if (row.type === 'message' && row.message?.role === 'assistant') {
      const turn = ensureTurn(turnNo)
      step += 1
      index = nextIndex(lineNo)
      const message = row.message
      const output = assistantText(message)
      const thinking = assistantThinking(message)
      const calls = blocksOf(message.content).filter((block) => block?.type === 'toolCall')
      const duration = Number.isFinite(message.durationMs) ? message.durationMs / 1000 : null
      const cell = {
        ...cellBase('message', row, index, output || (thinking ? 'Thinking' : 'Assistant response')),
        ...usageOf(message),
        outputDetail: output,
        thinkingDetail: thinking,
        timeSeconds: duration,
        sourceBlocks: blocksOf(message.content).map((block) => ({
          type: block.type,
          content: block.type === 'text' ? block.text : block.type === 'thinking' ? block.thinking : jsonOf(block),
          callId: block.id,
          toolName: block.name,
        })),
        assistantMetrics: {
          timingRecorded: false,
          stepStartTime: null,
          firstTokenTime: null,
          completedTime: null,
          usageProvided: Boolean(message.usage),
          outputTokens: Number.isFinite(message.usage?.output) ? message.usage.output : null,
        },
      }
      const group = pushGroup(turn, `Step ${step}`, [cell])
      for (const call of calls) {
        const tool = {
          ...cellBase('tool', row, nextIndex(lineNo, 1 + calls.indexOf(call)), call.name || 'Tool call'),
          recordId: call.id || `${row.id ?? 'record'}:tool:${index}`,
          raw: { assistant: row, call },
          text: call.name || 'Tool call',
          callId: call.id,
          toolName: call.name,
          inputDetail: jsonOf(call.arguments),
          sourceBlocks: [{ type: 'toolCall', content: jsonOf(call.arguments), callId: call.id, toolName: call.name }],
          timeSeconds: null,
        }
        group.cells.push(tool)
        tools.set(call.id, tool)
        adoptOrphan(tool, call.id, group)
      }
      return
    }

    if (row.type === 'message' && row.message?.role === 'toolResult') {
      const result = row.message
      const tool = tools.get(result.toolCallId)
      const output = textOf(result.content) || jsonOf(result.content)
      if (tool) {
        tool.outputDetail = output
        tool.result = output
        tool.outputBlocks = blocksOf(result.content).map((block) => ({ type: block.type, content: jsonOf(block) }))
        tool.raw = { ...tool.raw, result: row }
        tool.isError = result.isError === true
        const completedAt = timeOf(row)
        tool.timeSeconds = Number.isFinite(result.durationMs)
          ? result.durationMs / 1000
          : Number.isFinite(tool.startedAt) && Number.isFinite(completedAt)
            ? Math.max(0, (completedAt - tool.startedAt) / 1000)
            : null
      } else {
        const turn = ensureTurn(turnNo)
        index = nextIndex(lineNo, 1)
        const cell = {
          ...cellBase('tool', row, index, result.toolName || 'Tool result'),
          raw: { result: row },
          recordId: result.toolCallId || row.id || `tool:${index}`,
          callId: result.toolCallId,
          toolName: result.toolName,
          outputDetail: output,
          result: output,
          isError: result.isError === true,
          outputBlocks: blocksOf(result.content).map((block) => ({ type: block.type, content: jsonOf(block) })),
          timeSeconds: Number.isFinite(result.durationMs) ? result.durationMs / 1000 : null,
        }
        const group = pushGroup(turn, `Step ${step || 1}`, [cell])
        // 尾端优先时 toolResult 可能先于 toolCall 到达。记下来，toolCall 来了回填。
        if (sparse && result.toolCallId) orphans.set(result.toolCallId, { cell, fromGroup: group })
      }
      return
    }

    if (row.type === 'compaction' || row.type === 'branch_summary') {
      const turn = ensureTurn(turnNo)
      index = nextIndex(lineNo)
      const summary = textOf(row.summary) || textOf(row.message?.content) || row.type
      pushGroup(turn, 'Context', [{
        ...cellBase('compacted', row, index, summary),
        inputDetail: summary,
        outputDetail: summary,
      }])
    }
  }

  const finish = () => {
    // 增量模式下片是倒序到达的，group 的插入顺序不等于文件顺序。按首个 cell 的 index 排，
    // 再按文件顺序重编 Step 号：push 时只知道「已到达的」，尾端先到会把 a3 编成 Step 1。
    if (sparse) {
      for (const t of turns) {
        if (!t) continue
        t.groups.sort((a, b) => (a.cells[0]?.index ?? 0) - (b.cells[0]?.index ?? 0))
        let n = 0
        for (const g of t.groups) {
          if (g.cells[0]?.kind === 'message') g.title = `Step ${++n}`
          else if (g.cells[0]?.kind === 'tool' && g.title.startsWith('Step')) g.title = `Step ${Math.max(1, n)}`
        }
      }
    }
    return turns.filter(Boolean)
  }

  return { push, finish, turns }
}

function buildRows(rows) {
  const builder = createTurnBuilder(0)
  for (const row of rows) builder.push(row)
  return builder.finish()
}

// Invalid lines become diagnostics instead of aborting the parse, so a damaged
// session still renders; without a session header the first invalid line keeps
// raising the original error.
export function parsePiJsonl(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) throw new Error('文件为空')
  const rows = []
  const diagnostics = []
  lines.forEach((line, lineIndex) => {
    try { rows.push(JSON.parse(line)) }
    catch { diagnostics.push({ type: 'jsonl_parse_error', lineNumber: lineIndex + 1, code: 'invalid_json', preview: line.slice(0, 160) }) }
  })
  const header = rows.find((row) => row.type === 'session')
  if (!header) {
    const invalid = diagnostics[0]
    throw new Error(invalid ? `第 ${invalid.lineNumber} 行不是有效 JSON` : '不是 Pi Agent session JSONL：缺少 type=session 首行')
  }
  const branch = activeBranch(rows)
  const turns = buildRows(branch)
  const messages = branch.filter((row) => row.type === 'message').length
  return {
    header,
    rows: branch,
    diagnostics,
    turns,
    stats: {
      lines: rows.length,
      activeLines: branch.length,
      messages,
      turns: turns.length,
      tools: turns.flatMap((turn) => turn.groups.flatMap((group) => group.cells)).filter((cell) => cell.kind === 'tool').length,
      diagnostics: diagnostics.length,
    },
  }
}

export function formatTime(value) {
  if (!Number.isFinite(value)) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`
}
