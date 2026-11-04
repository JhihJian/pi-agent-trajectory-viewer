import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronDown, ChevronRight, Clock3, FileJson, FolderOpen, Search, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatDuration, formatTime, parsePiJsonl } from './parser.js'
import cellCss from './reference/TrajectoryCell.module.css'
import tableCss from './reference/TrajectoryTable.module.css'
import timelineCss from './reference/TrajectoryTimeline.module.css'
import toolbarCss from './reference/TrajectoryToolbar.module.css'
import groupCss from './reference/TrajectoryGroupHeader.module.css'
import turnHeaderCss from './reference/TrajectoryTurnHeader.module.css'
import turnCss from './reference/TrajectoryTurn.module.css'
import viewsCss from './reference/views.module.css'
import './reference/base.css'
import './reference/design-platform.css'
import './reference/gradient-shadow-text.css'
import './reference/focus.css'
import './reference/scrollbar.css'
import './app.css'

const kindLabel = { user: 'User', message: 'Assistant', tool: 'Tool', compacted: 'Context' }
const kindClass = { user: tableCss.user, message: tableCss.assistantVioletBright, tool: tableCss.toolAmber, compacted: tableCss.compacted }

function Toolbar({ query, setQuery, actualDuration, setActualDuration, onOpen }) {
  return <div className={toolbarCss.root} role="toolbar" aria-label="Trajectory toolbar">
    <div className={toolbarCss.inner}>
      <div className={toolbarCss.actions}>
        <button className={toolbarCss.toggle} type="button" aria-pressed={actualDuration} title="Use recorded duration" onClick={() => setActualDuration(!actualDuration)}>
          <Clock3 className={toolbarCss.toggleIcon} size={12} /> Duration
        </button>
        <button className={toolbarCss.action} type="button" title="Open another JSONL" onClick={onOpen}>
          <FolderOpen className={toolbarCss.actionIcon} size={12} /> Open
        </button>
      </div>
      <div className={toolbarCss.search}>
        <Search size={11} className={toolbarCss.searchIcon} />
        <input className={toolbarCss.searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trajectory" aria-label="Search trajectory" />
      </div>
    </div>
  </div>
}

function Timeline({ turns, selectedId, onSelect, actualDuration }) {
  const spans = useMemo(() => turns.flatMap((turn) => turn.groups.flatMap((group) => group.cells.map((cell) => ({ ...cell, turn: turn.turn })))), [turns])
  const timed = spans.filter((cell) => Number.isFinite(cell.startedAt))
  const start = timed[0]?.startedAt ?? 0
  const end = Math.max(start + 1, ...timed.map((cell) => (cell.startedAt ?? start) + ((cell.timeSeconds ?? 0) * 1000 || 80)))
  const total = end - start
  return <section className={timelineCss.root} aria-label="Timeline overview">
    <div className={timelineCss.plot}>
      <div className={timelineCss.labels}><span>0 ms</span><span>{formatDuration(total / 2000)}</span><span>{formatDuration(total / 1000)}</span></div>
      <div className={timelineCss.track} tabIndex="0">
        {timed.length === 0 ? <span className={timelineCss.empty}>No timing data</span> : <div className={timelineCss.lanes} style={{ '--trajectory-domain-left': '0%', '--trajectory-domain-width': '100%' }}>
          {timed.map((cell, index) => {
            const left = ((cell.startedAt - start) / total) * 100
            const duration = actualDuration ? Math.max(0.8, (((cell.timeSeconds ?? 0) * 1000) / total) * 100) : Math.max(1.4, 88 / timed.length)
            return <button key={cell.recordId || `${cell.kind}-${index}`} className={timelineCss.span} data-timeline-span={cell.kind === 'message' ? 'message' : cell.kind} data-selected={selectedId === undefined ? undefined : selectedId === cell.recordId ? 'true' : 'false'} data-error={cell.isError ? 'true' : undefined} data-assistant-timing={cell.kind === 'message' && cell.assistantMetrics?.timingRecorded ? 'true' : undefined} data-equal-duration={!actualDuration ? 'true' : undefined} aria-label={`${kindLabel[cell.kind]} ${cell.text}`} onClick={() => onSelect(cell)} style={{ '--trajectory-span-left': `${left}%`, '--trajectory-span-width': `${duration}%`, '--trajectory-span-lane': cell.kind === 'tool' ? 1 : cell.kind === 'message' ? 0 : 2, '--trajectory-span-gap': '1px', '--trajectory-assistant-ttft': '0%' }} />
          })}
        </div>}
      </div>
    </div>
  </section>
}

function Metric({ value }) { return <span className={cellCss.metric}>{value ?? ''}</span> }

function Cell({ cell, selected, onSelect, turnStart, turnEnd }) {
  const label = kindLabel[cell.kind] || cell.kind
  return <tr tabIndex="0" data-kind={cell.kind} data-selected={selected || undefined} data-turn-start={turnStart || undefined} data-turn-end={turnEnd || undefined} data-error={cell.isError || undefined} onClick={() => onSelect(cell)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(cell) }}>
    <td className={tableCss.event}>
      {turnStart && <span className={tableCss.turnLabel}><span className={tableCss.turnLabelFull}>Turn {turnStart}</span><span className={tableCss.turnLabelCompact}>T{turnStart}</span></span>}
      <span className={tableCss.turnRail} aria-hidden="true" />
      {selected && <span className={tableCss.selectionRail} aria-hidden="true" />}
      <div className={tableCss.eventInner}>
        <div className={tableCss.kindSlot}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`}><span className={tableCss.kindTagIcon} aria-hidden="true">•</span><span className={tableCss.kindTagLabel}>{label}</span></span></div>
      </div>
    </td>
    <td className={tableCss.content}>
      <div className={tableCss.contentText} title={cell.text}>{cell.text}</div>
      {cell.result && <span className={cell.isError ? `${tableCss.inlineResult} ${tableCss.error}` : tableCss.inlineResult}><span className={tableCss.arrow}>→</span>{cell.result}</span>}
    </td>
    <td className={tableCss.content}><div className={tableCss.eventInner}><Metric value={cell.input} /><Metric value={cell.output} /><Metric value={cell.think} /><span className={tableCss.time}>{formatDuration(cell.timeSeconds)}</span></div></td>
  </tr>
}

function Detail({ cell, onClose }) {
  if (!cell) return <aside className={tableCss.details} aria-label="Record details"><div className="empty-detail"><FileJson size={22} /><span>Select a record to inspect</span></div></aside>
  const content = cell.outputDetail || cell.inputDetail || ''
  return <aside className={tableCss.details} aria-label="Record details">
    <div className={tableCss.detailsHeader}><div className={tableCss.detailsTitle}><span className={`${tableCss.kindTag} ${kindClass[cell.kind]}`}>{kindLabel[cell.kind]}</span><span className={tableCss.detailsLocation}>{cell.text}</span></div><button className={tableCss.close} type="button" aria-label="Close details" title="Close details" onClick={onClose}><X size={14} /></button></div>
    <div className={tableCss.detailTabs} role="tablist"><button className={`${tableCss.detailTab} ${tableCss.detailTabActive}`} type="button" role="tab" aria-selected="true">Overview</button><button className={tableCss.detailTab} type="button" role="tab" aria-selected="false">Raw JSON</button></div>
    <div className={tableCss.detailBody}>
      <dl className={tableCss.overview}><div><dt>Record</dt><dd>{cell.recordId || '—'}</dd></div><div><dt>Time</dt><dd>{formatTime(cell.startedAt)}</dd></div><div><dt>Duration</dt><dd>{formatDuration(cell.timeSeconds)}</dd></div>{cell.callId && <div><dt>Call ID</dt><dd>{cell.callId}</dd></div>}{cell.toolName && <div><dt>Tool</dt><dd>{cell.toolName}</dd></div>}</dl>
      {cell.thinkingDetail && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Thinking</h3><div className={tableCss.markdownPayload}><ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.thinkingDetail}</ReactMarkdown></div></section>}
      {content && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>{cell.kind === 'user' ? 'Input' : 'Output'}</h3><div className={tableCss.markdownPayload}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div></section>}
      {cell.inputDetail && cell.kind === 'tool' && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Arguments</h3><pre className={tableCss.jsonPayload}>{cell.inputDetail}</pre></section>}
      {cell.outputBlocks?.length > 0 && <section className={tableCss.overviewSection}><h3 className={tableCss.overviewHeading}>Result blocks</h3>{cell.outputBlocks.map((block, index) => <pre className={tableCss.resultBlockText} key={index}>{block.content}</pre>)}</section>}
      {(cell.input || cell.output || cell.think) && <section className={tableCss.usagePanel}><section className={tableCss.usageGroup}><h4 className={tableCss.usageHeading}>Usage</h4><dl className={tableCss.overview}><div><dt>Input</dt><dd>{cell.input ?? '—'}</dd></div><div><dt>Output</dt><dd>{cell.output ?? '—'}</dd></div><div><dt>Reasoning</dt><dd>{cell.think ?? '—'}</dd></div></dl></section></section>}
    </div>
  </aside>
}

function Turn({ turn, selectedId, onSelect, collapsed, onToggle }) {
  return <section className={turnCss.root} data-turn={turn.turn}>
    <div className={turnHeaderCss.root}><div className={turnHeaderCss.inner}><button className={turnHeaderCss.title} type="button" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />} Turn {turn.turn}</button><div className={turnHeaderCss.columns}><span className={turnHeaderCss.column}>Input</span><span className={turnHeaderCss.column}>Output</span><span className={turnHeaderCss.column}>Thinking</span><span className={turnHeaderCss.column}>Time</span></div></div></div>
    {!collapsed && <div className={turnCss.body}>{turn.groups.map((group) => <div key={group.title}><div className={groupCss.root}><span className={groupCss.title}>{group.title}</span><span className={groupCss.description}>{group.cells.length} records</span></div><table className={tableCss.table} data-scroll-ready="true"><colgroup><col className={tableCss.eventColumn} /><col className={tableCss.contentColumn} /><col className={tableCss.contentColumn} /></colgroup><tbody>{group.cells.map((cell, index) => <Cell key={cell.recordId || `${cell.index}-${index}`} cell={cell} selected={selectedId === cell.recordId} onSelect={onSelect} turnStart={index === 0 && group === turn.groups[0] ? turn.turn : undefined} turnEnd={index === group.cells.length - 1} />)}</tbody></table></div>)}</div>}
  </section>
}

function App() {
  const inputRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [actualDuration, setActualDuration] = useState(true)
  const [collapsed, setCollapsed] = useState(new Set())

  const openFile = () => inputRef.current?.click()
  const handleFile = async (file) => {
    if (!file) return
    try {
      const next = parsePiJsonl(await file.text())
      setData(next); setFileName(file.name); setError(''); setSelected(null); setCollapsed(new Set())
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setData(null) }
  }
  const visible = useMemo(() => {
    if (!data || !query.trim()) return data?.turns ?? []
    const needle = query.trim().toLowerCase()
    return data.turns.map((turn) => ({ ...turn, groups: turn.groups.map((group) => ({ ...group, cells: group.cells.filter((cell) => `${cell.text} ${cell.inputDetail || ''} ${cell.outputDetail || ''}`.toLowerCase().includes(needle)) })).filter((group) => group.cells.length > 0) })).filter((turn) => turn.groups.length > 0)
  }, [data, query])

  return <main className="app-shell">
    <input ref={inputRef} className="file-input" type="file" accept=".jsonl,application/jsonl,application/json" onChange={(event) => handleFile(event.target.files?.[0])} />
    {!data ? <section className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}><FileJson size={32} strokeWidth={1.4} /><h1>Pi Agent Trajectory</h1><p>Open a Pi Agent session JSONL file to inspect its recorded turns.</p><button type="button" className="open-button" onClick={openFile}><FolderOpen size={15} /> Open JSONL</button>{error && <p className="error-message" role="alert">{error}</p>}</section> : <div className={viewsCss.root}>
      <header className="session-header"><div><span className="eyebrow">PI AGENT SESSION</span><h1>{fileName}</h1><p>{data.header.cwd || 'Working directory unavailable'} <span>·</span> {data.header.modelId || data.header.provider || 'Recorded session'}</p></div><div className="header-actions"><span className="stat">{data.stats.turns} turns</span><span className="stat">{data.stats.tools} tools</span><button type="button" className="header-button" onClick={openFile}><FolderOpen size={14} /> Open another</button></div></header>
      <Toolbar query={query} setQuery={setQuery} actualDuration={actualDuration} setActualDuration={setActualDuration} onOpen={openFile} />
      <Timeline turns={visible} selectedId={selected?.recordId} onSelect={setSelected} actualDuration={actualDuration} />
      <div className={viewsCss.ledger}><div className={tableCss.split}><div className={tableCss.tablePane}>{visible.length === 0 ? <div className="no-results"><Search size={18} /> No matching records</div> : visible.map((turn) => <Turn key={turn.turn} turn={turn} selectedId={selected?.recordId} onSelect={setSelected} collapsed={collapsed.has(turn.turn)} onToggle={() => setCollapsed((previous) => { const next = new Set(previous); next.has(turn.turn) ? next.delete(turn.turn) : next.add(turn.turn); return next })} />)}</div><Detail cell={selected} onClose={() => setSelected(null)} /></div></div>
    </div>}
  </main>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
