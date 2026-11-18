import React from 'react'
import { Detail } from '../components/Detail.jsx'
import { JsonTree } from '../components/JsonTree.jsx'
import { Timeline } from '../components/Timeline.jsx'
import { TrajectoryTable } from '../components/TrajectoryTable.jsx'
import { TrajectoryToolbar } from '../components/TrajectoryToolbar.jsx'
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx'
import { TrajectoryTimeline } from '../components/TrajectoryTimeline.jsx'
import { Tooltip } from '../components/Tooltip.jsx'

const sources = import.meta.glob('../components/*.jsx', { query: '?raw', import: 'default' })

export const component = {
  Detail, JsonTree, Timeline, TrajectoryTable, TrajectoryToolbar, TrajectoryViewer, TrajectoryTimeline, Tooltip,
}

export const categories = [
  { id: 'all', name: 'All' },
  { id: 'trajectory', name: 'Trajectory' },
  { id: 'detail', name: 'Detail' },
]

const entries = [
  ['trajectory-viewer', 'Trajectory Viewer', 'Complete workspace: timeline, ledger and details', 'trajectory', TrajectoryViewer, 'TrajectoryViewer', 'TrajectoryViewer', 'viewer', 'composite'],
  ['trajectory-table', 'Trajectory Table', 'Virtualized session records with folding and search', 'trajectory', TrajectoryTable, 'TrajectoryTable', 'TrajectoryTable', 'table', 'composite'],
  ['timeline', 'Timeline', 'Zoomable, draggable overview of the whole session', 'trajectory', Timeline, 'Timeline', 'Timeline', 'timeline', 'composite'],
  ['detail', 'Detail', 'Tabbed record details with markdown, images and usage', 'detail', Detail, 'Detail', 'Detail', 'detail', 'composite'],
  ['json-tree', 'JSON Tree', 'Expandable JSON with copy value, path and raw JSON', 'detail', JsonTree, 'JsonTree', 'JsonTree', 'json', 'leaf'],
  ['trajectory-toolbar', 'Trajectory Toolbar', 'Duration, turn and call group toggles plus search', 'trajectory', TrajectoryToolbar, 'TrajectoryToolbar', 'TrajectoryToolbar', 'timeline', 'leaf'],
  ['trajectory-timeline', 'Trajectory Timeline', 'Pointer-level timeline engine: drag, zoom, pan, range', 'trajectory', TrajectoryTimeline, 'TrajectoryTimeline', 'TrajectoryTimeline', 'timeline', 'leaf'],
  ['tooltip', 'Tooltip', 'Delayed fixed-position tooltip via portal', 'detail', Tooltip, 'Tooltip', 'Tooltip', 'json', 'leaf'],
]

const searchAliases = {
  'trajectory-viewer': 'workspace full app timeline ledger details search fold collapse range',
  'trajectory-table': 'table records list virtualized rows fold collapse search turn calls',
  timeline: 'timeline zoom drag pan range selection overview blocks',
  detail: 'detail panel tabs markdown image usage thinking raw json',
  'json-tree': 'json tree expand copy path value',
  'trajectory-toolbar': 'toolbar duration turns calls toggles search field',
  'trajectory-timeline': 'timeline pointer engine drag zoom pan edge selection',
  tooltip: 'tooltip hint portal hover delay',
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
