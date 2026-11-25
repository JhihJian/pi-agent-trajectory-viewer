import { RiArrowRightUpLine, RiGlobalLine } from '@remixicon/react'

import { safeHttpUrl } from '../types.js'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '../ui/Trace.jsx'

/** @param {{ parts: import('../types.js').ChatMessagePart[] }} props */
export function SourcesPart({ parts }) {
  const sources = getUniqueSources(parts)

  if (sources.length === 0) {
    return null
  }

  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <RiGlobalLine />
            </TraceIcon>
            <TraceTitle>
              Used {sources.length}{' '}
              {sources.length === 1 ? 'source' : 'sources'}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {sources.map((source) => (
              <a
                key={source.url}
                className="pi-chat-trace-source-link"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                <TraceLine>
                  <TraceIcon>
                    <RiGlobalLine />
                  </TraceIcon>
                  <TraceTitle>
                    {source.title || getHostname(source.url)}
                    <span className="pi-chat-sr-only"> (opens in a new tab)</span>
                  </TraceTitle>
                  <TraceIcon>
                    <RiArrowRightUpLine />
                  </TraceIcon>
                </TraceLine>
              </a>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

/** @param {import('../types.js').ChatMessagePart[]} parts */
function getUniqueSources(parts) {
  return parts
    .filter((part) => part.type === 'source-url')
    .filter((source) => safeHttpUrl(source.url))
    .filter(
      (source, index, all) =>
        all.findIndex((other) => other.url === source.url) === index,
    )
}

/** @param {string} url */
function getHostname(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
