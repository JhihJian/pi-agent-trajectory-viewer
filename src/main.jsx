import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, Check, Clock3, FileJson, FolderOpen, Search, ShieldCheck, X } from 'lucide-react'
import { parsePiJsonl } from './lib/parser.js'
import { allFolded, flattenTurns, foldTargets, toggleAllFolds, toggleCallGroups, toggleFold } from './lib/trajectory-view.js'
import { matchesSearch, trajectoryTimelineFocusIndexes } from './lib/timeline.js'
import { Timeline } from './components/Timeline.jsx'
import { TrajectoryTable } from './components/TrajectoryTable.jsx'
import toolbarCss from './components/reference/TrajectoryToolbar.module.css'
import viewsCss from './components/reference/views.module.css'
import './components/styles/index.css'
import './app.css'
export { Timeline } from './components/Timeline.jsx'
export { TrajectoryTable, Turn } from './components/TrajectoryTable.jsx'
export { Detail } from './components/Detail.jsx'

export function Toolbar({ query, setQuery, actualDuration, setActualDuration, allTurnsCollapsed, onToggleTurns, allAssistantsCollapsed, onToggleAssistants }) {
  return <div className={`${toolbarCss.root} viewer-toolbar`} role="toolbar" aria-label="Trajectory toolbar">
    <div className={toolbarCss.inner}>
      <div className={`${toolbarCss.actions} trajectory-controls`}>
        <button className={`${toolbarCss.toggle} duration-toggle`} type="button" aria-label="Use recorded duration" aria-pressed={actualDuration} title={actualDuration ? 'Use equal-width blocks' : 'Use recorded duration'} onClick={() => setActualDuration(!actualDuration)}><Clock3 className={toolbarCss.toggleIcon} size={12} /> Duration</button>
        <button className={toolbarCss.action} type="button" aria-label={allTurnsCollapsed ? 'Expand all turns' : 'Collapse all turns'} aria-pressed={allTurnsCollapsed} title={allTurnsCollapsed ? 'Expand all turns' : 'Collapse all turns'} onClick={onToggleTurns}><span className={toolbarCss.actionIcon} aria-hidden="true">{allTurnsCollapsed ? '⊞' : '⊟'}</span> Turns</button>
        <button className={toolbarCss.action} type="button" aria-label={allAssistantsCollapsed ? 'Expand all tool calls' : 'Collapse all tool calls'} aria-pressed={allAssistantsCollapsed} title={allAssistantsCollapsed ? 'Expand all tool calls' : 'Collapse all tool calls'} onClick={onToggleAssistants}><span className={toolbarCss.actionIcon} aria-hidden="true">{allAssistantsCollapsed ? '⊞' : '⊟'}</span> Calls</button>
      </div>
      <div className={`${toolbarCss.search} search-field`}><Search size={11} className={toolbarCss.searchIcon} /><input className={toolbarCss.searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search trajectory" aria-label="Search trajectory" />{query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</div>
    </div>
  </div>
}

function App() {
  const inputRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [sessionRevision, setSessionRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [actualDuration, setActualDuration] = useState(() => { try { return localStorage.getItem('pi-trajectory-duration') === 'true' } catch { return false } })
  const [collapsedTurns, setCollapsedTurns] = useState(new Set())
  const [collapsedAssistants, setCollapsedAssistants] = useState(new Set())
  const [range, setRange] = useState(null)
  const [focusRequest, setFocusRequest] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const turns = useMemo(() => data?.turns ?? [], [data])
  const records = useMemo(() => flattenTurns(turns), [turns])
  const targets = useMemo(() => foldTargets(records), [records])
  const focusIndexes = useMemo(() => trajectoryTimelineFocusIndexes(turns, range, actualDuration ? 'duration' : 'sequence'), [turns, range, actualDuration])
  const openFile = () => inputRef.current?.click()
  const handleFile = async file => {
    if (!file) return
    setLoading(true)
    setDragging(false)
    try {
      const next = parsePiJsonl(await file.text())
      setSessionRevision(value => value + 1)
      setData(next); setFileName(file.name); setError(''); setSelected(null); setQuery(''); setCollapsedTurns(new Set()); setCollapsedAssistants(new Set()); setRange(null); setFocusRequest(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setData(null) }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value = '' }
  }
  const clearRange = () => { setRange(null); setFocusRequest(null) }
  const changeRange = next => {
    setRange(next)
    if (next && window.matchMedia('(max-width: 760px)').matches) setSelected(null)
    const indexes = trajectoryTimelineFocusIndexes(turns, next, actualDuration ? 'duration' : 'sequence')
    const record = records.find(record => indexes?.has(record.position) && matchesSearch(record.cell, query, record.turn))
    setFocusRequest(record ? { index: record.position, focus: true } : null)
  }
  const changeDuration = value => {
    setActualDuration(value)
    clearRange()
    try { localStorage.setItem('pi-trajectory-duration', String(value)) } catch { /* Storage may be disabled. */ }
  }
  const toggleCalls = () => {
    clearRange()
    const next = toggleCallGroups(collapsedAssistants, targets.assistants)
    setCollapsedTurns(next.collapsedTurns)
    setCollapsedAssistants(next.collapsedAssistants)
  }
  const select = cell => {
    const record = records.find(record => record.cell === cell)
    if (record) {
      setCollapsedTurns(current => { const next = new Set(current); next.delete(record.turn); return next })
      setCollapsedAssistants(current => { const next = new Set(current); next.delete(record.assistantId); return next })
      if (!matchesSearch(cell, query, record.turn)) setQuery('')
      if (focusIndexes && !focusIndexes.has(record.position)) setRange(null)
      setFocusRequest({ index: record.position })
    } else if (!cell && selected) {
      const previous = records.find(record => record.cell === selected)
      if (previous) setFocusRequest({ index: previous.position, focus: true })
    }
    setSelected(cell?.recordId ? cell : null)
  }
  return <main className="app-shell">
    <input ref={inputRef} className="file-input" type="file" accept=".jsonl,application/jsonl,application/json" onChange={event => handleFile(event.target.files?.[0])} />
    {!data ? <>
      <header className="welcome-header"><a className="brand" href="./" aria-label="Pi Trajectory home"><span className="brand-mark">π</span><span>Pi <strong>Trajectory</strong></span></a><span className="local-badge"><span /> Local session viewer</span></header>
      <div className="welcome-content"><div className="welcome-intro"><span className="eyebrow">A CLEAR VIEW OF EVERY STEP</span><h1>Follow the conversation.<br /><span>Understand the execution.</span></h1><p>Explore your agent’s messages, reasoning and tool calls in one readable timeline.</p></div>
        <section className="dropzone" data-dragging={dragging} aria-label="Open a session" aria-busy={loading} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={event => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}><div className="file-symbol"><FileJson size={28} strokeWidth={1.5} /></div><h2>{dragging ? 'Drop your session here' : 'Your session, step by step'}</h2><p>Drag a Pi Agent JSONL file here, or choose one to get started.</p><button type="button" className="open-button" disabled={loading} onClick={openFile}><FolderOpen size={16} /> {loading ? 'Reading session…' : 'Open JSONL file'}<ArrowUpRight size={15} /></button><span className="file-hint">.jsonl session files</span>{error && <p className="error-message" role="alert">{error}</p>}</section>
        <div className="welcome-features"><span><Check size={14} /> Conversation turns</span><span><Check size={14} /> Tool inputs & results</span><span><Check size={14} /> Searchable records</span></div>
      </div><footer className="welcome-footer"><ShieldCheck size={15} /> Files stay in your browser. Nothing is uploaded.</footer>
    </> : <>
      <header className="session-header"><span className="brand-mark" aria-hidden="true">π</span><div className="session-title"><span className="eyebrow">PI AGENT / SESSION</span><h1 title={fileName}>{fileName}</h1><p title={data.header.cwd}>{data.header.cwd || 'Working directory unavailable'} <span>·</span> {data.header.modelId || data.header.provider || 'Recorded session'}</p></div><div className="header-actions"><span className="stat"><strong>{data.stats.turns}</strong> turns</span><span className="stat"><strong>{data.stats.tools}</strong> tools</span><button type="button" className="header-button" disabled={loading} onClick={openFile}><FolderOpen size={14} /> {loading ? 'Reading…' : 'Open another'}</button></div></header>
      <div className={`${viewsCss.root} trajectory-shell`}>
        <Toolbar query={query} setQuery={setQuery} actualDuration={actualDuration} setActualDuration={changeDuration} allTurnsCollapsed={allFolded(targets.turns, collapsedTurns)} onToggleTurns={() => { clearRange(); setCollapsedTurns(current => toggleAllFolds(current, targets.turns)) }} allAssistantsCollapsed={allFolded(targets.assistants, collapsedAssistants)} onToggleAssistants={toggleCalls} />
        <Timeline key={sessionRevision} turns={turns} selectedId={selected?.recordId} onSelect={select} actualDuration={actualDuration} query={query} range={range} onRangeChange={changeRange} onRecordFocus={index => setFocusRequest({ index, focus: true })} />
        <div className={`${viewsCss.ledger} trajectory-ledger`}><TrajectoryTable turns={turns} selectedId={selected?.recordId} onSelect={select} collapsedAssistants={collapsedAssistants} onToggleAssistant={id => { clearRange(); setCollapsedAssistants(current => toggleFold(current, id)) }} collapsedTurns={collapsedTurns} onToggleTurn={turn => { clearRange(); setCollapsedTurns(current => toggleFold(current, turn)) }} query={query} focusIndexes={focusIndexes} focusRequest={focusRequest} onClearRange={clearRange} /></div>
      </div>
    </>}
  </main>
}

if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
