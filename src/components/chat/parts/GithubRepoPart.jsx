import { StatusIcon } from '../StatusIcon.jsx'
import { CodeBlock, CodeBlockContent } from '../ui/CodeBlock.jsx'
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '../ui/Trace.jsx'

const formatCount = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format

/** @param {{ part: import('../types.js').ChatToolPart, isStreaming: boolean }} props */
export function GithubRepoPart({ part, isStreaming }) {
  const repo = part.input?.repo ?? 'repository'

  if (part.state !== 'output-available' && part.state !== 'output-error') {
    return (
      <TraceLine status={isStreaming ? 'running' : 'error'}>
        <TraceIcon>
          <StatusIcon status={isStreaming ? 'running' : 'error'} />
        </TraceIcon>
        <TraceTitle>
          {isStreaming ? 'Looking up' : 'Failed to look up'} {repo}
        </TraceTitle>
      </TraceLine>
    )
  }

  // 工具返回 { error } 而不是抛错，两种状态读取方式相同。
  const output =
    part.state === 'output-available' ? part.output : { error: part.errorText }

  if ('error' in output) {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <StatusIcon status="error" />
            </TraceIcon>
            <TraceTitle>Failed to look up {repo}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <CodeBlock size="sm" variant="destructive">
            <CodeBlockContent wrap className="pi-chat-trace-error-block">
              {output.error}
            </CodeBlockContent>
          </CodeBlock>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceIcon>
            <StatusIcon />
          </TraceIcon>
          <TraceTitle>Looked up {repo}</TraceTitle>
          <TraceDescription>{formatCount(output.stars)} stars</TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeBlock size="sm">
          <CodeBlockContent wrap className="pi-chat-trace-error-block">
            {JSON.stringify(output, null, 2)}
          </CodeBlockContent>
        </CodeBlock>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
