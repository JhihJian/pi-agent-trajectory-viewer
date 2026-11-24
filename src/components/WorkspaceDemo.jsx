import React, { useMemo, useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { SessionCatalog } from './SessionCatalog.jsx'
import { RulesEditor } from './RulesEditor.jsx'
import { TrajectoryViewer } from './TrajectoryViewer.jsx'
import { parsePiJsonl } from '../lib/parser.js'
import { DEFAULT_WINDOW_BYTES, MAX_WINDOW_BYTES, growWindow, readTailWindow, readVersion } from '../lib/tail-window.js'
import { activeRules, loadStoredRules, storeRules } from '../lib/tool-summaries.js'
import { demoSessions, demoSources } from '../data/demo-workspace.js'
import './styles/views.css'

// Combined minimal workspace, adapted from the codex-session-renderer app
// structure: session catalog -> tail-window reading -> the reading, trace and
// diagnostic projections -> tool summary rules, with a simulated live session.
export function WorkspaceDemo({ className = '' }) {
  const [activeId, setActiveId] = useState(demoSessions[0].id)
  const [query, setQuery] = useState('')
  const [rules, setRules] = useState(loadStoredRules)
  const [showRules, setShowRules] = useState(false)
  const session = demoSessions.find((entry) => entry.id === activeId) ?? demoSessions[0]
  const commitRules = (next) => { setRules(next); storeRules(next) }
  return <div className={`workspace-demo ${className}`}>
    <div className="workspace-head">
      <strong>Minimal workspace</strong>
      <span>{demoSources.length} sources · {demoSessions.length} sessions · rules render locally</span>
      <button type="button" className="workspace-button" aria-pressed={showRules} onClick={() => setShowRules(!showRules)}><PencilLine size={12} /> Summary rules</button>
    </div>
    <div className="workspace-body">
      <SessionCatalog sources={demoSources} sessions={demoSessions} activeId={activeId} onSelect={item => setActiveId(item.id)} query={query} onQueryChange={setQuery} />
      <WorkspaceSession key={session.id} session={session} rules={activeRules(rules)} />
    </div>
    {showRules && <div className="workspace-rules-panel" role="dialog" aria-label="Tool summary rules">
      <RulesEditor rules={rules} onChange={commitRules} />
      <button type="button" className="workspace-button workspace-rules-close" onClick={() => setShowRules(false)}>Close</button>
    </div>}
  </div>
}

function WorkspaceSession({ session, rules }) {
  const [windowBytes, setWindowBytes] = useState(DEFAULT_WINDOW_BYTES)
  const [chunks, setChunks] = useState([])
  const [liveCount, setLiveCount] = useState(0)
  const headerLine = useMemo(() => session.fixture.split('\n')[0], [session])
  const [lastId, setLastId] = useState(() => {
    try { return JSON.parse(session.fixture.split('\n').at(-1)).id ?? null } catch { return null }
  })
  const text = chunks.length ? `${session.fixture}\n${chunks.join('\n')}\n` : `${session.fixture}\n`
  const read = useMemo(() => readTailWindow(text, { windowBytes }), [text, windowBytes])
  const parsed = useMemo(() => {
    const tailLines = read.lines.filter((line) => line.lineNumber !== 1)
    try { return parsePiJsonl([headerLine, ...tailLines.map((line) => line.text)].join('\n')) } catch { return null }
  }, [read, headerLine])
  const version = readVersion({ size: read.totalBytes, modified: Date.parse(session.updatedAt ?? session.startedAt) })
  const addLive = () => {
    const next = liveCount + 1
    const user = `${session.id}-live-u${next}`
    const assistant = `${session.id}-live-a${next}`
    const rows = [
      { type: 'message', id: user, parentId: lastId, timestamp: new Date().toISOString(), message: { role: 'user', content: [{ type: 'text', text: `Follow-up ${next}: re-verify after the change.` }] } },
      { type: 'message', id: assistant, parentId: user, timestamp: new Date().toISOString(), message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: `Follow-up ${next} verified against the current state.` }] } },
    ]
    setChunks(current => [...current, rows.map(row => JSON.stringify(row)).join('\n')])
    setLastId(assistant)
    setLiveCount(next)
  }
  if (!parsed) return <div className="workspace-session"><div className="view-empty"><h2>Session could not be parsed</h2><p>The tail window holds no parseable Pi records.</p></div></div>
  return <div className="workspace-session">
    <div className="workspace-tailbar">
      <span role="status">Tail window {Math.round(read.windowBytes / 1024)} KB · records {read.firstLineNumber}–{read.lastLineNumber} of {read.totalLines}{read.reachedStart ? ' · start of file' : ''}{read.incompleteTail ? ' · unfinished tail record skipped' : ''}</span>
      <em>read {version}</em>
      <button type="button" className="workspace-button" disabled={read.reachedStart} onClick={() => setWindowBytes(current => growWindow(current))}><Plus size={12} /> Load earlier</button>
      <button type="button" className="workspace-button" onClick={addLive}>Simulate live record</button>
    </div>
    <div className="workspace-viewer"><TrajectoryViewer turns={parsed.turns} rows={parsed.rows} diagnostics={parsed.diagnostics} rules={rules} defaultDuration /></div>
  </div>
}
