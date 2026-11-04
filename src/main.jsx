import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronDown, ChevronRight, Clock3, FileJson, FolderOpen, Search, X } from 'lucide-react'
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

function Toolbar({ query, setQuery, actualDuration, setActualDuration, turnsExpanded, onToggleTurns, callsExpanded, setCallsExpanded }) {
  return <div className={toolbarCss.root} role="toolbar" aria-label="Trajectory toolbar">
    <div className={toolbarCss.inner}>
      <div className={toolbarCss.actions}>
        <button className={toolbarCss.toggle} type="button" aria-pressed={actualDuration} title="Use recorded duration" onClick={() => setActualDuration(!actualDuration)}>
          <Clock3 className={toolbarCss.toggleIcon} size={12} /> Duration
        </button>
        <button className={toolbarCss.action} type="button" aria-pressed={!turnsExpanded} title={turnsExpanded ? 'Collapse all turns' : 'Expand all turns'} onClick={onToggleTurns}>
          <span className={toolbarCss.actionIcon} aria-hidden="true">{turnsExpanded ? '⊟' : '⊞'}</span> Turns
        </button>
        <button className={toolbarCss.action} type="button" aria-pressed={!callsExpanded} title={callsExpanded ? 'Collapse tool calls' : 'Expand tool calls'} onClick={() => setCallsExpanded(!callsExpanded)}>
          <span className={toolbarCss.actionIcon} aria-hidden="true">{callsExpanded ? '⊟' : '⊞'}</span> Calls
        </button>
      </div>
      <div className={toolbarCss.search}>
        <Search size={11} className={toolbarCss.searchIcon} />
        <input className={toolbarCss.searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trajectory" aria-label="Search trajectory" />
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
  const start = projected.length ? Math.min(...projected.map(({ start: value }) => value)) : 0
  const end = Math.max(start + 1, ...projected.map(({ end: value }) => value))
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

function Cell({ record, selected, onSelect, query }) {
  const { cell, position, turnStart, turnEnd, groupStart } = record
  const label = kindLabel[cell.kind] || cell.kind
  const searchMatch = matchesSearch(cell, query)
  return <tr tabIndex="0" aria-rowindex={position} aria-label={`${label}: ${cell.text}`} aria-selected={selected || undefined} data-kind={cell.kind} data-record-index={cell.index} data-group-start={groupStart || undefined} data-turn-start={turnStart || undefined} data-turn-end={turnEnd || undefined} data-search-match={searchMatch ? 'true' : 'false'} data-selected={selected ? 'true' : undefined} data-error={cell.isError ? 'true' : undefined} onClick={() => onSelect(cell)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(cell) } }}>
    <td className={tableCss.event}>
      {turnStart && <span className={tableCss.turnLabel} aria-label={`Turn ${record.turn}`}><span className={tableCss.turnLabelFull}>Turn {record.turn}</span><span className={tableCss.turnLabelCompact}>T{record.turn}</span></span>}
      <span className={tableCss.turnRail} aria-hidden="true" />
      {selected && <span className={tableCss.selectionRail} aria-hidden="true" />}
      <div className={tableCss.eventInner}>
        <span className={tableCss.kindSlot}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`} data-role-kind={cell.kind}><span className={tableCss.kindTagIcon} aria-hidden="true">{cell.kind === 'user' ? 'U' : cell.kind === 'message' ? 'A' : cell.kind === 'tool' ? 'T' : 'C'}</span><span className={tableCss.kindTagLabel}>{label}</span></span></span>
      </div>
    </td>
    <td className={tableCss.content}>
      {cell.result ? <span className={tableCss.resultPreview}><span className={tableCss.resultRequest}><span className={tableCss.contentText} title={cell.text}>{cell.text}</span></span><span className={cell.isError ? `${tableCss.inlineResult} ${tableCss.error}` : tableCss.inlineResult}><span className={tableCss.arrow}>→</span><span className={tableCss.inlineResultText}>{cell.result}</span></span></span> : <span className={tableCss.contentText} title={cell.text}>{cell.text}</span>}
    </td>
  </tr>
}

function Detail({ cell, onClose }) {
  const [tab, setTab] = useState('overview')
  const content = cell.outputDetail || cell.inputDetail || ''
  return <aside className={tableCss.details} aria-label="Record details">
    <div className={tableCss.detailsHeader}><div className={tableCss.detailsTitle}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`}>{kindLabel[cell.kind]}</span><span className={tableCss.detailsLocation}>{cell.text}</span></div><button className={tableCss.close} type="button" aria-label="Close details" title="Close details" onClick={onClose}><X size={14} /></button></div>
    <div className={tableCss.detailTabs} role="tablist" aria-label="Record detail tabs"><button className={tab === 'overview' ? `${tableCss.detailTab} ${tableCss.detailTabActive}` : tableCss.detailTab} type="button" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'raw' ? `${tableCss.detailTab} ${tableCss.detailTabActive}` : tableCss.detailTab} type="button" role="tab" aria-selected={tab === 'raw'} onClick={() => setTab('raw')}>Raw JSON</button></div>
    <div className={tableCss.detailBody}>
      {tab === 'raw' ? <pre className={tableCss.jsonPayload}>{JSON.stringify(cell.raw, null, 2)}</pre> : <>
        <dl className={tableCss.overview}><div><dt>Record</dt><dd>{cell.recordId || '—'}</dd></div><div><dt>Time</dt><dd>{formatTime(cell.startedAt)}</dd></div><div><dt>Duration</dt><dd>{formatDuration(cell.timeSeconds)}</dd></div>{cell.callId && <div><dt>Call ID</dt><dd>{cell.callId}</dd></div>}{cell.toolName && <div><dt>Tool</dt><dd>{cell.toolName}</dd></div>}</dl>
        {cell.thinkingDetail && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Thinking</h3><div className={tableCss.markdownPayload}><ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.thinkingDetail}</ReactMarkdown></div></section>}
        {content && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>{cell.kind === 'user' ? 'Input' : 'Output'}</h3><div className={tableCss.markdownPayload}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div></section>}
        {cell.inputDetail && cell.kind === 'tool' && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Arguments</h3><pre className={tableCss.jsonPayload}>{cell.inputDetail}</pre></section>}
        {cell.outputBlocks?.length > 0 && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Result blocks</h3>{cell.outputBlocks.map((block, index) => <pre className={tableCss.resultBlockText} key={index}>{block.content}</pre>)}</section>}
        {(cell.input || cell.output || cell.think) && <section className={tableCss.usagePanel}><section className={tableCss.usageGroup}><h4 className={tableCss.usageHeading}>Usage</h4><dl className={tableCss.overview}><div><dt>Input</dt><dd>{cell.input ?? '—'}</dd></div><div><dt>Output</dt><dd>{cell.output ?? '—'}</dd></div><div><dt>Reasoning</dt><dd>{cell.think ?? '—'}</dd></div></dl></section></section>}
      </>}
    </div>
  </aside>
}

