import React, { useMemo, useState } from 'react'
import { parsePiJsonl } from '../lib/parser.js'
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx'
import { TrajectoryTable } from '../components/TrajectoryTable.jsx'
import { TrajectoryToolbar } from '../components/TrajectoryToolbar.jsx'
import { TrajectoryTimeline } from '../components/TrajectoryTimeline.jsx'
import { Timeline, translate } from '../components/Timeline.jsx'
import { Tooltip } from '../components/Tooltip.jsx'
import { ReadingView } from '../components/ReadingView.jsx'
import { TraceView } from '../components/TraceView.jsx'
import { DiagnosticView } from '../components/DiagnosticView.jsx'
import { SessionCatalog } from '../components/SessionCatalog.jsx'
import { RulesEditor } from '../components/RulesEditor.jsx'
import { Chat, MockChatTransport } from '../components/chat/index.js'
import '../components/chat/chat.css'
import { WorkspaceDemo } from '../components/WorkspaceDemo.jsx'
import { Detail } from '../components/Detail.jsx'
import { JsonTree } from '../components/JsonTree.jsx'
import { demoSessions, demoSources } from '../data/demo-workspace.js'
import { sampleFixture } from '../data/sample-session.js'
const registry = {
  'trajectory-viewer': TrajectoryViewerDemo,
  'trajectory-table': TrajectoryTableDemo,
  timeline: TimelineDemo,
  'reading-view': ReadingViewDemo,
  'trace-view': TraceViewDemo,
  'diagnostic-view': DiagnosticViewDemo,
  detail: DetailDemo,
  'json-tree': JsonTreeDemo,
  'trajectory-toolbar': TrajectoryToolbarDemo,
  'trajectory-timeline': TrajectoryTimelineDemo,
  tooltip: TooltipDemo,
  'session-catalog': SessionCatalogDemo,
  'rules-editor': RulesEditorDemo,
  workspace: WorkspaceInstanceDemo,
  'ai-chat': AiChatDemo,
}

function useParsed() {
  return useMemo(() => parsePiJsonl(sampleFixture), [])
}

function TrajectoryViewerDemo() {
  const { turns, rows, diagnostics } = useParsed()
  return <div className="demo-viewer"><TrajectoryViewer turns={turns} rows={rows} diagnostics={diagnostics} defaultDuration /></div>
}

function TrajectoryTableDemo() {
  const { turns } = useParsed()
  return <div className="demo-table"><TrajectoryTable turns={turns} onSelect={() => {}} /></div>
}

function TimelineDemo() {
  const { turns } = useParsed()
  return <div className="demo-timeline"><Timeline turns={turns} actualDuration={false} onSelect={() => {}} /></div>
}

function TrajectoryToolbarDemo() {
  const [query, setQuery] = useState('')
  const [actualDuration, setActualDuration] = useState(false)
  return <div className="demo-toolbar"><TrajectoryToolbar query={query} setQuery={setQuery} actualDuration={actualDuration} setActualDuration={setActualDuration} allTurnsCollapsed={false} onToggleTurns={() => {}} allAssistantsCollapsed={false} onToggleAssistants={() => {}} /></div>
}

function TrajectoryTimelineDemo() {
  const { turns } = useParsed()
  return <div className="demo-timeline"><TrajectoryTimeline t={translate} turns={turns} mode="sequence" range={null} onRangeChange={() => {}} /></div>
}

function TooltipDemo() {
  return <div className="demo-json demo-tooltip"><Tooltip label="Portal tooltip that appears after a 500 ms hover delay."><button type="button" className="demo-tooltip-target">Hover me</button></Tooltip></div>
}

function SessionCatalogDemo() {
  const [activeId, setActiveId] = useState(demoSessions[0].id)
  const [query, setQuery] = useState('')
  return <div className="demo-catalog"><SessionCatalog sources={demoSources} sessions={demoSessions} activeId={activeId} onSelect={item => setActiveId(item.id)} query={query} onQueryChange={setQuery} /></div>
}

function RulesEditorDemo() {
  const [rules, setRules] = useState([{ id: 'custom-demo', label: 'Deploy', enabled: true, tool: 'bash', pattern: 'deploy (?<env>\\S+)', title: 'Deploy to {env}', summary: '{match0}' }])
  return <div className="demo-catalog"><RulesEditor rules={rules} onChange={setRules} /></div>
}

function WorkspaceInstanceDemo() {
  return <div className="demo-workspace"><WorkspaceDemo /></div>
}

function AiChatDemo() {
  const transport = useMemo(() => new MockChatTransport(), [])
  return <div className="demo-chat"><Chat transport={transport} models={[{ id: 'demo/mock', name: 'Mock model' }]} emptyTitle="Try the mock chat" emptyDescription="Suggestions replay a scripted AI SDK message stream, including tools and a question card." /></div>
}

function ReadingViewDemo() {
  const { turns } = useParsed()
  return <div className="demo-viewer"><ReadingView turns={turns} /></div>
}

function TraceViewDemo() {
  const { turns, header } = useParsed()
  return <div className="demo-viewer"><TraceView turns={turns} header={{ id: header.id, cwd: header.cwd }} /></div>
}

function DiagnosticViewDemo() {
  const { rows, diagnostics } = useParsed()
  return <div className="demo-viewer"><DiagnosticView rows={rows} diagnostics={diagnostics} /></div>
}

function DetailDemo() {
  const { turns } = useParsed()
  const records = useMemo(() => turns.flatMap(turn => turn.groups.flatMap(group => group.cells.map(cell => ({ cell, turn: turn.turn })))), [turns])
  const tool = records.find(record => record.cell.kind === 'tool')?.cell
  return <div className="demo-detail">{tool ? <Detail cell={tool} records={records} onClose={() => {}} /> : <p className="demo-empty">No tool record in sample.</p>}</div>
}

function JsonTreeDemo() {
  const value = { command: 'npm test', cwd: '/data/dev/pi-agent-trajectory-viewer', exitCode: 0, tags: ['test', 'ci'] }
  return <div className="demo-json"><JsonTree value={value} label="Tool arguments" /></div>
}

export function ComponentDemo({ demo, miniature = false }) {
  const Demo = registry[demo]
  if (!Demo) return <p className="demo-empty">Demo unavailable.</p>
  return <div className="demo-scope" data-miniature={miniature || undefined}><Demo miniature={miniature} /></div>
}
