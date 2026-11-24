import React, { useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { activeRules, defaultSummaryRules, normalizeRules, validateRules } from '../lib/tool-summaries.js'
import './styles/views.css'

// Minimal tool-summary rules editor, adapted from the codex-session-renderer
// "summary rules" dialog (public/models/summary-rules.js): custom rules run
// before the built-ins, toggle per rule, regex validation on every change.
export function RulesEditor({ rules = [], onChange, className = '' }) {
  const errors = validateRules(rules)
  const errorFor = (index, field) => errors.find((error) => error.index === index && error.field === field)?.message
  const update = (index, patch) => onChange?.(rules.map((rule, position) => (position === index ? { ...rule, ...patch } : rule)))
  const remove = (index) => onChange?.(rules.filter((_, position) => position !== index))
  const add = () => onChange?.([...normalizeRules(rules), { id: `custom-${Date.now()}`, label: 'Custom rule', enabled: true, tool: '', pattern: '', title: '', summary: '{argumentText}' }])
  return <div className={`rules-editor ${className}`}>
    <div className="rules-editor-head">
      <strong>Tool summary rules</strong>
      <span>{rules.length} custom · {defaultSummaryRules.length} built-in</span>
      <button type="button" className="rules-editor-button" onClick={add}><Plus size={12} /> Add rule</button>
      <button type="button" className="rules-editor-button" onClick={() => onChange?.([])} title="Remove all custom rules"><RotateCcw size={12} /> Reset</button>
    </div>
    <p className="rules-editor-note">Custom rules run before the {defaultSummaryRules.length} built-ins and only apply when the title and pattern are valid. Arguments and output always stay available verbatim in the details panel.</p>
    {rules.length === 0 && <p className="rules-editor-empty">No custom rules yet. Add one to try the matching engine.</p>}
    {normalizeRulesWithRaw(rules).map((entry) => {
      const rule = entry.rule
      const invalid = errors.some((error) => error.index === entry.index)
      return <div key={rule.id} className="rules-editor-row" data-invalid={invalid || undefined}>
        <label className="rules-editor-enabled"><input type="checkbox" checked={rule.enabled} onChange={event => update(entry.index, { enabled: event.target.checked })} aria-label={`${rule.label || rule.id} enabled`} /><strong>{rule.label}</strong></label>
        <div className="rules-editor-fields">
          <label>Tool<input value={rule.tool} placeholder="read | bash | /rg/" onChange={event => update(entry.index, { tool: event.target.value })} />{errorFor(entry.index, 'tool') && <em>{errorFor(entry.index, 'tool')}</em>}</label>
          <label>Pattern<input value={rule.pattern} placeholder="^rg\\s+--files\\b" onChange={event => update(entry.index, { pattern: event.target.value })} />{errorFor(entry.index, 'pattern') && <em>{errorFor(entry.index, 'pattern')}</em>}</label>
          <label>Title<input value={rule.title} placeholder="List files" onChange={event => update(entry.index, { title: event.target.value })} />{errorFor(entry.index, 'title') && <em>{errorFor(entry.index, 'title')}</em>}</label>
          <label>Summary<input value={rule.summary} placeholder="{path}" onChange={event => update(entry.index, { summary: event.target.value })} /></label>
        </div>
        <button type="button" className="rules-editor-delete" aria-label={`Delete ${rule.label}`} onClick={() => remove(entry.index)}><Trash2 size={12} /></button>
      </div>
    })}
    <details className="rules-editor-builtin">
      <summary>Built-in rules ({defaultSummaryRules.length})</summary>
      <ul>{activeRules([]).map((rule) => <li key={rule.id}><strong>{rule.title}</strong><span>{rule.tool}</span><code>{rule.pattern.slice(0, 60)}</code></li>)}</ul>
    </details>
  </div>
}

// Keep raw (invalid) rows editable while the projection consumes normalized ones.
function normalizeRulesWithRaw(rules) {
  return (Array.isArray(rules) ? rules : []).map((rule, index) => ({ rule: { enabled: true, ...rule }, index }))
}