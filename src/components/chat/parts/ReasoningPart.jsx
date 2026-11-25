import React from 'react'

import { StatusIcon } from '../StatusIcon.jsx'
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '../ui/Trace.jsx'

/**
 * @param {{
 *   part: import('../types.js').ReasoningMessagePart
 *   isStreaming: boolean
 *   duration?: number
 * }} props
 */
export function ReasoningPart({ part, isStreaming, duration }) {
  const [open, setOpen] = React.useState(/** @type {boolean | undefined} */ (undefined))
  const running = isStreaming && part.state === 'streaming'
  const status = running ? 'running' : undefined

  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <StatusIcon status={status} />
      </TraceIcon>
      <TraceTitle>{running ? 'Thinking' : 'Thought'}</TraceTitle>
      {!running && duration !== undefined && (
        <TraceDescription>
          {Math.max(1, Math.round(duration / 1000))}s
        </TraceDescription>
      )}
    </TraceLine>
  )

  if (!part.text) {
    return line
  }

  // 思考时展开，结束后收起，除非用户手动切换过。
  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="pi-chat-trace-reasoning">
        {part.text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
