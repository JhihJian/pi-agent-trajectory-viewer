import React from 'react'
import { Clock3, Search, X } from 'lucide-react'
import toolbarCss from './reference/TrajectoryToolbar.module.css'

const viewLabels = { ledger: 'Ledger', reading: 'Reading', trace: 'Trace', diagnostic: 'Diagnostic' }

export function TrajectoryToolbar({ query, setQuery, actualDuration, setActualDuration, allTurnsCollapsed, onToggleTurns, allAssistantsCollapsed, onToggleAssistants, view = 'ledger', setView, views = ['ledger'], showModes = true }) {
  return <div className={`${toolbarCss.root} viewer-toolbar`} role="toolbar" aria-label="Trajectory toolbar">
    <div className={toolbarCss.inner}>
      <div className={`${toolbarCss.actions} trajectory-controls`}>
        <div className={`${toolbarCss.actions} trajectory-views`} role="group" aria-label="View mode">
          {views.map(name => <button key={name} className={`${toolbarCss.toggle} view-toggle`} type="button" aria-label={`${viewLabels[name] || name} view`} aria-pressed={view === name} title={`Show the ${String(viewLabels[name] || name).toLowerCase()} view`} onClick={() => setView?.(name)}>{viewLabels[name] || name}</button>)}
        </div>
        {showModes && <>
          <button className={`${toolbarCss.toggle} duration-toggle`} type="button" aria-label="Use recorded duration" aria-pressed={actualDuration} title={actualDuration ? 'Use equal-width blocks' : 'Use recorded duration'} onClick={() => setActualDuration(!actualDuration)}><Clock3 className={toolbarCss.toggleIcon} size={12} /> Duration</button>
          <button className={toolbarCss.action} type="button" aria-label={allTurnsCollapsed ? 'Expand all turns' : 'Collapse all turns'} aria-pressed={allTurnsCollapsed} title={allTurnsCollapsed ? 'Expand all turns' : 'Collapse all turns'} onClick={onToggleTurns}><span className={toolbarCss.actionIcon} aria-hidden="true">{allTurnsCollapsed ? '⊞' : '⊟'}</span> Turns</button>
          <button className={toolbarCss.action} type="button" aria-label={allAssistantsCollapsed ? 'Expand all tool calls' : 'Collapse all tool calls'} aria-pressed={allAssistantsCollapsed} title={allAssistantsCollapsed ? 'Expand all tool calls' : 'Collapse all tool calls'} onClick={onToggleAssistants}><span className={toolbarCss.actionIcon} aria-hidden="true">{allAssistantsCollapsed ? '⊞' : '⊟'}</span> Calls</button>
        </>}
      </div>
      <div className={`${toolbarCss.search} search-field`}><Search size={11} className={toolbarCss.searchIcon} /><input className={toolbarCss.searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search trajectory" aria-label="Search trajectory" />{query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</div>
    </div>
  </div>
}
