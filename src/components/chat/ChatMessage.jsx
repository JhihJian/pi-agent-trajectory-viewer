import { MessageActions } from './MessageActions.jsx'
import { TOOL_PART_COMPONENTS } from './parts/index.js'
import { ReasoningPart } from './parts/ReasoningPart.jsx'
import { SourcesPart } from './parts/SourcesPart.jsx'
import { TextPart } from './parts/TextPart.jsx'
import { Bubble, BubbleContent, Message, MessageContent } from './ui/Message.jsx'
import { Trace } from './ui/Trace.jsx'

/**
 * 一条 UI 消息：用户消息渲染气泡，助手消息把 reasoning/tool 步骤
 * 折叠进 Trace，文本渲染 markdown。
 *
 * @param {{
 *   message: import('./types.js').ChatUIMessage
 *   isStreaming?: boolean
 *   onRetry?: () => void
 * }} props
 */
export function ChatMessage({ message, isStreaming = false, onRetry }) {
  if (message.role === 'user') {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>
              {message.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('')}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  const blocks = groupParts(message.parts)
  const reasoningParts = message.parts.filter(
    (part) => part.type === 'reasoning',
  )
  const text = blocks
    .flatMap((block) => (Array.isArray(block) ? [] : block.text))
    .join('\n\n')

  return (
    <Message align="start">
      <MessageContent>
        {blocks.map((block, index) =>
          Array.isArray(block) ? (
            <Trace key={index}>
              {block.map((part, partIndex) => {
                if (part.type === 'reasoning') {
                  return (
                    <ReasoningPart
                      key={partIndex}
                      part={part}
                      isStreaming={isStreaming}
                      duration={
                        message.metadata?.reasoningDurations?.[
                          reasoningParts.indexOf(part)
                        ]
                      }
                    />
                  )
                }

                // 工具 part 按 tool-<name> 分发；未登记的工具显示默认行。
                const PartComponent =
                  TOOL_PART_COMPONENTS[part.type.slice('tool-'.length)]

                if (!PartComponent) {
                  return (
                    <DefaultToolPart
                      key={part.toolCallId}
                      part={part}
                      isStreaming={isStreaming}
                    />
                  )
                }

                return (
                  <PartComponent
                    key={part.toolCallId}
                    part={part}
                    isStreaming={isStreaming}
                  />
                )
              })}
            </Trace>
          ) : (
            <TextPart key={index} part={block} />
          ),
        )}
        {!isStreaming && <SourcesPart parts={message.parts} />}
        {!isStreaming && text && (
          <MessageActions text={text} onRetry={onRetry} />
        )}
      </MessageContent>
    </Message>
  )
}

/**
 * 未登记工具的兜底渲染：显示运行/完成/错误状态与工具名。
 * @param {{ part: import('./types.js').ChatToolPart, isStreaming: boolean }} props
 */
function DefaultToolPart({ part, isStreaming }) {
  const running = isStreaming && part.state !== 'output-available' && part.state !== 'output-error'
  const status = running ? 'running' : part.state === 'output-error' ? 'error' : undefined

  return (
    <div className={`pi-chat-trace-line${status ? ` pi-chat-trace-line-${status}` : ''}`}>
      <span className="pi-chat-trace-icon">{running ? '◌' : '✓'}</span>
      <span className="pi-chat-trace-title">
        {part.type.slice('tool-'.length)}
        {part.state === 'output-error' ? ` failed: ${part.errorText ?? ''}` : ''}
      </span>
    </div>
  )
}

// 文本把步骤切成若干段，每段步骤放进各自的 Trace。
function groupParts(parts) {
  return mergeTextParts(parts).reduce(
    (blocks, part) => {
      if (part.type === 'text') {
        if (part.text.trim()) {
          blocks.push(part)
        }
        return blocks
      }

      if (!isStepPart(part)) {
        return blocks
      }

      const last = blocks.at(-1)
      if (Array.isArray(last)) {
        last.push(part)
      } else {
        blocks.push([part])
      }
      return blocks
    },
    /** @type {(import('./types.js').TextMessagePart | import('./types.js').ChatToolPart[])[]} */ ([]),
  )
}

function isStepPart(part) {
  // 未回答的问题显示在 QuestionCard，不进 Trace。
  if (part.type === 'tool-ask_user') {
    return part.state === 'output-available'
  }

  return (
    part.type === 'reasoning' ||
    part.type.startsWith('tool-')
  )
}

// 网页搜索的回复每个引用流式一个 text part，把它们并回一篇 markdown。
function mergeTextParts(parts) {
  return parts
    .filter((part) => part.type !== 'source-url')
    .reduce((merged, part) => {
      const last = merged.at(-1)
      if (part.type === 'text' && last?.type === 'text') {
        merged[merged.length - 1] = { ...part, text: last.text + part.text }
        return merged
      }
      merged.push(part)
      return merged
    }, /** @type {import('./types.js').ChatMessagePart[]} */ ([]))
}