export function TrajectoryTable({ turns, selectedId, onSelect, callsExpanded, collapsedTurns, query, onToggleTurn, onToggleCalls }) {
  const records = useMemo(() => flattenTurns(turns), [turns])
  const displayRecords = query.trim() ? records.filter(({ cell }) => matchesSearch(cell, query)) : records
  const selected = records.find((record) => record.cell.recordId === selectedId)?.cell
  return <div className={tableCss.split}>
    <div className={tableCss.tablePane}>
      <table className={tableCss.table} data-scroll-ready="true" aria-rowcount={displayRecords.length}><colgroup><col className={tableCss.eventColumn} /><col className={tableCss.contentColumn} /></colgroup><tbody>
        {turns.map((turn) => {
          const turnRecords = displayRecords.filter((record) => record.turn === turn.turn).map((record, index) => query.trim() && index === 0 ? { ...record, turnStart: true } : record)
          const toolCount = turnRecords.filter((record) => record.cell.kind === 'tool').length
          const groupedRecords = []
          for (const record of turnRecords) {
            if (record.groupStart || groupedRecords.length === 0) groupedRecords.push([])
            groupedRecords.at(-1).push(record)
          }
          if (turnRecords.length === 0) return null
          if (collapsedTurns.has(turn.turn)) return <React.Fragment key={`collapsed-${turn.turn}`}><Cell record={{ ...turnRecords[0], turnStart: true }} selected={turnRecords[0].cell.recordId === selectedId} onSelect={onSelect} query={query} /><tr data-collapsed-summary="turn" data-turn-end="true" tabIndex="0" onClick={() => onToggleTurn?.(turn.turn)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggleTurn?.(turn.turn) }}><td className={tableCss.event}><span className={tableCss.turnLabel}>Turn {turn.turn}</span></td><td className={tableCss.content}><span className={tableCss.collapsedTurnContent}><span className={tableCss.collapsedTurnEllipsis}>…</span><span className={tableCss.collapsedTurnText}>{Math.max(0, turnRecords.length - 1)} records collapsed</span></span></td></tr></React.Fragment>
          return <React.Fragment key={`turn-${turn.turn}`}>
            {groupedRecords.map((group, groupIndex) => {
              const groupToolCount = group.filter((record) => record.cell.kind === 'tool').length
              return <React.Fragment key={`${turn.turn}-${groupIndex}`}>
                {group.filter((record) => record.cell.kind !== 'tool' || callsExpanded).map((record) => <Cell key={record.cell.recordId || record.position} record={record} selected={record.cell.recordId === selectedId} onSelect={onSelect} query={query} />)}
                {!callsExpanded && groupToolCount > 0 && <tr data-collapsed-summary="assistant" tabIndex="0" onClick={onToggleCalls} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggleCalls?.() }}><td className={tableCss.event}><span className={`${tableCss.kindTag} ${tableCss.assistantVioletBright}`}>Assistant</span></td><td className={tableCss.content}><span className={tableCss.collapsedTurnContent}><span className={tableCss.collapsedTurnEllipsis}>…</span><span className={tableCss.collapsedTurnText}>{groupToolCount} tool call{groupToolCount === 1 ? '' : 's'} collapsed</span></span></td></tr>}
              </React.Fragment>
            })}
          </React.Fragment>
        })}
      </tbody></table>
    </div>
    {selected && <Detail cell={selected} onClose={() => onSelect(null)} />}
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
  const [callsExpanded, setCallsExpanded] = useState(true)
  const openFile = () => inputRef.current?.click()
  const handleFile = async (file) => {
    if (!file) return
    try {
      const next = parsePiJsonl(await file.text())
      setData(next); setFileName(file.name); setError(''); setSelected(null); setCollapsedTurns(new Set()); setCallsExpanded(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setData(null) }
  }
  const turns = data?.turns ?? []
  const turnsExpanded = collapsedTurns.size === 0
  const select = (cell) => setSelected(cell?.recordId ? cell : null)
  return <main className="app-shell">
    <input ref={inputRef} className="file-input" type="file" accept=".jsonl,application/jsonl,application/json" onChange={(event) => handleFile(event.target.files?.[0])} />
    {!data ? <section className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}><FileJson size={32} strokeWidth={1.4} /><h1>Pi Agent Trajectory</h1><p>Open a Pi Agent session JSONL file to inspect its recorded turns.</p><button type="button" className="open-button" onClick={openFile}><FolderOpen size={15} /> Open JSONL</button>{error && <p className="error-message" role="alert">{error}</p>}</section> : <>
      <header className="session-header"><div><span className="eyebrow">PI AGENT SESSION</span><h1>{fileName}</h1><p>{data.header.cwd || 'Working directory unavailable'} <span>·</span> {data.header.modelId || data.header.provider || 'Recorded session'}</p></div><div className="header-actions"><span className="stat">{data.stats.turns} turns</span><span className="stat">{data.stats.tools} tools</span><button type="button" className="header-button" onClick={openFile}><FolderOpen size={14} /> Open another</button></div></header>
      <div className={`${viewsCss.root} trajectory-shell`}>
        <Toolbar query={query} setQuery={setQuery} actualDuration={actualDuration} setActualDuration={setActualDuration} turnsExpanded={turnsExpanded} onToggleTurns={() => setCollapsedTurns(turnsExpanded ? new Set(turns.map((turn) => turn.turn)) : new Set())} callsExpanded={callsExpanded} setCallsExpanded={setCallsExpanded} />
        <Timeline turns={turns} selectedId={selected?.recordId} onSelect={select} actualDuration={actualDuration} query={query} />
        <div className={viewsCss.ledger}><TrajectoryTable turns={turns} selectedId={selected?.recordId} onSelect={select} callsExpanded={callsExpanded} onToggleCalls={() => setCallsExpanded(!callsExpanded)} collapsedTurns={collapsedTurns} onToggleTurn={(turn) => setCollapsedTurns((current) => { const next = new Set(current); next.has(turn) ? next.delete(turn) : next.add(turn); return next })} query={query} /></div>
      </div>
    </>}
  </main>
}

if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
