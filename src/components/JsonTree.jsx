import React, { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import './styles/detail.css'

export async function copyText(value) {
  if (globalThis.navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return } catch { /* Try the local-page fallback. */ }
  }
  if (typeof document === 'undefined') throw new Error('Clipboard unavailable')
  const previous = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0'
  document.body.append(textarea)
  try {
    textarea.select()
    if (!document.execCommand?.('copy')) throw new Error('Clipboard unavailable')
  } finally {
    textarea.remove()
    previous?.focus({ preventScroll: true })
  }
}

export function CopyButton({ value, label = 'Copy', title = label }) {
  const [status, setStatus] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    try { await copyText(value); setStatus('Copied') } catch { setStatus('Copy failed') }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(''), 1800)
  }
  return <button type="button" className="output-action" onClick={copy} title={title} aria-label={title}><Copy size={13} /><span aria-live="polite">{status || label}</span></button>
}

export function jsonPath(parent, key, array = false) {
  return array ? `${parent}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
}

function jsonText(value, pretty = true) {
  return JSON.stringify(value, null, pretty ? 2 : undefined) ?? 'undefined'
}

/**
 * 一个 JSON 节点。整棵树是只读展示：没有折叠箭头、没有复制按钮、没有「展开
 * 全部」。嵌套结构一次展开到底，长字符串按原样给出，读的是数据本身，不需要
 * 在树上点来点去。内容区自己有高度上限，长内容在块内滚动。
 */
function JsonNode({ value, name, path, depth }) {
  const branch = value !== null && typeof value === 'object'
  const entries = branch ? Object.entries(value) : []
  const text = typeof value === 'string' ? value : jsonText(value)
  return <div className="json-node" data-json-path={path}>
    <div className="json-node-row">
      {name !== undefined && <span className="json-key">{JSON.stringify(name)}: </span>}
      {branch ? <span className="json-summary">{Array.isArray(value) ? `[${entries.length} items]` : `{${entries.length} keys}`}</span> : <span className={`json-value json-${value === null ? 'null' : typeof value}`}>{typeof value === 'string' ? `"${text}"` : text}</span>}
    </div>
    {branch && <div className="json-children">{entries.map(([key, child]) => <JsonNode key={key} name={key} value={child} depth={depth + 1} path={jsonPath(path, key, Array.isArray(value))} />)}</div>}
  </div>
}

/**
 * JSON 树。工具栏只留说明文字，树里没有任何按钮。
 */
export function JsonTree({ value, label = 'JSON' }) {
  return <div className="detail-json" data-wrap="true" role="group" aria-label={label}>
    <div className="long-output-toolbar"><span className="long-output-meta">{label}</span></div>
    <div className="json-tree-content"><JsonNode value={value} path="$" depth={0} /></div>
  </div>
}
