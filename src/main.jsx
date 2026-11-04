import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, Check, Clock3, Copy, FileJson, FolderOpen, Layers3, ListCollapse, Maximize2, Minimize2, Search, ShieldCheck, WrapText, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatDuration, formatTime, parsePiJsonl } from './parser.js'
import tableCss from './reference/TrajectoryTable.module.css'
import timelineCss from './reference/TrajectoryTimeline.module.css'
import toolbarCss from './reference/TrajectoryToolbar.module.css'
import viewsCss from './reference/views.module.css'
import './reference/base.css'
import './reference/design-platform.css'
import './reference/gradient-shadow-text.css'
import './reference/focus.css'
import './reference/scrollbar.css'
import './app.css'

const kindLabel = { user: 'User', message: 'Assistant', tool: 'Tool', compacted: 'Compacted' }
const kindClass = {
  user: tableCss.user,
  message: tableCss.assistantVioletBright,
  tool: tableCss.toolAmber,
  compacted: tableCss.compacted,
}

function flattenTurns(turns) {
  let position = 0
  return turns.flatMap((turn) => turns.length === 0 ? [] : turn.groups.flatMap((group, groupIndex) => group.cells.map((cell, cellIndex) => ({
    cell,
    position: ++position,
    turn: turn.turn,
    turnStart: groupIndex === 0 && cellIndex === 0,
    groupStart: cellIndex === 0,
    turnEnd: groupIndex === turn.groups.length - 1 && cellIndex === group.cells.length - 1,
  }))))
}

function matchesSearch(cell, query) {
  const needle = query.trim().toLowerCase()
  return !needle || `${cell.text} ${cell.inputDetail || ''} ${cell.outputDetail || ''} ${cell.thinkingDetail || ''} ${cell.result || ''}`.toLowerCase().includes(needle)
}

const TOOL_PREVIEW_LIMIT = 12000

function oneLine(value, limit = 110) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function toolTarget(cell) {
  const args = cell.raw?.call?.arguments
  if (typeof args === 'string') return oneLine(args)
  if (!args || typeof args !== 'object') return ''
  const preferred = ['command', 'cmd', 'path', 'filePath', 'pattern', 'query', 'url', 'script']
  const key = preferred.find((candidate) => typeof args[candidate] === 'string' && args[candidate].trim())
  if (key) return oneLine(args[key])
  const first = Object.entries(args).find(([, value]) => typeof value === 'string' && value.trim())
  return first ? oneLine(first[1]) : oneLine(JSON.stringify(args), 110)
}

function resultSummary(value, limit = 160) {
  return oneLine(value, limit).replace(/\n/g, ' ')
}

