import React from 'react'

/**
 * @param {{ variant?: 'default' | 'destructive', children: React.ReactNode }} props
 */
export function Alert({ variant = 'default', children }) {
  return (
    <div className={`pi-chat-alert${variant === 'destructive' ? ' pi-chat-alert-destructive' : ''}`}>
      {children}
    </div>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function AlertTitle({ children }) {
  return <div className="pi-chat-alert-title">{children}</div>
}

/** @param {{ children: React.ReactNode }} props */
export function AlertDescription({ children }) {
  return <div className="pi-chat-alert-desc">{children}</div>
}
