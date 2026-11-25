import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { MarkdownPre } from '../MarkdownPre.jsx'

/** @param {{ part: import('../types.js').TextMessagePart }} props */
export function TextPart({ part }) {
  return (
    <div className="pi-chat-typeset">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ pre: MarkdownPre }}
      >
        {part.text}
      </ReactMarkdown>
    </div>
  )
}
