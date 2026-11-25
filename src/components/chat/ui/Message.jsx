import React from 'react'

/**
 * @param {{ align: 'start' | 'end', children: React.ReactNode }} props
 */
export function Message({ align, children }) {
  return <div className={`pi-chat-message pi-chat-message-${align}`}>{children}</div>
}

/** @param {{ children: React.ReactNode }} props */
export function MessageContent({ children }) {
  return <div className="pi-chat-message-content">{children}</div>
}

/**
 * @param {{ className?: string, children: React.ReactNode }} props
 */
export function MessageFooter({ className, children }) {
  return <div className={`pi-chat-message-footer ${className ?? ''}`}>{children}</div>
}

/**
 * @param {{ align: 'start' | 'end', variant?: 'default' | 'muted', children: React.ReactNode }} props
 */
export function Bubble({ align, variant = 'default', children }) {
  return (
    <div className={`pi-chat-bubble pi-chat-bubble-${align}${variant === 'muted' ? ' pi-chat-bubble-muted' : ''}`}>
      {children}
    </div>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function BubbleContent({ children }) {
  return <div className="pi-chat-bubble-content">{children}</div>
}
