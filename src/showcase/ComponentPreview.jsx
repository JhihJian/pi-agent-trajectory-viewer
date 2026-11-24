import React from 'react'
import { Maximize2 } from 'lucide-react'
import { ComponentDemo } from './ComponentDemo'

export function ComponentPreview({ entry, miniature = false }) {
  return <div className="component-preview" data-miniature={miniature || undefined} data-component={entry.slug}>
    {!miniature && <div className="preview-toolbar"><a className="preview-fullscreen" href={`#/demo/${entry.slug}`} title={`Open ${entry.name} fullscreen`} aria-label={`Open ${entry.name} fullscreen`}><Maximize2 size={11} /> Fullscreen</a></div>}
    <ComponentDemo demo={entry.slug} miniature={miniature} />
  </div>
}
