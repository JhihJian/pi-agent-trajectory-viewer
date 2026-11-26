import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { DetailsSplit } from './DetailsSplit.jsx'
import { flattenTurns } from '../lib/trajectory-view.js'
import { executionReport, filterTraceTurns, projectTraceTurns } from '../lib/trace-view.js'
import { formatDuration } from '../lib/parser.js'
import { CopyButton } from './JsonTree.jsx'
import './styles/views.css'

const statusLabels = { complete: 'Complete', running: 'Running', waiting: 'Waiting', failed: 'Failed', aborted: 'Aborted', context: 'Context' }
const batchStatusLabels = { succeeded: 'succeeded', failed: 'failed', partial: 'partial', pending: 'pending', cancelled: 'cancelled', rate_limited: 'rate limited', invalid_request: 'invalid request', unknown: 'unknown' }

function StatusPill({ status }) {
  if (!status || status === 'context') return null
  return <span className="status-pill" data-status={status}><span className="status-dot" aria-hidden="true" />{statusLabels[status] || status}</span>
}

function ToolNode({ item, selected, onSelect }) {
  const state = !item.hasResult ? 'pending' : item.isError ? 'error' : 'ok'
  const [batchOpen, setBatchOpen] = useState(false)
  const batch = item.batch
  return <li className="trace-node" data-kind="tool">
    <button type="button" className="trace-node-row" data-state={state} data-selected={selected || undefined} aria-pressed={selected || undefined} onClick={() => onSelect?.(item.cell)}>
      <span className="trace-node-glyph" aria-hidden="true">·</span>
      <span className="status-dot" data-state={state} aria-hidden="true" />
      <span className="trace-node-title">{item.summary.title}</span>
      {item.summary.summary && <span className="trace-node-summary">{item.summary.summary}</span>}
      {Number.isFinite(item.durationSeconds) && <span className="trace-node-duration">{formatDuration(item.durationSeconds)}</span>}
      <span className="trace-node-state">{state === 'pending' ? 'no result' : state === 'error' ? 'error' : ''}</span>
    </button>
    {batch && <div className="trace-batch">
      <button type="button" className="trace-batch-toggle" aria-expanded={batchOpen} onClick={() => setBatchOpen(!batchOpen)}>
        {batchOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="reading-batch-mode">{batch.mode}</span>
        <span className="status-pill" data-status={batch.status}>{batchStatusLabels[batch.status] || batch.status}</span>
        <em>{batch.results.length}/{batch.requested.length} returned · coverage {Math.round(batch.evidence.coverage * 100)}%</em>
      </button>
      {batchOpen && batch.results.map((result, index) => <div key={result.taskId || result.resultIndex || index} className="reading-batch-task" data-status={result.status}>
        <span className="reading-batch-status">{result.status}</span>
        <strong>{result.agent}</strong>
        <span className="reading-batch-summary" title={result.summary || result.task || ''}>{String(result.summary || result.task || '—').replace(/\s+/g, ' ').slice(0, 160) || '—'}</span>
      </div>)}
      {batchOpen && !batch.results.length && <div className="reading-batch-missing">No structured subagent results were recorded.</div>}
    </div>}
  </li>
}

function TraceTurn({ traceTurn, selectedId, onSelect }) {
  const [open, setOpen] = useState(true)
  return <section className="trace-turn">
    <div className="trace-turn-head">
      <button type="button" className="trace-turn-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="reading-turn-title">Turn {traceTurn.turn}</span>
      </button>
      <StatusPill status={traceTurn.status} />
      <em className="trace-turn-meta">{traceTurn.steps} steps · {traceTurn.calls} tool calls{traceTurn.errors ? ` · ${traceTurn.errors} error${traceTurn.errors === 1 ? '' : 's'}` : ''}</em>
    </div>
    {open && <ul className="trace-nodes">
      {traceTurn.items.map((item, index) => {
        if (item.kind === 'user') return <li key={index} className="trace-node" data-kind="user"><button type="button" className="trace-node-row" data-selected={item.cell.recordId === selectedId || undefined} onClick={() => onSelect?.(item.cell)}><span className="trace-node-glyph" aria-hidden="true">▶</span><span className="trace-node-role">User</span>{item.skill && <span className="reading-skill-badge" title="Skill instruction block">skill</span>}<span className="trace-node-summary">{item.text}</span></button></li>
        if (item.kind === 'assistant') return <li key={index} className="trace-node" data-kind="assistant"><button type="button" className="trace-node-row" data-selected={item.cell.recordId === selectedId || undefined} onClick={() => onSelect?.(item.cell)}><span className="trace-node-glyph" aria-hidden="true">◆</span><span className="trace-node-role">Step {item.step}</span><span className="trace-node-summary">{item.text || (item.toolCount > 0 ? `Called ${item.toolCount} tool${item.toolCount === 1 ? '' : 's'}` : item.thinking ? 'Thinking' : '(no text recorded)')}</span>{item.thinking && <span className="trace-node-badge">thinking</span>}{Number.isFinite(item.durationSeconds) && <span className="trace-node-duration">{formatDuration(item.durationSeconds)}</span>}</button></li>
        if (item.kind === 'context') return <li key={index} className="trace-node" data-kind="context"><span className="trace-node-row trace-node-static"><span className="trace-node-glyph" aria-hidden="true">C</span><span className="trace-node-role">{item.compact.kind === 'pi_compaction' ? 'Pi compaction' : 'Context summary'}</span><span className="trace-node-summary">{item.compact.summary || ''}</span></span></li>
        return <ToolNode key={index} item={item} selected={item.cell.recordId === selectedId} onSelect={onSelect} />
      })}
    </ul>}
  </section>
}

export function TraceView({ turns, selectedId = null, onSelect, query = '', header = {}, rules, className = '' }) {
  const records = useMemo(() => flattenTurns(turns), [turns])
  const traceTurns = useMemo(() => projectTraceTurns(turns, { rules }), [turns, rules])
  const visible = useMemo(() => filterTraceTurns(traceTurns, query), [traceTurns, query])
  const report = useMemo(() => executionReport(turns, header, { rules }), [turns, header, rules])
  const items = visible.reduce((total, traceTurn) => total + traceTurn.items.length, 0)
  const calls = visible.reduce((total, traceTurn) => total + traceTurn.calls, 0)
  const errors = visible.reduce((total, traceTurn) => total + traceTurn.errors, 0)
  return <DetailsSplit selected={selectedId ? records.find((record) => record.cell.recordId === selectedId)?.cell ?? null : null} records={records} onSelect={onSelect} onClose={() => onSelect?.(null)} className={className}>
    <div className="view-pane">
      <div className="view-heading">
        <span>Execution trace</span>
        <span role="status">{visible.length} turns · {items} items · {calls} calls{errors ? ` · ${errors} errors` : ''} <CopyButton value={report} label="Copy report" title="Copy execution report as plain text" /></span>
      </div>
      {visible.length === 0 && <div className="view-empty"><h2>{query ? 'No matching items' : 'No execution records'}</h2><p>{query ? 'Try another keyword or clear the search field.' : 'This session has no steps or tool calls to trace.'}</p></div>}
      {visible.map(traceTurn => <TraceTurn key={traceTurn.turn} traceTurn={traceTurn} selectedId={selectedId} onSelect={onSelect} />)}
    </div>
  </DetailsSplit>
}
