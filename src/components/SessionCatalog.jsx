import React from 'react'
import { Search } from 'lucide-react'
import { groupSessions, sessionSizeLabel } from '../lib/session-catalog.js'
import { formatTime } from '../lib/parser.js'
import './styles/views.css'

// Session catalog sidebar, adapted from the codex-session-renderer session
// list (public/controllers/sessions.js): sources, date groups and search.
export function SessionCatalog({ sources = [], sessions = [], activeId = null, onSelect, query = '', onQueryChange, className = '' }) {
  const groups = groupSessions(sessions, { query })
  const sourceName = (sourceId) => sources.find((source) => source.id === sourceId)?.name || sourceId
  return <div className={`session-catalog ${className}`}>
    <div className="session-catalog-search"><Search size={12} /><input type="search" value={query} onChange={event => onQueryChange?.(event.target.value)} placeholder="Search sessions" aria-label="Search sessions" /></div>
    {sessions.length === 0 && <div className="view-empty"><h2>No sessions</h2><p>The workspace catalog is empty.</p></div>}
    {sources.map((source) => {
      const sourceGroups = groups.get(source.id) ?? []
      if (!sourceGroups.length) return null
      return <section key={source.id} className="session-catalog-source">
        <div className="session-catalog-source-head" title={source.root}><strong>{sourceName(source.id)}</strong><span>{sourceGroups.reduce((total, group) => total + group.sessions.length, 0)}</span></div>
        {sourceGroups.map(group => <div key={group.label} className="session-catalog-group">
          <div className="session-catalog-date">{group.label}</div>
          {group.sessions.map(session => <button key={session.id} type="button" className="session-catalog-item" data-active={session.id === activeId || undefined} onClick={() => onSelect?.(session)}>
            <span className="session-catalog-title" title={session.title}>{session.title || session.id}</span>
            <span className="session-catalog-meta">{session.model || 'Recorded session'}</span>
            <span className="session-catalog-meta" title={session.cwd}>{session.cwd}</span>
            <span className="session-catalog-foot"><em>{formatTime(Date.parse(session.updatedAt ?? session.startedAt))}</em><em>{sessionSizeLabel(session.sizeBytes)}</em></span>
          </button>)}
        </div>)}
      </section>
    })}
    {sessions.length > 0 && [...groups.keys()].length === 0 && <div className="view-empty"><h2>No matches</h2><p>Try another keyword or clear the search.</p></div>}
  </div>
}
