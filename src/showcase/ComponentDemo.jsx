import React, { useMemo } from 'react'
import { parsePiJsonl } from '../lib/parser.js'
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx'
import { TrajectoryTable } from '../components/TrajectoryTable.jsx'
import { Timeline } from '../components/Timeline.jsx'
import { Detail } from '../components/Detail.jsx'
import { JsonTree } from '../components/JsonTree.jsx'
import { sampleFixture } from '../data/sample-session.js'
const registry = {
  'trajectory-viewer': TrajectoryViewerDemo,
  'trajectory-table': TrajectoryTableDemo,
  timeline: TimelineDemo,
  detail: DetailDemo,
  'json-tree': JsonTreeDemo,
}

function TrajectoryViewerDemo() {
  const { turns } = useMemo(() => parsePiJsonl(sampleFixture), [])
  return <div className="demo-viewer"><TrajectoryViewer turns={turns} defaultDuration /></div>
}

function TrajectoryTableDemo() {
  const { turns } = useMemo(() => parsePiJsonl(sampleFixture), [])
  return <div className="demo-table"><TrajectoryTable turns={turns} onSelect={() => {}} /></div>
}

function TimelineDemo() {
  const { turns } = useMemo(() => parsePiJsonl(sampleFixture), [])
  return <div className="demo-timeline"><Timeline turns={turns} actualDuration={false} onSelect={() => {}} /></div>
}

function DetailDemo() {
  const { turns } = useMemo(() => parsePiJsonl(sampleFixture), [])
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
