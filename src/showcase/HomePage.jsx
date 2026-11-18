import React from 'react'
import { catalog } from '../data/catalog'
import { ComponentPreview } from './ComponentPreview.jsx'

export function HomePage({ navigate }) {
  const featured = catalog.slice(0, 3)
  return <main className="site-home">
    <section className="site-hero">
      <span className="site-eyebrow">React components for agent trajectories</span>
      <h1>Read an agent session<br /><span>like a story.</span></h1>
      <p>Pi Trajectory UI turns a Pi Agent session into turns, tool calls, timing and details. The pieces are standalone React components with their own styles, and this site is the live preview.</p>
      <div className="site-hero-actions">
        <button className="site-cta" type="button" onClick={() => navigate('components')}>Browse components</button>
        <button className="site-cta ghost" type="button" onClick={() => navigate('viewer')}>Open the live viewer</button>
      </div>
      <p className="site-privacy">Sessions are parsed in the browser only. Nothing is uploaded.</p>
    </section>
    <section className="site-featured">
      <div className="site-section-head"><h2>Highlights</h2><a href="#/components">All components →</a></div>
      <div className="site-grid">{featured.map(entry => <a key={entry.slug} className="site-card" href={`#/components/${entry.slug}`}>
        <span className="site-card-preview"><ComponentPreview entry={entry} miniature /></span>
        <span className="site-card-body"><span className="site-card-name">{entry.name}</span><span className="site-card-description">{entry.description}</span></span>
      </a>)}</div>
    </section>
  </main>
}
