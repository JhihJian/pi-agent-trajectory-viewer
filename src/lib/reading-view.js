// Reading thread projection, adapted from the codex-session-renderer compact
// view (src/session-compact-reading-projection.mjs and public/views/compact-*.js):
// a turn-based reading flow where skill instructions, goal control prompts and
// compaction events become context cards instead of raw records.

import {
  parsePiSkillInstruction, piSkillReadFromToolCall, parsePiSubagentCall, projectPiSubagentResult,
  piCompactionOf, piGoalControlOf, turnStatusOf,
} from './pi-semantics.js'
import { summarizeToolCell } from './tool-summaries.js'

const usageKeys = ['input', 'output', 'cacheRead', 'cacheWrite', 'think']

const usageOf = (cell) => Object.fromEntries(usageKeys.filter((key) => Number.isFinite(cell[key])).map((key) => [key, cell[key]]))

export function projectReadingTurns(turns, options = {}) {
  return (turns ?? []).map((turn) => ({ turn: turn.turn, status: turnStatusOf(turn), cards: readingCards(turn, options) }))
}

function readingCards(turn, options = {}) {
  const cards = []
  for (const group of turn.groups) {
    // 一条 assistant 消息和它的工具调用在同一个 group 里。先数出这一组有几个
    // 工具调用，助手卡才知道自己这一步是「只调工具、没有文本」还是真的空记录。
    const toolCount = group.cells.filter((cell) => cell.kind === 'tool').length
    for (const cell of group.cells) {
      if (cell.kind === 'user') {
        const skill = parsePiSkillInstruction(cell.text === '(empty)' ? '' : cell.text)
        if (skill) {
          cards.push({ kind: 'context', contextKind: 'skill-declaration', cell, skill: { name: skill.name, locationKey: skill.locationKey, sourceFile: skill.sourceFile }, instruction: skill.instruction, userText: skill.userText })
          if (skill.userText) cards.push({ kind: 'user', cell, text: skill.userText })
          continue
        }
        const goal = piGoalControlOf(cell.text)
        if (goal) cards.push({ kind: 'context', contextKind: 'goal', cell, goal })
        else cards.push({ kind: 'user', cell, text: cell.text })
        continue
      }
      if (cell.kind === 'message') {
        cards.push({ kind: 'assistant', cell, text: cell.outputDetail || '', thinking: cell.thinkingDetail || '', usage: usageOf(cell), toolCount })
        continue
      }
      if (cell.kind === 'tool') {
        const card = {
          kind: 'tool',
          cell,
          summary: summarizeToolCell(cell, { rules: options.rules }),
          batch: subagentBatch(cell),
          skillRead: piSkillReadFromToolCall(cell.toolName, cell.raw?.call?.arguments),
          isError: cell.isError === true,
          hasResult: Boolean(cell.raw?.result),
          durationSeconds: cell.timeSeconds,
        }
        cards.push(card)
        continue
      }
      if (cell.kind === 'compacted') cards.push({ kind: 'context', contextKind: 'compaction', cell, compact: piCompactionOf(cell.raw) ?? {} })
    }
  }
  return cards
}

function subagentBatch(cell) {
  const batch = parsePiSubagentCall(cell.raw?.call?.arguments)
  if (!batch) return null
  return cell.raw?.result ? projectPiSubagentResult(batch, cell.raw.result) : batch
}

const cardText = (card) => [
  card.text, card.instruction, card.userText, card.skill?.name, card.goal?.kind,
  card.summary?.title, card.summary?.summary, card.cell?.toolName, card.cell?.result, card.compact?.summary,
].filter(Boolean).join(' ')

// Multi-word AND filter over the rendered card text, mirroring matchesSearch.
export function filterReadingTurns(readingTurns, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return readingTurns
  const words = needle.split(/\s+/)
  return readingTurns
    .map((readingTurn) => ({ ...readingTurn, cards: readingTurn.cards.filter((card) => { const text = cardText(card).toLowerCase(); return words.every((word) => text.includes(word)) }) }))
    .filter((readingTurn) => readingTurn.cards.length > 0)
}

const firstLineOf = (value, limit = 80) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit) || ''

// Outline directory for the reading view, adapted from the codex-session-renderer
// compact outline (public/controllers/compact-outline.js): the session root, one
// entry per turn with its title, and the context events nested under each turn.
export function projectReadingOutline(readingTurns, title = 'Session') {
  return {
    title,
    turns: readingTurns.map((readingTurn) => ({
      turn: readingTurn.turn,
      status: readingTurn.status,
      title: outlineTurnTitle(readingTurn.cards),
      context: readingTurn.cards
        .filter((card) => card.kind === 'context')
        .map((card) => ({ kind: card.contextKind, label: outlineContextLabel(card) })),
      subagentCount: readingTurn.cards.filter((card) => card.batch).length,
      compaction: readingTurn.cards.some((card) => card.contextKind === 'compaction'),
    })),
  }
}

function outlineTurnTitle(cards) {
  const user = cards.find((card) => card.kind === 'user')
  const assistant = cards.find((card) => card.kind === 'assistant')
  return firstLineOf(user?.text) || firstLineOf(assistant?.text) || '(no readable text)'
}

function outlineContextLabel(card) {
  if (card.contextKind === 'compaction') return `Compaction${Number.isFinite(card.compact?.tokensBefore) ? ` · ${card.compact.tokensBefore} tokens` : ''}`
  if (card.contextKind === 'skill-declaration') return `Skill · ${card.skill?.name ?? 'unnamed'}`
  return 'Goal control message'
}

