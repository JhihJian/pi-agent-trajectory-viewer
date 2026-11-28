import React, { memo, useEffect, useMemo, useId, useRef, useState } from 'react'
import { DetailsSplit } from './DetailsSplit.jsx'
import { Markdown } from './Detail.jsx'
import { flattenTurns } from '../lib/trajectory-view.js'
import { filterReadingTurns, projectReadingTurns, projectReadingOutline } from '../lib/reading-view.js'
import { formatDuration, formatTime } from '../lib/parser.js'
import { ReadingOutline, useActiveReadingTurn } from './ReadingOutline.jsx'
import './styles/views.css'

const statusLabels = { complete: 'Complete', running: 'Running', waiting: 'Waiting', failed: 'Failed', aborted: 'Aborted', context: 'Context' }
const goalLabels = { start: 'Goal mode started', update: 'Goal objective updated', resume: 'Goal resumed', continuation: 'Automatic goal continuation' }

function StatusPill({ status }) {
  if (!status || status === 'context') return null
  return <span className="status-pill" data-status={status}><span className="status-dot" aria-hidden="true" />{statusLabels[status] || status}</span>
}

function Thinking({ value }) {
  if (!value) return null
  return <details className="reading-thinking"><summary>Thinking</summary><div className="reading-thinking-body">{value}</div></details>
}

function Usage({ usage }) {
  const parts = [['input', 'in'], ['output', 'out'], ['cacheRead', 'cache'], ['think', 'reasoning']].filter(([key]) => Number.isFinite(usage?.[key]))
  if (!parts.length) return null
  return <span className="reading-usage">{parts.map(([key, label]) => <span key={key}>{label} {usage[key]}</span>)}</span>
}

function UserCard({ card, anchor }) {
  return <section className="reading-card" data-role="user" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
    <div className="reading-card-label"><span className="reading-card-role">User</span><em>{formatTime(card.cell.startedAt)}</em></div>
    <div className="reading-body"><Markdown value={card.text} /></div>
  </section>
}

/**
 * 助手消息的正文。一条 assistant 消息常常只有工具调用、没有文字，这不是坏记录：
 * 把这种情况说成「没有文本」会让人以为数据丢了。只有工具调用时改为说明调了几个，
 * 细节由紧跟其后的工具卡展示；真正的空消息仍然明确标出来。
 */
function assistantBodyNote(card) {
  if (card.toolCount > 0) return `Called ${card.toolCount} tool${card.toolCount === 1 ? '' : 's'}`
  return '(no text recorded)'
}

function AssistantCard({ card, anchor }) {
  return <section className="reading-card" data-role="assistant" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
    <div className="reading-card-label"><span className="reading-card-role">Assistant</span><Usage usage={card.usage} />{Number.isFinite(card.cell.timeSeconds) && <em>{formatDuration(card.cell.timeSeconds)}</em>}<em>{formatTime(card.cell.startedAt)}</em></div>
    <Thinking value={card.thinking} />
    {card.text
      ? <div className="reading-body"><Markdown value={card.text} /></div>
      : <p className="reading-empty-note" title={card.toolCount > 0 ? 'This message carried tool calls instead of text' : 'The recorded message has no text content'}>{assistantBodyNote(card)}</p>}
  </section>
}

function ToolCard({ card, selected, onSelect, anchor }) {
  const batch = card.batch
  const state = !card.hasResult ? 'pending' : card.isError ? 'error' : 'ok'
  return <section className="reading-tool-wrap" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
    <button type="button" className="reading-tool" data-state={state} data-selected={selected || undefined} aria-pressed={selected || undefined} onClick={() => onSelect?.(card.cell)}>
      <span className="status-dot" data-state={state} aria-hidden="true" />
      <span className="reading-tool-title">{card.summary.title}</span>
      {card.summary.summary && <span className="reading-tool-summary">{card.summary.summary}</span>}
      {card.skillRead && <span className="reading-skill-badge" title={card.skillRead.locationKey}>skill</span>}
      {Number.isFinite(card.durationSeconds) && <span className="reading-tool-duration">{formatDuration(card.durationSeconds)}</span>}
      <span className="reading-tool-state">{state === 'pending' ? 'No result' : state === 'error' ? 'Error' : card.cell.result ? '' : 'Empty result'}</span>
    </button>
    {batch && <SubagentBatch batch={batch} onSelect={onSelect} />}
  </section>
}

