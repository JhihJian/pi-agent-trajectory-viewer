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

/**
 * 目录跳转的目标：turn 是目录条目，null 是会话根（顶部），'end' 是末尾空隙。
 * 下一 turn 开头减去 32px 落在两 turn 之间的空隙，看得到下一 turn 的标题，且落点重瞄
 * 容差（±12px）叠加后仍不越过 outline 高亮判定的 64px 阈值。没有下一 turn（最后一条）时贴底。
 */
export function turnEndTop(pane, anchorPrefix, turn) {
  const next = document.getElementById(`${anchorPrefix}-turn-${turn + 1}`)
  if (!next) return pane.scrollHeight
  return Math.max(0, next.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 32)
}

function ReadingOutlineTurn({ entry, active, onJump }) {
  const [open, setOpen] = useState(true)
  const hasChildren = entry.context.length > 0
  // 点 turn 条目是「跳到这个 turn 的结尾」，不是开头：目录条目本身不占视口，跳开头看不到本条内容。
  const jump = () => onJump?.(entry.turn, null, 'end')
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
