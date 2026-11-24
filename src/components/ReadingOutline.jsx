import React, { useEffect, useState } from 'react'

// Reading view outline directory, adapted from the codex-session-renderer
// compact outline: a sticky table of contents (session root, turns, nested
// context events) that jumps to the anchored section and tracks scrolling.
const contextIcons = { compaction: 'C', 'skill-declaration': 'S', goal: 'G' }

export function ReadingOutline({ outline, activeTurn = null, onJump, className = '' }) {
  return <nav className={`reading-outline ${className}`} aria-label="Reading view outline">
    <div className="reading-outline-head"><strong>Outline</strong></div>
    <button type="button" className="reading-outline-item root" data-active={activeTurn === null || undefined} onClick={() => onJump?.(null)}>
      <span className="reading-outline-icon" aria-hidden="true">R</span>
      <span className="reading-outline-copy"><strong>{outline.title || 'Session'}</strong><em>{outline.turns.length} turns</em></span>
    </button>
    {outline.turns.map((entry) => <ReadingOutlineTurn key={entry.turn} entry={entry} active={entry.turn === activeTurn} onJump={onJump} />)}
  </nav>
}

function ReadingOutlineTurn({ entry, active, onJump }) {
  const [open, setOpen] = useState(true)
  const hasChildren = entry.context.length > 0
  const jump = () => onJump?.(entry.turn)
  return <div className="reading-outline-group">
    <div className="reading-outline-item turn" role="button" tabIndex={0} data-active={active || undefined} onClick={jump} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump() } }}>
      <span className="reading-outline-icon" aria-hidden="true">T</span>
      <span className="reading-outline-copy">
        <strong>Turn {entry.turn}{entry.status && entry.status !== 'complete' ? <span className="reading-outline-status" data-status={entry.status} /> : null}</strong>
        <em title={entry.title}>{entry.title}</em>
      </span>
      {(hasChildren || entry.subagentCount > 0) && <span className="reading-outline-badges">
        {entry.compaction && <span className="reading-outline-badge" data-badge="compaction" title="Contains a compaction event">C</span>}
        {entry.subagentCount > 0 && <span className="reading-outline-badge" data-badge="subagent" title={`${entry.subagentCount} subagent batch${entry.subagentCount === 1 ? '' : 'es'}`}>{entry.subagentCount}</span>}
        {hasChildren && <button type="button" className="reading-outline-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} turn ${entry.turn} context`} onClick={event => { event.stopPropagation(); setOpen(!open) }}>{open ? '▾' : '▸'}</button>}
      </span>}
    </div>
    {open && entry.context.map((context, index) => <button key={index} type="button" className="reading-outline-item context" data-active={active || undefined} onClick={() => onJump?.(entry.turn, index)}>
      <span className="reading-outline-icon" aria-hidden="true">{contextIcons[context.kind] || '·'}</span>
      <span className="reading-outline-copy"><em title={context.label}>{context.label}</em></span>
    </button>)}
  </div>
}

// Tracks the topmost visible turn section inside the given scroll pane.
export function useActiveReadingTurn(paneRef, anchorPrefix, turnCount, enabled = true) {
  const [activeTurn, setActiveTurn] = useState(null)
  useEffect(() => {
    if (!enabled) return
    const pane = paneRef.current
    if (!pane) return
    let lastRun = 0
    const measure = () => {
      lastRun = performance.now()
      const sections = [...pane.querySelectorAll('[data-outline-turn]')]
      if (!sections.length) { setActiveTurn(null); return }
      let current = null
      for (const section of sections) {
        if (section.getBoundingClientRect().top - pane.getBoundingClientRect().top <= 64) current = Number(section.dataset.outlineTurn)
        else break
      }
      // At the bottom of the pane the last turn can never cross the threshold.
      if (pane.scrollTop >= pane.scrollHeight - pane.clientHeight - 2) current = Number(sections.at(-1).dataset.outlineTurn)
      setActiveTurn(current)
    }
    // Timestamp-throttled synchronous measure: rAF never fires in background tabs.
    const onScroll = () => { if (performance.now() - lastRun >= 80) measure() }
    pane.addEventListener('scroll', onScroll, { passive: true })
    measure()
    return () => pane.removeEventListener('scroll', onScroll)
  }, [paneRef, anchorPrefix, turnCount, enabled])
  return activeTurn
}