function SubagentBatch({ batch, onSelect }) {
  const tasks = batch.results.length ? batch.results : batch.requested
  return <div className="reading-batch">
    <div className="reading-batch-head">
      <span className="reading-batch-mode">{batch.mode}</span>
      <span className="status-pill" data-status={batch.status}>{batch.status.replaceAll('_', ' ')}</span>
      <em>{batch.results.length}/{batch.requested.length} returned · coverage {Math.round(batch.evidence.coverage * 100)}%</em>
    </div>
    {tasks.map((task, index) => <div key={task.taskId || task.resultIndex || index} className="reading-batch-task" data-status={task.status || 'requested'}>
      <span className="reading-batch-status">{task.status || 'requested'}</span>
      <strong>{task.agent}</strong>
      <span className="reading-batch-summary" title={task.task || task.summary || ''}>{firstLineOf(task.task || task.summary || '')}</span>
    </div>)}
    {batch.evidence.resultMissing && <div className="reading-batch-missing">Not every requested task has a recorded result.</div>}
  </div>
}

const firstLineOf = (value, limit = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit) || '—'

function ContextCard({ card, anchor }) {
  if (card.contextKind === 'compaction') {
    const compact = card.compact
    const meta = [
      Number.isFinite(compact.tokensBefore) ? `${compact.tokensBefore} tokens before` : '',
      Number.isFinite(compact.retainedTailCount) ? `${compact.retainedTailCount} retained` : '',
      compact.fromHook ? 'from hook' : '',
    ].filter(Boolean).join(' · ')
    return <section className="reading-context" data-context="compaction" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
      <span className="reading-context-icon" aria-hidden="true">C</span>
      <div className="reading-context-content">
        <div className="reading-context-head"><span className="reading-context-title">{compact.kind === 'pi_compaction' ? 'Pi context compaction' : 'Context summary'}</span><em>{meta}</em></div>
        <div className="reading-context-body">{compact.summary ? <Markdown value={compact.summary} /> : <span className="reading-context-missing">This compaction event carries no summary text.</span>}</div>
      </div>
    </section>
  }
  if (card.contextKind === 'skill-declaration') {
    return <section className="reading-context" data-context="skill" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
      <span className="reading-context-icon" aria-hidden="true">S</span>
      <div className="reading-context-content">
        <div className="reading-context-head"><span className="reading-context-title">Skill instruction block</span><em>{card.skill.sourceFile}</em></div>
        <div className="reading-skill-name">{card.skill.name}</div>
        {card.instruction && <details className="reading-skill-instruction"><summary>Skill instruction</summary><div><Markdown value={card.instruction} /></div></details>}
      </div>
    </section>
  }
  return <section className="reading-context" data-context="goal" role="listitem" id={anchor} data-record-id={card.cell.recordId}>
    <span className="reading-context-icon" aria-hidden="true">G</span>
    <div className="reading-context-content">
      <div className="reading-context-head"><span className="reading-context-title">{goalLabels[card.goal.kind] || 'Goal control message'}</span><em>{card.goal.status || card.goal.kind}</em></div>
      <div className="reading-context-missing">Automatic goal-mode control prompt; shown as context instead of user input.</div>
    </div>
  </section>
}

/**
 * 一张卡的懒渲染：占位 div 占着位置（有 anchor id），进入视口附近才渲染真内容，之后不卸载。
 * 一个 turn 里可能有上百张卡（大会话的最后一个 turn 尤其如此），全渲染会把首屏拖到半秒以上。
 */
