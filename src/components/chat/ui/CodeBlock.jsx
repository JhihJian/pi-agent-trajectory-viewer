import React from 'react'
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react'

/**
 * @param {{ size?: 'sm', variant?: 'default' | 'destructive', className?: string, children: React.ReactNode }} props
 */
export function CodeBlock({ size, variant, className, children }) {
  return (
    <div
      className={[
        'pi-chat-code-block',
        size === 'sm' ? 'pi-chat-code-block-sm' : '',
        variant === 'destructive' ? 'pi-chat-code-block-destructive' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function CodeBlockHeader({ children }) {
  return <div className="pi-chat-code-block-header">{children}</div>
}

/** @param {{ children: React.ReactNode }} props */
export function CodeBlockTitle({ children }) {
  return <span className="pi-chat-code-block-title">{children}</span>
}

/** @param {{ children: React.ReactNode }} props */
export function CodeBlockActions({ children }) {
  return <div className="pi-chat-code-block-actions">{children}</div>
}

/** @param {{ value: string }} props */
export function CodeBlockCopyButton({ value }) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <button
      type="button"
      className="pi-chat-code-block-copy"
      aria-label={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => { /* 剪贴板不可用时静默。 */ })
      }}
    >
      {copied ? <RiCheckLine /> : <RiFileCopyLine />}
    </button>
  )
}

/**
 * @param {{ wrap?: boolean, className?: string, children: React.ReactNode }} props
 */
export function CodeBlockContent({ wrap, className, children }) {
  return (
    <pre
      className={[
        'pi-chat-code-block-content',
        wrap ? 'pi-chat-code-block-wrap' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </pre>
  )
}

/** @param {{ children: React.ReactNode }} props */
export function CodeBlockLine({ children }) {
  return <span className="pi-chat-code-block-line">{children}</span>
}
