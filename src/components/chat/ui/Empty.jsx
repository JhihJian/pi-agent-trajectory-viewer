import React from 'react'

/** @param {{ children: React.ReactNode }} props */
export function Empty({ children }) {
  return <div className="pi-chat-empty-box">{children}</div>
}

/** @param {{ children: React.ReactNode }} props */
export function EmptyHeader({ children }) {
  return <div className="pi-chat-empty-header">{children}</div>
}

/** @param {{ children: React.ReactNode }} props */
export function EmptyTitle({ children }) {
  return <h1 className="pi-chat-empty-title">{children}</h1>
}

/** @param {{ children: React.ReactNode }} props */
export function EmptyDescription({ children }) {
  return <p className="pi-chat-empty-desc">{children}</p>
}

/** @param {{ children: React.ReactNode }} props */
export function EmptyContent({ children }) {
  return <div className="pi-chat-empty-content">{children}</div>
}
