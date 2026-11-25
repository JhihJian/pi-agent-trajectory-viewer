import React from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './Collapsible.jsx'

/** @param {{ children: React.ReactNode }} props */
export function Trace({ children }) {
  return <div className="pi-chat-trace">{children}</div>
}

/**
 * @param {{ status?: 'running' | 'error', children: React.ReactNode }} props
 */
export function TraceLine({ status, children }) {
  return (
    <div className={`pi-chat-trace-line${status ? ` pi-chat-trace-line-${status}` : ''}`}>
      {children}
    </div>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function TraceIcon({ children }) {
  return <span className="pi-chat-trace-icon">{children}</span>
}

/** @param {{ children: React.ReactNode }} props */
export function TraceTitle({ children }) {
  return <span className="pi-chat-trace-title">{children}</span>
}

/** @param {{ children: React.ReactNode }} props */
export function TraceDescription({ children }) {
  return <span className="pi-chat-trace-desc">{children}</span>
}

/**
 * @param {{ open?: boolean, onOpenChange?: (open: boolean) => void, className?: string, children: React.ReactNode }} props
 */
export function TraceCollapsible({
  open,
  onOpenChange,
  className,
  children,
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={`pi-chat-trace-collapsible ${className ?? ''}`}
    >
      {children}
    </Collapsible>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function TraceCollapsibleTrigger({ children }) {
  return (
    <CollapsibleTrigger className="pi-chat-trace-collapsible-trigger">
      {children}
    </CollapsibleTrigger>
  )
}

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function TraceCollapsibleContent({ className, children }) {
  return (
    <CollapsibleContent
      className={`pi-chat-trace-collapsible-content ${className ?? ''}`}
    >
      {children}
    </CollapsibleContent>
  )
}