function formatChars(value) {
  if (value < 1000) return `${value} chars`
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k chars`
}

function lineCount(value) {
  return value ? value.split('\n').length : 0
}

function previewText(value, limit = TOOL_PREVIEW_LIMIT) {
  if (value.length <= limit) return { text: value, hidden: 0 }
  const headLength = Math.floor(limit * 0.66)
  const tailLength = limit - headLength
  const hidden = value.length - headLength - tailLength
  return {
    text: `${value.slice(0, headLength)}\n\n… ${formatChars(hidden)} hidden …\n\n${value.slice(-tailLength)}`,
    hidden,
  }
}

function Toolbar({ query, setQuery, actualDuration, setActualDuration, turnsExpanded, onToggleTurns, callsExpanded, setCallsExpanded }) {
  return <div className={`${toolbarCss.root} viewer-toolbar`} role="toolbar" aria-label="Trajectory toolbar">
    <div className={toolbarCss.inner}>
      <div className={toolbarCss.actions}>
        <button className={toolbarCss.toggle} type="button" aria-pressed={actualDuration} title="Use recorded duration" onClick={() => setActualDuration(!actualDuration)}>
          <Clock3 className={toolbarCss.toggleIcon} size={12} /> Duration
        </button>
        <button className={toolbarCss.action} type="button" aria-pressed={!turnsExpanded} title={turnsExpanded ? 'Collapse all turns' : 'Expand all turns'} onClick={onToggleTurns}>
          <Layers3 size={14} aria-hidden="true" /> Turns
        </button>
        <button className={toolbarCss.action} type="button" aria-pressed={!callsExpanded} title={callsExpanded ? 'Collapse tool calls' : 'Expand tool calls'} onClick={() => setCallsExpanded(!callsExpanded)}>
          <ListCollapse size={14} aria-hidden="true" /> Calls
        </button>
      </div>
      <div className={`${toolbarCss.search} search-field`}>
        <Search size={11} className={toolbarCss.searchIcon} />
        <input className={toolbarCss.searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trajectory" aria-label="Search trajectory" />
        {query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
      </div>
    </div>
  </div>
}

export function Timeline({ turns, selectedId, onSelect, actualDuration, query }) {
  const records = useMemo(() => flattenTurns(turns), [turns])
  const timed = actualDuration
    ? records.filter(({ cell }) => Number.isFinite(cell.startedAt))
    : records.map((record, index) => ({ ...record, cell: { ...record.cell, startedAt: index, timeSeconds: 1 } }))
  let removedIdle = 0
  let coveredUntil = null
  const projectedRanges = new Map()
  for (const record of [...timed].sort((left, right) => left.cell.startedAt - right.cell.startedAt)) {
    const range = { start: record.cell.startedAt, end: record.cell.startedAt + Math.max(0, (record.cell.timeSeconds ?? 0) * 1000) }
    if (coveredUntil !== null && range.start > coveredUntil) removedIdle += range.start - coveredUntil
    coveredUntil = coveredUntil === null ? range.end : Math.max(coveredUntil, range.end)
    projectedRanges.set(record, { start: range.start - removedIdle, end: range.end - removedIdle })
  }
  const projected = timed.map((record) => {
    const range = projectedRanges.get(record)
    return { ...record, start: range.start, end: actualDuration ? range.end : range.start + 1 }
  })
  const start = projected.reduce((minimum, { start: value }) => Math.min(minimum, value), projected.length ? Infinity : 0)
  const end = projected.reduce((maximum, { end: value }) => Math.max(maximum, value), start + 1)
  const total = end - start
  return <section className={timelineCss.root} aria-label="Timeline overview">
    <div className={timelineCss.plot}>
      <div className={timelineCss.labels}><span>Input</span><span>Model</span><span>Tools</span></div>
      <div className={`${timelineCss.track} timeline-track`} tabIndex="0">
        {projected.length === 0 ? <span className={timelineCss.empty}>No timing data</span> : <>
          <div className={timelineCss.turnBoundaries} style={{ '--trajectory-domain-left': '0%', '--trajectory-domain-width': '100%' }} aria-hidden="true">
            {turns.map((turn) => {
              const first = projected.find(({ turn: number }) => number === turn.turn)
              return first && <span key={turn.turn} className={timelineCss.turnBoundary} data-turn={turn.turn} style={{ '--trajectory-turn-left': `${((first.start - start) / total) * 100}%` }} />
            })}
          </div>
          <div className={timelineCss.lanes} style={{ '--trajectory-domain-left': '0%', '--trajectory-domain-width': '100%' }}>
            {projected.map(({ cell, start: spanStart, end: spanEnd }, index) => {
              const left = ((spanStart - start) / total) * 100
              const duration = Math.max(0.8, ((spanEnd - spanStart) / total) * 100)
              const lane = cell.kind === 'tool' ? 2 : cell.kind === 'message' || cell.kind === 'compacted' ? 1 : 0
              const selected = selectedId != null && selectedId === cell.recordId
              return <button key={cell.recordId || `${cell.kind}-${index}`} className={timelineCss.span} data-timeline-span={cell.kind === 'compacted' ? 'context' : cell.kind} data-search-match={matchesSearch(cell, query) ? 'true' : 'false'} data-selected={selectedId == null ? undefined : selected ? 'true' : 'false'} data-current={selected ? 'true' : undefined} data-error={cell.isError ? 'true' : undefined} data-equal-duration={undefined} aria-label={`${kindLabel[cell.kind]} ${cell.text}`} onClick={() => onSelect(cell)} style={{ '--trajectory-span-left': `${left}%`, '--trajectory-span-width': `${duration}%`, '--trajectory-span-lane': lane, '--trajectory-span-gap': '1px' }} />
            })}
          </div>
        </>}
      </div>
    </div>
  </section>
}

function Cell({ record, selected, onSelect, query, activeTurn }) {
  const { cell, position, turnStart, turnEnd, groupStart } = record
  const label = kindLabel[cell.kind] || cell.kind
  const searchMatch = matchesSearch(cell, query)
  return <tr tabIndex="0" aria-rowindex={position} aria-label={`${label}: ${cell.text}`} aria-selected={selected || undefined} data-kind={cell.kind} data-record-index={cell.index} data-group-start={groupStart || undefined} data-turn-start={turnStart || undefined} data-turn-end={turnEnd || undefined} data-search-match={searchMatch ? 'true' : 'false'} data-selected={selected ? 'true' : undefined} data-error={cell.isError ? 'true' : undefined} onClick={() => onSelect(cell)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(cell) } }}>
    <td className={tableCss.event}>
      {turnStart && <span className={record.turn === activeTurn ? `${tableCss.turnLabel} ${tableCss.turnLabelActive}` : tableCss.turnLabel} aria-label={`Turn ${record.turn}`}><span className={tableCss.turnLabelFull}>Turn {record.turn}</span><span className={tableCss.turnLabelCompact}>T{record.turn}</span></span>}
      {record.turn === activeTurn && <span className={tableCss.turnRail} aria-hidden="true" />}
      {selected && <span className={tableCss.selectionRail} aria-hidden="true" />}
      <div className={tableCss.eventInner}>
        <span className={tableCss.kindSlot}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`} data-role-kind={cell.kind}><span className={tableCss.kindTagIcon} aria-hidden="true">{cell.kind === 'user' ? 'U' : cell.kind === 'message' ? 'A' : cell.kind === 'tool' ? 'T' : 'C'}</span><span className={tableCss.kindTagLabel}>{label}</span></span></span>
      </div>
    </td>
    <td className={tableCss.content}>
      {cell.kind === 'tool' ? <span className="tool-call-summary" title={toolTarget(cell) || cell.text}>
        <span className="tool-call-summary-title">{toolTarget(cell) || cell.text}</span>
        <span className={cell.isError ? 'tool-call-summary-status tool-call-summary-error' : 'tool-call-summary-status'}>{cell.isError ? 'Error' : cell.raw?.result ? (cell.result ? resultSummary(cell.result) : 'Empty result') : 'No result recorded'}</span>
      </span> : cell.result ? <span className={`${tableCss.resultPreview} tool-result-preview`}><span className={tableCss.resultRequest}><span className={tableCss.contentText} title={cell.text}>{cell.text}</span></span><span className={cell.isError ? `${tableCss.inlineResult} ${tableCss.error}` : tableCss.inlineResult}><span className={tableCss.arrow}>→</span><span className={tableCss.inlineResultText}>{resultSummary(cell.result)}</span></span></span> : <span className={tableCss.contentText} title={cell.text}>{cell.text}</span>}
    </td>
  </tr>
}

