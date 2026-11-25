import React from 'react'
import { Detail } from '../components/Detail.jsx'
import { DiagnosticView } from '../components/DiagnosticView.jsx'
import { JsonTree } from '../components/JsonTree.jsx'
import { ReadingView } from '../components/ReadingView.jsx'
import { RulesEditor } from '../components/RulesEditor.jsx'
import { SessionCatalog } from '../components/SessionCatalog.jsx'
import { Timeline } from '../components/Timeline.jsx'
import { TraceView } from '../components/TraceView.jsx'
import { TrajectoryTable } from '../components/TrajectoryTable.jsx'
import { TrajectoryToolbar } from '../components/TrajectoryToolbar.jsx'
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx'
import { TrajectoryTimeline } from '../components/TrajectoryTimeline.jsx'
import { Tooltip } from '../components/Tooltip.jsx'
import { WorkspaceDemo } from '../components/WorkspaceDemo.jsx'
import { Chat } from '../components/chat/index.js'

const sources = import.meta.glob('../components/*.jsx', { query: '?raw', import: 'default' })

export const component = {
  Detail, DiagnosticView, JsonTree, ReadingView, RulesEditor, SessionCatalog, Timeline, TraceView, TrajectoryTable, TrajectoryToolbar, TrajectoryViewer, TrajectoryTimeline, Tooltip, WorkspaceDemo,
}

export const categories = [
  { id: 'all', name: 'All' },
  { id: 'trajectory', name: 'Trajectory' },
  { id: 'detail', name: 'Detail' },
]

const entries = [
  ['trajectory-viewer', 'Trajectory Viewer', 'Complete workspace: timeline, ledger and details', 'trajectory', TrajectoryViewer, 'TrajectoryViewer', 'TrajectoryViewer', 'viewer', 'composite'],
  ['session-catalog', 'Session Catalog', 'Sources, date groups and searchable session list', 'trajectory', SessionCatalog, 'SessionCatalog', 'SessionCatalog', 'viewer', 'composite'],
  ['workspace', 'Workspace', 'Combined minimal app: catalog, tail reading, views, rules', 'trajectory', WorkspaceDemo, 'WorkspaceDemo', 'WorkspaceDemo', 'viewer', 'composite'],
  ['rules-editor', 'Tool Rules Editor', 'Custom tool summary rules with regex validation', 'trajectory', RulesEditor, 'RulesEditor', 'RulesEditor', 'detail', 'leaf'],
  ['trajectory-table', 'Trajectory Table', 'Virtualized session records with folding and search', 'trajectory', TrajectoryTable, 'TrajectoryTable', 'TrajectoryTable', 'table', 'composite'],
  ['timeline', 'Timeline', 'Zoomable, draggable overview of the whole session', 'trajectory', Timeline, 'Timeline', 'Timeline', 'timeline', 'composite'],
  ['reading-view', 'Reading View', 'Turn-based reading thread with skill, goal and compaction cards', 'trajectory', ReadingView, 'ReadingView', 'ReadingView', 'viewer', 'composite'],
  ['trace-view', 'Trace View', 'Execution tree with tool summaries, status and a copyable report', 'trajectory', TraceView, 'TraceView', 'TraceView', 'table', 'composite'],
  ['diagnostic-view', 'Diagnostic View', 'Raw JSONL rows, parse issues and full record JSON', 'detail', DiagnosticView, 'DiagnosticView', 'DiagnosticView', 'json', 'composite'],
  ['detail', 'Detail', 'Tabbed record details with markdown, images and usage', 'detail', Detail, 'Detail', 'Detail', 'detail', 'composite'],
  ['json-tree', 'JSON Tree', 'Expandable JSON with copy value, path and raw JSON', 'detail', JsonTree, 'JsonTree', 'JsonTree', 'json', 'leaf'],
  ['trajectory-toolbar', 'Trajectory Toolbar', 'View switch, duration, turn and call toggles plus search', 'trajectory', TrajectoryToolbar, 'TrajectoryToolbar', 'TrajectoryToolbar', 'timeline', 'leaf'],
  ['trajectory-timeline', 'Trajectory Timeline', 'Pointer-level timeline engine: drag, zoom, pan, range', 'trajectory', TrajectoryTimeline, 'TrajectoryTimeline', 'TrajectoryTimeline', 'timeline', 'leaf'],
  ['tooltip', 'Tooltip', 'Delayed fixed-position tooltip via portal', 'detail', Tooltip, 'Tooltip', 'Tooltip', 'json', 'leaf'],
  ['ai-chat', 'AI Chat', 'Full AI SDK chat: markdown, tools, sources and question cards', 'detail', Chat, 'Chat', 'Chat', 'viewer', 'composite'],
]

const searchAliases = {
  'trajectory-viewer': 'workspace full app timeline ledger details search fold collapse range',
  'session-catalog': 'catalog sessions sources sidebar list search date groups picker',
  workspace: 'combined app catalog tail window live rules views demo minimal',
  'rules-editor': 'rules editor regex custom tool summary validate toggle',
  'trajectory-table': 'table records list virtualized rows fold collapse search turn calls',
  timeline: 'timeline zoom drag pan range selection overview blocks',
  'reading-view': 'reading thread compact conversation cards skill goal compaction subagent markdown',
  'trace-view': 'trace execution tree tool summary report status batch export',
  'diagnostic-view': 'diagnostic raw jsonl rows parse issues json inspection events',
  detail: 'detail panel tabs markdown image usage thinking raw json',
  'json-tree': 'json tree expand copy path value',
  'trajectory-toolbar': 'toolbar view switch duration turns calls toggles search field',
  'trajectory-timeline': 'timeline pointer engine drag zoom pan edge selection',
  tooltip: 'tooltip hint portal hover delay',
  'ai-chat': 'ai chat assistant message stream tools reasoning sources question prompt composer markdown shiki',
}

export const catalog = entries.map(([slug, name, description, category, Component, exportName, filename, icon, kind]) => ({
  slug,
  name,
  description,
  category,
  Component,
  exportName,
  filename,
  icon,
  kind,
  source: '',
  loadSource: sources[`../components/${filename}.jsx`],
}))

export const componentFilename = entry => entry.filename

export function matchesComponent(entry, query) {
  return `${entry.name} ${entry.description} ${searchAliases[entry.slug] || ''}`.toLowerCase().includes(query.trim().toLowerCase())
}
