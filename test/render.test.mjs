import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('renders continuous turn rows, search state, calls and timeline boundaries', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { Turn, Timeline, TrajectoryTable } = await server.ssrLoadModule('/src/main.jsx')
    const turn = { turn: 1, groups: [
      { title: 'User', cells: [{ kind: 'user', recordId: 'u', text: 'hello', startedAt: 1000 }] },
      { title: 'Step 1', cells: [{ kind: 'message', recordId: 'a', text: 'answer', startedAt: 2000 }, { kind: 'tool', recordId: 'c', text: 'read', startedAt: 3000 }] },
    ] }
    const props = { turn, onSelect() {}, onToggle() {}, callsExpanded: true, query: 'read' }
    const html = renderToStaticMarkup(React.createElement(Turn, props))
    assert.equal((html.match(/<table\b/g) || []).length, 1)
    assert.equal((html.match(/<col\b/g) || []).length, 2)
    assert.equal((html.match(/data-search-match="false"/g) || []).length, 0)
    assert.match(html, /data-kind="tool"[^>]*data-search-match="true"/)
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(Turn, { ...props, query: '', callsExpanded: false })), /data-kind="tool"/)
    assert.match(renderToStaticMarkup(React.createElement(TrajectoryTable, { ...props, turns: [turn], callsExpanded: false, collapsedTurns: new Set([1]) })), /data-kind="tool"/)
    assert.match(renderToStaticMarkup(React.createElement(Turn, { ...props, query: 'not-present' })), /No matching records/)
    assert.match(renderToStaticMarkup(React.createElement(TrajectoryTable, { ...props, query: '', turns: [], collapsedTurns: new Set() })), /No records in this session/)
    const timeline = renderToStaticMarkup(React.createElement(Timeline, { turns: [turn], onSelect() {}, actualDuration: true, query: 'read' }))
    assert.match(timeline, /data-turn="1"/)
    assert.equal((timeline.match(/data-timeline-span=/g) || []).length, 3)
    assert.equal((timeline.match(/data-search-match="false"/g) || []).length, 2)
  } finally {
    await server.close()
  }
})