function TextOutput({ value, label, previewLimit = TOOL_PREVIEW_LIMIT }) {
  const [expanded, setExpanded] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const preview = previewText(value, previewLimit)
  const displayed = expanded ? value : preview.text
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }
  return <div className="long-output" data-wrap={wrap ? 'true' : 'false'}>
    <div className="long-output-toolbar">
      <span className="long-output-meta">{label} · {lineCount(value)} lines · {formatChars(value.length)}</span>
      <div className="long-output-actions">
        <button type="button" className="output-action" onClick={() => setWrap(!wrap)} aria-pressed={wrap} title={wrap ? 'Keep long lines on one line' : 'Wrap long lines'}><WrapText size={13} /> {wrap ? 'Wrapped' : 'Wrap'}</button>
        <button type="button" className="output-action" onClick={copy} title={`Copy ${label.toLowerCase()}`}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
        {preview.hidden > 0 && <button type="button" className="output-action output-action-primary" onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {expanded ? 'Collapse' : 'Show full'}</button>}
      </div>
    </div>
    <pre className="long-output-content">{displayed || '∅ Empty output'}</pre>
    {preview.hidden > 0 && !expanded && <div className="long-output-note">Showing the beginning and end. {formatChars(preview.hidden)} hidden from view.</div>}
  </div>
}

