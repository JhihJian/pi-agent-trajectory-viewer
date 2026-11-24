import React, { useEffect, useState } from 'react'
import { Box, Braces, GitBranch, ListTree, Menu, Search, Sparkles, Table2 } from 'lucide-react'
import { catalog, categories, componentFilename, matchesComponent } from '../data/catalog'
import { copyText } from '../components/JsonTree.jsx'
import { ComponentDemo } from './ComponentDemo.jsx'
import { ComponentPreview } from './ComponentPreview.jsx'
import { HomePage } from './HomePage.jsx'
import { ViewerDemo } from './ViewerDemo.jsx'
import './showcase.css'

const icons = { table: Table2, timeline: ListTree, json: Braces, detail: GitBranch, viewer: Box }

function readRoute() {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path.startsWith('demo/')) return path
  if (path === 'components' || path.startsWith('components/')) return path
  if (path === 'viewer') return path
  return ''
}

export function Showcase() {
  const [route, setRoute] = useState(readRoute)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [copied, setCopied] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const selected = catalog.find(entry => route === `components/${entry.slug}`)
  const [sourceText, setSourceText] = useState('')
  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); setNavOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    let alive = true
    setSourceText('')
    selected?.loadSource?.().then(text => { if (alive) setSourceText(text) }).catch(() => { /* Keep the fallback notice. */ })
    return () => { alive = false }
  }, [selected])
  const navigate = path => { window.location.hash = path ? `#/${path}` : '#/' }
  const isGallery = route === 'components'
  const isViewer = route === 'viewer'
  const demoEntry = route.startsWith('demo/') ? catalog.find(entry => entry.slug === route.slice(5)) : null
  const isHome = !isGallery && !selected && !isViewer && !demoEntry
  const filtered = catalog.filter(entry => (category === 'all' || entry.category === category) && matchesComponent(entry, query))
  const showCopied = async value => { try { await copyText(value); setCopied(value); setTimeout(() => setCopied(''), 1600) } catch { /* Clipboard unavailable. */ } }
  const navLinks = <>
    <a className="site-nav-link" href="#/">Overview</a>
    <a className="site-nav-link" href="#/components">Components</a>
    <a className="site-nav-link" href="#/viewer">Live viewer</a>
  </>
  return <div className="site-shell">
    <header className="site-header">
      <a className="site-brand" href="#/" aria-label="Pi Trajectory UI home"><span className="site-brand-mark">π</span><span>Pi <strong>Trajectory</strong> UI</span></a>
      <nav className="site-nav" aria-label="Site">{navLinks}</nav>
      <button className="site-menu" type="button" aria-label="Toggle navigation" aria-expanded={navOpen} onClick={() => setNavOpen(open => !open)}><Menu size={18} /></button>
    </header>
    {isHome && <HomePage navigate={navigate} />}
    {(isGallery || selected) && <div className={`site-layout ${selected ? 'with-detail' : ''}`}>
      <aside className={`site-sidebar ${navOpen ? 'open' : ''}`} aria-label="Components">
        <div className="site-search"><Search size={13} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search components" aria-label="Search components" /></div>
        <div className="site-categories" role="tablist" aria-label="Categories">
          {categories.map(item => <button key={item.id} type="button" role="tab" aria-selected={category === item.id} className="site-category" onClick={() => setCategory(item.id)}>{item.name}</button>)}
        </div>
        <nav className="site-list" aria-label="Component list">
          {filtered.map(entry => <a key={entry.slug} className={`site-item ${route === `components/${entry.slug}` ? 'active' : ''}`} href={`#/components/${entry.slug}`}>
            <span className="site-item-icon" aria-hidden="true">{React.createElement(icons[entry.icon] || Sparkles, { size: 15 })}</span>
            <span className="site-item-body"><span className="site-item-name">{entry.name}</span><span className="site-item-description">{entry.description}</span></span>
            <span className={`site-item-kind kind-${entry.kind}`}>{entry.kind}</span>
          </a>)}
          {filtered.length === 0 && <p className="site-empty">No components match “{query}”.</p>}
        </nav>
      </aside>
      <main className="site-main">
        {isGallery && <>
          <div className="site-page-head"><h1>Components</h1><p>Self-contained building blocks for agent trajectory interfaces. Every component owns its styles and works standalone in a React 18 app.</p></div>
          <div className="site-grid">{catalog.map(entry => <a key={entry.slug} className="site-card" href={`#/components/${entry.slug}`}>
            <span className="site-card-preview"><ComponentPreview entry={entry} miniature /></span>
            <span className="site-card-body"><span className="site-card-name">{entry.name}</span><span className="site-card-description">{entry.description}</span></span>
          </a>)}</div>
        </>}
        {selected && <article className="site-detail">
          <div className="site-detail-head">
            <nav className="site-crumb" aria-label="Breadcrumb"><a href="#/components">Components</a><span>/</span><strong>{selected.name}</strong></nav>
            <h1>{selected.name}</h1>
            <p>{selected.description}</p>
            <div className="site-detail-meta"><span className={`site-item-kind kind-${selected.kind}`}>{selected.kind}</span><code className="site-import">{`import { ${selected.exportName} } from './src/components/${componentFilename(selected)}.jsx'`}</code><button className="site-copy" type="button" onClick={() => showCopied(`import { ${selected.exportName} } from './src/components/${componentFilename(selected)}.jsx'`)}>{copied.includes(selected.exportName) ? 'Copied' : 'Copy'}</button></div>
          </div>
          <ComponentPreview entry={selected} />
          <section className="site-source">
            <div className="site-source-head"><h2>Source</h2><span>{componentFilename(selected)}.jsx</span><button className="site-copy" type="button" onClick={() => showCopied(sourceText)}>{copied === sourceText && sourceText ? 'Copied' : 'Copy source'}</button></div>
            <pre className="site-source-code"><code>{sourceText || 'Source unavailable in this build.'}</code></pre>
          </section>
        </article>}
      </main>
    </div>}
    {isViewer && <main className="site-viewer"><ViewerDemo /></main>}
    {demoEntry && <main className="demo-standalone">
      <div className="demo-standalone-head">
        <a className="demo-standalone-back" href={`#/components/${demoEntry.slug}`}>← {demoEntry.name}</a>
        <span>Standalone preview · resize freely</span>
      </div>
      <div className="demo-standalone-body"><ComponentDemo demo={demoEntry.slug} /></div>
    </main>}
    <footer className="site-footer">Pi Trajectory UI · components render locally, session files never leave the browser.</footer>
  </div>
}
