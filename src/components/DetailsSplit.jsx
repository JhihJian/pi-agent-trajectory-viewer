import React, { useRef, useState } from 'react'
import { Detail } from './Detail.jsx'
import tableCss from './reference/TrajectoryTable.module.css'

// Shared list-plus-details shell for the reading and trace views, matching the
// TrajectoryTable split layout (draggable 320-720px details pane).
export function DetailsSplit({ selected = null, records = [], onSelect, onClose, className = '', children }) {
  const splitRef = useRef(null)
  const resize = useRef(null)
  const [detailsWidth, setDetailsWidth] = useState(480)
  const boundedWidth = value => Math.max(320, Math.min(720, (splitRef.current?.clientWidth ?? 960) - 240, value))
  return <div ref={splitRef} className={`${tableCss.split} viewer-split ${className}`} data-details-open={Boolean(selected)} style={{ '--details-width': `${detailsWidth}px` }}>
    {children}
    {selected && <><div className="details-resizer" role="separator" aria-label="Resize details" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={720} aria-valuenow={detailsWidth} tabIndex={0} onDoubleClick={() => setDetailsWidth(480)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setDetailsWidth(value => boundedWidth(value + (event.key === 'ArrowLeft' ? 16 : -16))) } }} onPointerDown={event => { if (event.button !== 0) return; resize.current = { x: event.clientX, width: detailsWidth }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }} onPointerMove={event => { if (resize.current) setDetailsWidth(boundedWidth(resize.current.width + resize.current.x - event.clientX)) }} onPointerUp={() => { resize.current = null }} onPointerCancel={() => { resize.current = null }} onLostPointerCapture={() => { resize.current = null }} /><Detail cell={selected} records={records} onNavigate={onSelect} onClose={() => onClose?.()} /></>}
  </div>
}
