import React, { useMemo, useState } from 'react'
import { FileWarning } from 'lucide-react'
import { JsonTree } from './JsonTree.jsx'
import './styles/views.css'

// Raw record inspection, adapted from the codex-session-renderer diagnostic view.
// Parse failures are first-class diagnostics instead of a silent data loss, and
// the full JSON of every active-branch row stays one click away.
const pageSize = 100

const previewOf = (row) => {
  const text = typeof row?.message?.content === 'string' ? row.message.content
    : Array.isArray(row?.message?.content)
      ? row.message.content.filter((part) => part?.type === 'text').map((part) => part.text).join(' ')
      : ''
  const role = row?.message?.role ? `${row.message.role}: ` : ''
  const summary = text || (typeof row?.summary === 'string' ? row.summary : '') || (row?.type === 'session' ? [row.id, row.cwd].filter(Boolean).join(' · ') : '')
  return String(role + summary).replace(/\s+/g, ' ').trim().slice(0, 200)
}

function DiagnosticRow({ row, index }) {
  const [open, setOpen] = useState(false)
  return <div className="diagnostic-row" data-type={row.type}>
    <button type="button" className="diagnostic-row-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="diagnostic-row-index">#{index + 1}</span>
      <span className="diagnostic-row-type">{row.type}</span>
      <span className="diagnostic-row-preview">{previewOf(row) || '—'}</span>
    </button>
    {open && <div className="diagnostic-row-json"><JsonTree value={row} label={`Record #${index + 1}`} /></div>}
  </div>
}

export function DiagnosticView({ rows = [], diagnostics = [], query = '' }) {
  const needle = String(query || '').trim().toLowerCase()
  const visibleRows = useMemo(() => {
    const indexed = rows.map((row, index) => ({ row, index }))
    if (!needle) return indexed
    return indexed.filter(({ row }) => JSON.stringify(row).toLowerCase().includes(needle))
  }, [rows, needle])
  const [limit, setLimit] = useState(pageSize)
  const shown = visibleRows.slice(0, limit)
  const shownDiagnostics = needle ? diagnostics.filter((diagnostic) => JSON.stringify(diagnostic).toLowerCase().includes(needle)) : diagnostics
  return <div className="view-pane diagnostic-pane">
    <div className="view-heading"><span>Diagnostic records</span><span role="status">{visibleRows.length} records{needle ? ' matching' : ''}{diagnostics.length ? ` · ${diagnostics.length} parse issue${diagnostics.length === 1 ? '' : 's'}` : ''}</span></div>
    {shownDiagnostics.length > 0 && <div className="diagnostic-issues" role="alert">
      {shownDiagnostics.map((diagnostic, index) => <div key={index} className="diagnostic-issue">
        <FileWarning size={14} aria-hidden="true" />
        <span>Line {diagnostic.lineNumber} is not valid JSON and was skipped.</span>
        <code>{diagnostic.preview}</code>
      </div>)}
    </div>}
    {visibleRows.length === 0 && <div className="view-empty"><h2>{needle ? 'No matching records' : 'No raw records'}</h2><p>{needle ? 'Try another keyword or clear the search field.' : 'This session exposed no records to inspect.'}</p></div>}
    <div className="diagnostic-list">
      {shown.map(({ row, index }) => <DiagnosticRow key={row.id ?? index} row={row} index={index} />)}
    </div>
    {visibleRows.length > shown.length && <button type="button" className="diagnostic-more" onClick={() => setLimit(current => current + pageSize)}>Show more ({visibleRows.length - shown.length} remaining)</button>}
  </div>
}
