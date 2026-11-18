import React, { useRef, useState } from 'react'
import { ArrowUpRight, Check, FileJson, FolderOpen, ShieldCheck } from 'lucide-react'
import { parsePiJsonl } from '../lib/parser.js'
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx'
import '../components/styles/index.css'
import './viewer-demo.css'

export function ViewerDemo() {
  const inputRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [sessionRevision, setSessionRevision] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const openFile = () => inputRef.current?.click()
  const handleFile = async file => {
    if (!file) return
    setLoading(true)
    setDragging(false)
    try {
      const next = parsePiJsonl(await file.text())
      setSessionRevision(value => value + 1)
      setData(next); setFileName(file.name); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setData(null) }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value = '' }
  }
  return <main className="app-shell">
    <input ref={inputRef} className="file-input" type="file" accept=".jsonl,application/jsonl,application/json" onChange={event => handleFile(event.target.files?.[0])} />
    {!data ? <>
      <header className="welcome-header"><a className="brand" href="./" aria-label="Pi Trajectory home"><span className="brand-mark">π</span><span>Pi <strong>Trajectory</strong></span></a><span className="local-badge"><span /> Local session viewer</span></header>
      <div className="welcome-content"><div className="welcome-intro"><span className="eyebrow">A CLEAR VIEW OF EVERY STEP</span><h1>Follow the conversation.<br /><span>Understand the execution.</span></h1><p>Explore your agent’s messages, reasoning and tool calls in one readable timeline.</p></div>
        <section className="dropzone" data-dragging={dragging} aria-label="Open a session" aria-busy={loading} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={event => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}><div className="file-symbol"><FileJson size={28} strokeWidth={1.5} /></div><h2>{dragging ? 'Drop your session here' : 'Your session, step by step'}</h2><p>Drag a Pi Agent JSONL file here, or choose one to get started.</p><button type="button" className="open-button" disabled={loading} onClick={openFile}><FolderOpen size={16} /> {loading ? 'Reading session…' : 'Open JSONL file'}<ArrowUpRight size={15} /></button><span className="file-hint">.jsonl session files</span>{error && <p className="error-message" role="alert">{error}</p>}</section>
        <div className="welcome-features"><span><Check size={14} /> Conversation turns</span><span><Check size={14} /> Tool inputs & results</span><span><Check size={14} /> Searchable records</span></div>
      </div><footer className="welcome-footer"><ShieldCheck size={15} /> Files stay in your browser. Nothing is uploaded.</footer>
    </> : <>
      <header className="session-header"><span className="brand-mark" aria-hidden="true">π</span><div className="session-title"><span className="eyebrow">PI AGENT / SESSION</span><h1 title={fileName}>{fileName}</h1><p title={data.header.cwd}>{data.header.cwd || 'Working directory unavailable'} <span>·</span> {data.header.modelId || data.header.provider || 'Recorded session'}</p></div><div className="header-actions"><span className="stat"><strong>{data.stats.turns}</strong> turns</span><span className="stat"><strong>{data.stats.tools}</strong> tools</span><button type="button" className="header-button" disabled={loading} onClick={openFile}><FolderOpen size={14} /> {loading ? 'Reading…' : 'Open another'}</button></div></header>
      <TrajectoryViewer turns={data.turns} sessionRevision={sessionRevision} />
    </>}
  </main>
}
