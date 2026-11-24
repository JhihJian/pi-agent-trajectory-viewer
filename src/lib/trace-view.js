// Execution tree projection, adapted from the codex-session-renderer trace view
// (src/core/trace-model.mjs and public/views/trace-content.js): every turn becomes
// an ordered item list with summarized tool nodes, plus an honest plain-text
// execution report that can be handed to another agent.

import { parsePiSubagentCall, projectPiSubagentResult, piCompactionOf, turnStatusOf, parsePiSkillInstruction } from './pi-semantics.js'
import { summarizeToolCell } from './tool-summaries.js'

const usageKeys = ['input', 'output', 'cacheRead', 'cacheWrite', 'think']

const usageOf = (cell) => Object.fromEntries(usageKeys.filter((key) => Number.isFinite(cell[key])).map((key) => [key, cell[key]]))

const oneLine = (value, limit = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)

export function projectTraceTurns(turns, options = {}) {
  return (turns ?? []).map((turn) => {
    const items = traceItems(turn, options)
    return {
      turn: turn.turn,
      status: turnStatusOf(turn),
      items,
      steps: items.filter((item) => item.kind === 'assistant').length,
      calls: items.filter((item) => item.kind === 'tool').length,
      errors: items.filter((item) => item.isError).length,
    }
  })
}

function traceItems(turn, options = {}) {
  const items = []
  let step = 0
  for (const group of turn.groups) {
    for (const cell of group.cells) {
      if (cell.kind === 'user') {
        const skill = parsePiSkillInstruction(cell.text === '(empty)' ? '' : cell.text)
        items.push({ kind: 'user', cell, text: skill ? skill.userText || cell.text : cell.text, skill: skill ? { name: skill.name } : null })
        continue
      }
      if (cell.kind === 'message') {
        step += 1
        items.push({ kind: 'assistant', cell, step, text: cell.outputDetail || '', thinking: cell.thinkingDetail || '', usage: usageOf(cell), durationSeconds: cell.timeSeconds })
        continue
      }
      if (cell.kind === 'tool') {
        const batch = parsePiSubagentCall(cell.raw?.call?.arguments)
        items.push({
          kind: 'tool',
          cell,
          summary: summarizeToolCell(cell, { rules: options.rules }),
          batch: batch && cell.raw?.result ? projectPiSubagentResult(batch, cell.raw.result) : batch,
          isError: cell.isError === true,
          hasResult: Boolean(cell.raw?.result),
          durationSeconds: cell.timeSeconds,
          outputPreview: oneLine(cell.result),
        })
        continue
      }
      if (cell.kind === 'compacted') items.push({ kind: 'context', cell, compact: piCompactionOf(cell.raw) ?? {} })
    }
  }
  return items
}

export function filterTraceTurns(traceTurns, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return traceTurns
  const words = needle.split(/\s+/)
  return traceTurns
    .map((traceTurn) => ({ ...traceTurn, items: traceTurn.items.filter((item) => { const text = itemText(item).toLowerCase(); return words.every((word) => text.includes(word)) }) }))
    .filter((traceTurn) => traceTurn.items.length > 0)
}

const itemText = (item) => [
  item.text, item.summary?.title, item.summary?.summary, item.cell?.toolName, item.outputPreview, item.compact?.summary,
].filter(Boolean).join(' ')

const formatSeconds = (value) => (value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(value < 10 ? 2 : 1)} s`)

// Plain-text execution report for other agents, adapted from
// src/session-execution-export-projection.mjs. Unrecorded facts stay unrecorded.
export function executionReport(turns, header = {}, options = {}) {
  const lines = ['Pi Agent execution report']
  if (header.cwd) lines.push(`cwd: ${header.cwd}`)
  if (header.id) lines.push(`session: ${header.id}`)
  for (const projected of projectTraceTurns(turns, options)) {
    lines.push('', `Turn ${projected.turn} [${projected.status ?? 'unknown'}] · ${projected.steps} steps · ${projected.calls} tool calls${projected.errors ? ` · ${projected.errors} errors` : ''}`)
    for (const item of projected.items) {
      if (item.kind === 'user') lines.push(`  user: ${oneLine(item.text) || '(empty)'}`)
      else if (item.kind === 'assistant') lines.push(`  assistant: ${oneLine(item.text) || '(no text)'}`)
      else if (item.kind === 'context') lines.push(`  context (${item.compact.kind ?? 'summary'}): ${oneLine(item.compact.summary ?? '', 160)}`)
      else {
        const status = !item.hasResult ? 'no result' : item.isError ? 'error' : 'ok'
        const duration = Number.isFinite(item.durationSeconds) ? ` (${formatSeconds(item.durationSeconds)})` : ''
        const detail = item.batch ? '' : item.summary.summary || item.summary.command
        lines.push(`  tool ${item.cell.toolName || item.cell.text}${detail ? ` · ${detail}` : ''} -> ${status}${duration}`)
        if (item.batch) lines.push(`    subagents ${item.batch.status}: ${item.batch.requested.length} requested, ${item.batch.results.length} returned (coverage ${Math.round(item.batch.evidence.coverage * 100)}%)`)
        if (item.isError && item.outputPreview) lines.push(`    error: ${item.outputPreview}`)
      }
    }
  }
  return lines.join('\n')
}
