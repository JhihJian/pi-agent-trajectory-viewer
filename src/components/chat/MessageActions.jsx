import React from 'react'
import {
  RiCheckLine,
  RiFileCopyLine,
  RiRestartLine,
} from '@remixicon/react'

import { Button } from './ui/Button.jsx'
import { MessageFooter } from './ui/Message.jsx'

/**
 * @param {{ text: string, onRetry?: () => void }} props
 */
export function MessageActions({ text, onRetry }) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <MessageFooter className="pi-chat-message-actions">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
        onClick={() => {
          navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => { /* 剪贴板不可用时静默。 */ })
        }}
      >
        {copied ? <RiCheckLine /> : <RiFileCopyLine />}
      </Button>
      {onRetry && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Retry"
          title="Retry"
          onClick={onRetry}
        >
          <RiRestartLine />
        </Button>
      )}
    </MessageFooter>
  )
}
