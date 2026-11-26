import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('renders continuous turn rows, search state, calls and timeline boundaries', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { Detail, Turn, Timeline, TrajectoryToolbar: Toolbar, TrajectoryTable } = await server.ssrLoadModule('/src/components/index.js')
    const turn = { turn: 1, groups: [
      { title: 'User', cells: [{ kind: 'user', recordId: 'u', text: 'hello', startedAt: 1000 }] },
      { title: 'Step 1', cells: [{ kind: 'message', recordId: 'a', text: 'answer', startedAt: 2000 }, { kind: 'tool', recordId: 'c', text: 'read', startedAt: 3000 }] },
    ] }
    const props = { turn, onSelect() {}, collapsedAssistants: new Set(), query: 'read' }
    const html = renderToStaticMarkup(React.createElement(Turn, props))
    assert.equal((html.match(/<table\b/g) || []).length, 1)
    assert.equal((html.match(/<col\b/g) || []).length, 2)
    assert.equal((html.match(/data-search-match="false"/g) || []).length, 0)
    assert.match(html, /data-kind="tool"[^>]*data-search-match="true"/)
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(Turn, { ...props, query: '', collapsedAssistants: new Set(['a']) })), /data-kind="tool"/)
    assert.match(renderToStaticMarkup(React.createElement(TrajectoryTable, { ...props, turns: [turn], collapsedAssistants: new Set(['a']), collapsedTurns: new Set([1]) })), /data-kind="tool"/)
    assert.match(renderToStaticMarkup(React.createElement(Turn, { ...props, query: 'not-present' })), /No matching records/)
    assert.match(renderToStaticMarkup(React.createElement(TrajectoryTable, { ...props, query: '', turns: [], collapsedTurns: new Set() })), /No records in this session/)
    const timeline = renderToStaticMarkup(React.createElement(Timeline, { turns: [turn], onSelect() {}, actualDuration: true, query: 'read' }))
    assert.match(timeline, /data-turn="1"/)
    assert.equal((timeline.match(/data-timeline-span=/g) || []).length, 3)
    assert.equal((timeline.match(/data-search-match="false"/g) || []).length, 2)

    const controls = { query: '', actualDuration: false, allTurnsCollapsed: false, allAssistantsCollapsed: false }
    const expandedToolbar = renderToStaticMarkup(React.createElement(Toolbar, controls))
    assert.match(expandedToolbar, /title="Use recorded duration"/)
    assert.match(expandedToolbar, /aria-label="Collapse all turns" aria-pressed="false"/)
    assert.equal((expandedToolbar.match(/⊟/g) || []).length, 2)
    const foldedToolbar = renderToStaticMarkup(React.createElement(Toolbar, { ...controls, actualDuration: true, allTurnsCollapsed: true, allAssistantsCollapsed: true }))
    assert.match(foldedToolbar, /title="Use equal-width blocks"/)
    assert.match(foldedToolbar, /aria-label="Expand all tool calls" aria-pressed="true"/)
    assert.equal((foldedToolbar.match(/⊞/g) || []).length, 2)

    const longOutput = 'line '.repeat(4000)
    const detail = renderToStaticMarkup(React.createElement(Detail, {
      cell: { kind: 'tool', recordId: 'call-1', text: 'bash', toolName: 'bash', inputDetail: '{"command":"npm test"}', outputDetail: longOutput, result: longOutput, raw: { call: { arguments: { command: 'npm test' } }, result: {} } },
      onClose() {},
    }))
    assert.match(detail, /Arguments/)
    assert.match(detail, /Output · 1 lines/)
    // 长输出不再截断成首尾两段：内容区自己滚动，说明行只报规模。
    assert.doesNotMatch(detail, /Show full/)
    assert.doesNotMatch(detail, /hidden from view/)
  } finally {
    await server.close()
  }
})