export function Detail({ cell, onClose }) {
  const [tab, setTab] = useState('overview')
  const [resultBlocksOpen, setResultBlocksOpen] = useState(false)
  const closeRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) }
  }, [])
  const content = cell.outputDetail || cell.inputDetail || ''
  const hasToolResult = cell.kind === 'tool' && Boolean(cell.raw?.result)
  const toolStatus = cell.isError ? 'Error' : !hasToolResult ? 'No result recorded' : cell.outputDetail ? 'Completed' : 'Empty result'
  const markdown = (value, className = tableCss.markdownPreview) => <div className={`${className} detail-markdown`}><ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown></div>
  const section = (title, children, className = '') => <section className={`${tableCss.overviewSection} ${className}`.trim()}><h3 className={tableCss.overviewHeading}>{title}</h3><div className={tableCss.overviewPreview}>{children}</div></section>
  return <aside className={`${tableCss.details} record-details`} aria-label="Record details" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className={tableCss.detailsHeader}><div className={tableCss.detailsTitle}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`}>{kindLabel[cell.kind]}</span><span className={tableCss.detailsLocation}>{cell.text}</span></div><button ref={closeRef} className={tableCss.close} type="button" aria-label="Close details" title="Close details" onClick={onClose}><X size={14} /></button></div>
    <div className={tableCss.detailTabs} role="tablist" aria-label="Record detail tabs"><button className={tab === 'overview' ? `${tableCss.detailTab} ${tableCss.detailTabActive}` : tableCss.detailTab} type="button" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'raw' ? `${tableCss.detailTab} ${tableCss.detailTabActive}` : tableCss.detailTab} type="button" role="tab" aria-selected={tab === 'raw'} onClick={() => setTab('raw')}>Raw JSON</button></div>
    <div className={`${tab === 'overview' ? `${tableCss.detailBody} ${tableCss.detailBodySummary}` : tableCss.detailBody} detail-scroll`} role="tabpanel">
      {tab === 'raw' ? <div className={tableCss.overviewPreview}><pre className={`${tableCss.jsonPayload} ${cell.isError ? tableCss.errorPayload : ''}`.trim()}>{JSON.stringify(cell.raw, null, 2)}</pre></div> : <>
        <dl className={tableCss.overview}><div><dt>Record</dt><dd>{cell.recordId || '—'}</dd></div><div><dt>Time</dt><dd>{formatTime(cell.startedAt)}</dd></div><div><dt>Duration</dt><dd>{formatDuration(cell.timeSeconds)}</dd></div>{cell.callId && <div><dt>Call ID</dt><dd>{cell.callId}</dd></div>}{cell.toolName && <div><dt>Tool</dt><dd>{cell.toolName}</dd></div>}</dl>
        {cell.kind === 'compacted' && content && <div className={tableCss.compactedSummary}><div className={tableCss.overviewPreview}>{markdown(content)}</div></div>}
        <div className={`${tableCss.overviewSections} detail-sections`}>
          {cell.kind !== 'compacted' && cell.thinkingDetail && section('Thinking', markdown(cell.thinkingDetail))}
          {cell.kind === 'tool' && <div className={`tool-status tool-status-${cell.isError ? 'error' : hasToolResult ? 'complete' : 'missing'}`}><span className="tool-status-dot" />{toolStatus}</div>}
          {cell.inputDetail && cell.kind === 'tool' && section('Arguments', <TextOutput value={cell.inputDetail} label="Arguments" previewLimit={8000} />)}
          {cell.kind === 'tool' && section('Output', hasToolResult ? <TextOutput value={cell.outputDetail || ''} label={cell.isError ? 'Error output' : 'Output'} /> : <div className="tool-empty-output">The session does not contain a result for this call.</div>)}
          {cell.kind !== 'compacted' && cell.kind !== 'tool' && content && section(cell.kind === 'user' ? 'Input' : 'Output', markdown(content))}
          {cell.outputBlocks?.length > 0 && <details className="result-disclosure" open={resultBlocksOpen} onToggle={(event) => setResultBlocksOpen(event.currentTarget.open)}><summary>Raw result blocks ({cell.outputBlocks.length})</summary>{resultBlocksOpen && <div className={`${tableCss.resultBlocks} ${cell.isError ? tableCss.errorPayload : ''}`.trim()}>{cell.outputBlocks.map((block, index) => <pre className={tableCss.resultBlockText} key={index}>{block.content}</pre>)}</div>}</details>}
          {(cell.input || cell.output || cell.think) && section('Usage', <div className={tableCss.usagePanel}><section className={tableCss.usageGroup}><h4 className={tableCss.usageHeading}>Usage</h4><dl className={tableCss.overview}><div><dt>Input</dt><dd>{cell.input ?? '—'}</dd></div><div><dt>Output</dt><dd>{cell.output ?? '—'}</dd></div><div><dt>Reasoning</dt><dd>{cell.think ?? '—'}</dd></div></dl></section></div>)}
        </div>
      </>}
    </div>
  </aside>
}

export function TrajectoryTable({ turns, selectedId, onSelect, callsExpanded, collapsedTurns, query, onToggleTurn, onToggleCalls }) {
  const records = useMemo(() => flattenTurns(turns), [turns])
  const searching = Boolean(query.trim())
  const displayRecords = searching ? records.filter(({ cell }) => matchesSearch(cell, query)) : records
  const selectedRecord = records.find((record) => record.cell.recordId === selectedId)
  const selected = selectedRecord && (!searching || matchesSearch(selectedRecord.cell, query)) ? selectedRecord.cell : null
  const activeTurn = selectedRecord?.turn
  return <div className={`${tableCss.split} viewer-split`} data-details-open={Boolean(selected)}>
    <div className={`${tableCss.tablePane} record-list`}>
      <div className="ledger-heading"><span>Session records</span><span role="status">{displayRecords.length} {searching ? 'matches' : 'records'}</span></div>
      {displayRecords.length === 0 && <div className="no-results"><Search size={24} strokeWidth={1.5} /><h2>{searching ? 'No matching records' : 'No records in this session'}</h2><p>{searching ? 'Try another keyword or clear the search field.' : 'Open a session containing messages to explore its trajectory.'}</p></div>}
      <table className={`${tableCss.table} record-table`} data-scroll-ready="true" aria-rowcount={displayRecords.length}><colgroup><col className={tableCss.eventColumn} /><col className={tableCss.contentColumn} /></colgroup><tbody>
        {turns.map((turn) => {
          const turnRecords = displayRecords.filter((record) => record.turn === turn.turn).map((record, index) => query.trim() && index === 0 ? { ...record, turnStart: true } : record)
          const groupedRecords = []
          for (const record of turnRecords) {
            if (record.groupStart || groupedRecords.length === 0) groupedRecords.push([])
            groupedRecords.at(-1).push(record)
          }
          if (turnRecords.length === 0) return null
          if (!searching && collapsedTurns.has(turn.turn)) return <React.Fragment key={`collapsed-${turn.turn}`}><Cell record={{ ...turnRecords[0], turnStart: true }} activeTurn={activeTurn} selected={turnRecords[0].cell.recordId === selectedId} onSelect={onSelect} query={query} /><tr data-collapsed-summary="turn" data-turn-end="true" tabIndex="0" onClick={() => onToggleTurn?.(turn.turn)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggleTurn?.(turn.turn) }}><td className={tableCss.event}><span className={tableCss.turnLabel}>Turn {turn.turn}</span></td><td className={tableCss.content}><span className={tableCss.collapsedTurnContent}><span className={tableCss.collapsedTurnEllipsis}>…</span><span className={tableCss.collapsedTurnText}>{Math.max(0, turnRecords.length - 1)} records collapsed</span></span></td></tr></React.Fragment>
          return <React.Fragment key={`turn-${turn.turn}`}>
            {groupedRecords.map((group, groupIndex) => {
              const groupToolCount = group.filter((record) => record.cell.kind === 'tool').length
              return <React.Fragment key={`${turn.turn}-${groupIndex}`}>
                {group.filter((record) => record.cell.kind !== 'tool' || callsExpanded || searching).map((record) => <Cell key={record.cell.recordId || record.position} record={record} activeTurn={activeTurn} selected={record.cell.recordId === selectedId} onSelect={onSelect} query={query} />)}
                {!searching && !callsExpanded && groupToolCount > 0 && <tr data-collapsed-summary="assistant" tabIndex="0" onClick={onToggleCalls} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggleCalls?.() }}><td className={tableCss.event}><span className={`${tableCss.kindTag} ${tableCss.assistantVioletBright}`}><span className={tableCss.kindTagIcon}>A</span><span className={tableCss.kindTagLabel}>Assistant</span></span></td><td className={tableCss.content}><span className={tableCss.collapsedTurnContent}><span className={tableCss.collapsedTurnEllipsis}>…</span><span className={tableCss.collapsedTurnText}>{groupToolCount} tool call{groupToolCount === 1 ? '' : 's'} collapsed</span></span></td></tr>}
              </React.Fragment>
            })}
          </React.Fragment>
        })}
      </tbody></table>
    </div>
    {selected && <Detail key={selected.recordId} cell={selected} onClose={() => onSelect(null)} />}
  </div>
}

export function Turn({ turn, ...props }) {
  return <TrajectoryTable turns={[turn]} {...props} collapsedTurns={new Set()} />
}

function App() {
  const inputRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [actualDuration, setActualDuration] = useState(true)
  const [collapsedTurns, setCollapsedTurns] = useState(new Set())
  const [callsExpanded, setCallsExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const openFile = () => inputRef.current?.click()
  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setDragging(false)
    try {
      const next = parsePiJsonl(await file.text())
      setData(next); setFileName(file.name); setError(''); setSelected(null); setQuery(''); setCollapsedTurns(new Set()); setCallsExpanded(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setData(null) }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value = '' }
  }
  const turns = data?.turns ?? []
  const turnsExpanded = collapsedTurns.size === 0
  const select = (cell) => setSelected(cell?.recordId ? cell : null)
  return <main className="app-shell">
    <input ref={inputRef} className="file-input" type="file" accept=".jsonl,application/jsonl,application/json" onChange={(event) => handleFile(event.target.files?.[0])} />
    {!data ? <>
      <header className="welcome-header"><a className="brand" href="./" aria-label="Pi Trajectory home"><span className="brand-mark">π</span><span>Pi <strong>Trajectory</strong></span></a><span className="local-badge"><span /> Local session viewer</span></header>
      <div className="welcome-content">
        <div className="welcome-intro"><span className="eyebrow">A CLEAR VIEW OF EVERY STEP</span><h1>Follow the conversation.<br /><span>Understand the execution.</span></h1><p>Explore your agent’s messages, reasoning and tool calls in one readable timeline.</p></div>
        <section className="dropzone" data-dragging={dragging} aria-label="Open a session" aria-busy={loading} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}>
          <div className="file-symbol"><FileJson size={28} strokeWidth={1.5} /></div><h2>{dragging ? 'Drop your session here' : 'Your session, step by step'}</h2><p>Drag a Pi Agent JSONL file here, or choose one to get started.</p><button type="button" className="open-button" disabled={loading} onClick={openFile}><FolderOpen size={16} /> {loading ? 'Reading session…' : 'Open JSONL file'}<ArrowUpRight size={15} /></button><span className="file-hint">.jsonl session files</span>{error && <p className="error-message" role="alert">{error}</p>}
        </section>
        <div className="welcome-features"><span><Check size={14} /> Conversation turns</span><span><Check size={14} /> Tool inputs & results</span><span><Check size={14} /> Searchable records</span></div>
      </div>
      <footer className="welcome-footer"><ShieldCheck size={15} /> Files stay in your browser. Nothing is uploaded.</footer>
    </> : <>
      <header className="session-header"><span className="brand-mark" aria-hidden="true">π</span><div className="session-title"><span className="eyebrow">PI AGENT / SESSION</span><h1 title={fileName}>{fileName}</h1><p title={data.header.cwd}>{data.header.cwd || 'Working directory unavailable'} <span>·</span> {data.header.modelId || data.header.provider || 'Recorded session'}</p></div><div className="header-actions"><span className="stat"><strong>{data.stats.turns}</strong> turns</span><span className="stat"><strong>{data.stats.tools}</strong> tools</span><button type="button" className="header-button" disabled={loading} onClick={openFile}><FolderOpen size={14} /> {loading ? 'Reading…' : 'Open another'}</button></div></header>
      <div className={`${viewsCss.root} trajectory-shell`}>
        <Toolbar query={query} setQuery={setQuery} actualDuration={actualDuration} setActualDuration={setActualDuration} turnsExpanded={turnsExpanded} onToggleTurns={() => setCollapsedTurns(turnsExpanded ? new Set(turns.map((turn) => turn.turn)) : new Set())} callsExpanded={callsExpanded} setCallsExpanded={setCallsExpanded} />
        <Timeline turns={turns} selectedId={selected?.recordId} onSelect={select} actualDuration={actualDuration} query={query} />
        <div className={`${viewsCss.ledger} trajectory-ledger`}><TrajectoryTable turns={turns} selectedId={selected?.recordId} onSelect={select} callsExpanded={callsExpanded} onToggleCalls={() => setCallsExpanded(!callsExpanded)} collapsedTurns={collapsedTurns} onToggleTurn={(turn) => setCollapsedTurns((current) => { const next = new Set(current); next.has(turn) ? next.delete(turn) : next.add(turn); return next })} query={query} /></div>
      </div>
    </>}
  </main>
}

if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
