import { StatusIcon } from '../StatusIcon.jsx'
import { CodeBlock, CodeBlockContent } from '../ui/CodeBlock.jsx'
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '../ui/Trace.jsx'

/** @param {{ part: import('../types.js').ChatToolPart, isStreaming: boolean }} props */
export function WebSearchPart({ part, isStreaming }) {
  const target = part.input?.query
    ? `the web for “${part.input.query}”`
    : 'the web'

  if (part.state === 'output-available') {
    return (
      <TraceLine>
        <TraceIcon>
          <StatusIcon />
        </TraceIcon>
        <TraceTitle>Searched {target}</TraceTitle>
      </TraceLine>
    )
  }

  if (part.state === 'output-error') {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <StatusIcon status="error" />
            </TraceIcon>
            <TraceTitle>Failed to search {target}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <CodeBlock size="sm" variant="destructive">
            <CodeBlockContent wrap className="pi-chat-trace-error-block">
              {part.errorText}
            </CodeBlockContent>
          </CodeBlock>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }

  return (
    <TraceLine status={isStreaming ? 'running' : 'error'}>
      <TraceIcon>
        <StatusIcon status={isStreaming ? 'running' : 'error'} />
      </TraceIcon>
      <TraceTitle>
        {isStreaming ? 'Searching' : 'Failed to search'} {target}
      </TraceTitle>
    </TraceLine>
  )
}