const LazyCard = memo(function LazyCard({ card, index, readingTurn, selectedId, onSelect, anchorPrefix, eager }) {
  const [shown, setShown] = useState(eager)
  const ref = useRef(null)
  useEffect(() => {
    if (eager || shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { rootMargin: '100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [eager, shown])
  const anchor = card.kind === 'context' ? `${anchorPrefix}-card-${readingTurn.turn}-${index}` : undefined
  if (!shown) {
    return <div ref={ref} id={anchor} className={`reading-card-placeholder reading-card-${card.kind}`} style={{ minHeight: card.kind === 'user' ? 120 : card.kind === 'tool' ? 220 : 160 }} aria-busy="true" />
  }
  const selected = Boolean(card.cell?.recordId && card.cell.recordId === selectedId)
  if (card.kind === 'user') return <UserCard card={card} anchor={anchor} />
  if (card.kind === 'assistant') return <AssistantCard card={card} anchor={anchor} />
  if (card.kind === 'tool') return <ToolCard card={card} selected={selected} onSelect={onSelect} anchor={anchor} />
  return <ContextCard card={card} anchor={anchor} />
})

function ReadingTurn({ readingTurn, selectedId, onSelect, anchorPrefix }) {
  // 贴底看最新：最后一个 turn 的最后几张卡直接渲染，其余懒渲染。
  const n = readingTurn.cards.length
  const EAGER_TAIL = 6
  return <section className="reading-turn" id={`${anchorPrefix}-turn-${readingTurn.turn}`} data-outline-turn={readingTurn.turn}>
    <div className="reading-turn-head">
      <span className="reading-turn-title">Turn {readingTurn.turn}</span>
      <StatusPill status={readingTurn.status} />
    </div>
    <div role="list">
      {readingTurn.cards.map((card, index) => (
        <LazyCard key={index} card={card} index={index} readingTurn={readingTurn} selectedId={selectedId} onSelect={onSelect} anchorPrefix={anchorPrefix} eager={index >= n - EAGER_TAIL} />
      ))}
    </div>
  </section>
}

/**
 * 懒渲染的 turn：占位 section 始终在 DOM 里（有 id，目录跳转与 activeTurn 判定不受影响），
 * 进入视口附近才渲染真内容，之后不卸载（Markdown 不重复解析）。
 *
 * `eager` 为真时直接渲染：贴底看最新时最后一个 turn 立即可见，搜索结果集小也全渲染。
 */
const LazyTurn = memo(function LazyTurn({ readingTurn, eager, selectedId, onSelect, anchorPrefix }) {
  const [shown, setShown] = useState(eager)
  const ref = useRef(null)
  useEffect(() => {
    if (eager || shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { rootMargin: '100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [eager, shown])
  // 占位高度按 card 数估：user ~120，assistant 文本 ~160，tool ~220。偏差由真内容替换后自然修正。
  const estimate = readingTurn.cards.reduce((h, c) => h + (c.kind === 'user' ? 120 : c.kind === 'tool' ? 220 : 160), 60)
  if (!shown) {
    return <section className="reading-turn reading-turn-placeholder" id={`${anchorPrefix}-turn-${readingTurn.turn}`} data-outline-turn={readingTurn.turn} ref={ref} style={{ minHeight: estimate }} aria-busy="true">
      <div className="reading-turn-head"><span className="reading-turn-title">Turn {readingTurn.turn}</span></div>
    </section>
  }
  return <ReadingTurn readingTurn={readingTurn} selectedId={selectedId} onSelect={onSelect} anchorPrefix={anchorPrefix} />
})

export function ReadingView({ turns, selectedId = null, onSelect, query = '', title = 'Session', rules, className = '' }) {
  const records = useMemo(() => flattenTurns(turns), [turns])
  const readingTurns = useMemo(() => projectReadingTurns(turns, { rules }), [turns, rules])
  const visible = useMemo(() => filterReadingTurns(readingTurns, query), [readingTurns, query])
  const outline = useMemo(() => projectReadingOutline(visible, title), [visible, title])
  const anchorPrefix = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const paneRef = useRef(null)
  const flashRef = useRef(null)
  const activeTurn = useActiveReadingTurn(paneRef, anchorPrefix, visible.length, !query)
  const jumpTo = (turn, cardIndex = null) => {
    const target = document.getElementById(cardIndex == null ? `${anchorPrefix}-turn-${turn}` : `${anchorPrefix}-card-${turn}-${cardIndex}`)
    const pane = paneRef.current
    if (!target || !pane) return
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    // Scroll the pane itself: scrollIntoView would also scroll the host page.
    const top = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 44
    pane.scrollTo({ top: Math.max(0, top), behavior })
    const section = cardIndex == null ? target : target.closest('.reading-turn')
    if (section && behavior === 'smooth') {
      section.classList.remove('reading-jump-flash')
      void section.offsetWidth
      section.classList.add('reading-jump-flash')
      clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => section.classList.remove('reading-jump-flash'), 1400)
    }
  }
  const cards = visible.reduce((total, readingTurn) => total + readingTurn.cards.length, 0)
  return <DetailsSplit selected={selectedId ? records.find((record) => record.cell.recordId === selectedId)?.cell ?? null : null} records={records} onSelect={onSelect} onClose={() => onSelect?.(null)} className={className}>
    <div className="view-pane" ref={paneRef}>
      <div className="view-heading"><span>Reading thread</span><span role="status">{visible.length} turns · {cards} cards{query ? ' matching' : ''}</span></div>
      <div className="reading-layout">
        <ReadingOutline outline={outline} activeTurn={query ? null : activeTurn} onJump={jumpTo} />
        <div className="reading-thread">
          {visible.length === 0 && <div className="view-empty"><h2>{query ? 'No matching cards' : 'Nothing to read in this session'}</h2><p>{query ? 'Try another keyword or clear the search field.' : 'This session has no message records to project.'}</p></div>}
          {visible.map((readingTurn, i) => <LazyTurn key={readingTurn.turn} readingTurn={readingTurn} eager={query !== '' || i === visible.length - 1} selectedId={selectedId} onSelect={onSelect} anchorPrefix={anchorPrefix} />)}
        </div>
      </div>
    </div>
  </DetailsSplit>
}
