import { StatusIcon } from '../StatusIcon.jsx'
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '../ui/Trace.jsx'

/** @param {{ part: import('../types.js').ChatToolPart }} props */
export function AskUserPart({ part }) {
  if (part.state !== 'output-available') {
    return null
  }

  const count = part.output.length

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceIcon>
            <StatusIcon />
          </TraceIcon>
          <TraceTitle>
            Asked {count} {count === 1 ? 'question' : 'questions'}
          </TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <dl className="pi-chat-trace-qa">
          {part.output.map((entry) => (
            <div key={entry.question}>
              <dt>{entry.question}</dt>
              <dd>{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
