import React from 'react'
import { ComponentDemo } from './ComponentDemo'

export function ComponentPreview({ entry, miniature = false }) {
  return <div className="component-preview" data-miniature={miniature || undefined} data-component={entry.slug}>
    <ComponentDemo demo={entry.slug} miniature={miniature} />
  </div>
}
