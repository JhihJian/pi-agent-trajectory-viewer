import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { Chat as AiChat, useChat } from '@ai-sdk/react'
import React from 'react'

import './chat.css'

import { ChatMessage } from './ChatMessage.jsx'
import { MODELS } from './models.js'
import { QuestionCard } from './QuestionCard.jsx'
import { PromptForm } from './PromptForm.jsx'
import { Suggestions } from './Suggestions.jsx'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert.jsx'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from './ui/Empty.jsx'
import { Message, MessageContent } from './ui/Message.jsx'
import { Trace, TraceIcon, TraceLine, TraceTitle } from './ui/Trace.jsx'
import { StatusIcon } from './StatusIcon.jsx'

/**
 * 完整聊天界面：消息流、输入框、模型选择、ask_user 问卷与错误提示。
 *
 * 数据通道由 `transport` 决定：
 * - 默认用 DefaultChatTransport 调 `/api/chat`（AI SDK UIMessage 流协议，
 *   见 ai 包 createUIMessageStream / toUIMessageStreamResponse）。
 * - 演示或自定义后端时传入实现了 ChatTransport 的实例，
 *   也可直接传一个组装好的 Chat 实例（chat）。
 *
 * @param {{
 *   models?: import('./models.js').GatewayModel[]
 *   chat?: InstanceType<typeof AiChat>
 *   transport?: import('ai').ChatTransport<import('./types.js').ChatUIMessage>
 *   api?: string
 *   emptyTitle?: string
 *   emptyDescription?: string
 * }} props
 */
export function Chat({
  models = MODELS,
  chat,
  transport,
  api = '/api/chat',
  emptyTitle = 'What can I help with?',
  emptyDescription = 'Pick a model and start chatting.',
}) {
  const [model, setModel] = React.useState(models[0]?.id ?? '')
  const scrollRef = React.useRef(/** @type {HTMLDivElement | null} */ (null))

  const chatHelpers = useChat({
    ...(chat ? { chat } : {}),
    ...(transport ? { transport } : {}),
    api,
    // 用户回答 ask_user 问卷后自动续跑。
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const {
    messages,
    sendMessage,
    regenerate,
    status,
    stop,
    error,
    addToolOutput,
  } = chatHelpers

  const resolvedModel = models.some((m) => m.id === model)
    ? model
    : (models[0]?.id ?? '')

  const isBusy = status === 'submitted' || status === 'streaming'

  const lastMessage = messages.at(-1)
  const pendingQuestion =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts.find(
          (part) =>
            part.type === 'tool-ask_user' &&
            (part.state === 'input-streaming' ||
              part.state === 'input-available'),
        )
      : undefined

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [messages, status])

  return (
    <div className="pi-chat-chat">
      {messages.length === 0 ? (
        <div className="pi-chat-chat-empty">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Suggestions
                onSelect={(prompt) =>
                  sendMessage(
                    { text: prompt },
                    { body: { model: resolvedModel } },
                  )
                }
              />
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="pi-chat-chat-scroll" ref={scrollRef}>
          <div className="pi-chat-chat-messages">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isBusy && message.id === lastMessage?.id}
                onRetry={
                  !isBusy && message.id === lastMessage?.id
                    ? () =>
                        regenerate({
                          messageId: message.id,
                          body: { model: resolvedModel },
                        })
                    : undefined
                }
              />
            ))}
            {status === 'submitted' && (
              <Message align="start">
                <MessageContent>
                  <Trace>
                    <TraceLine status="running">
                      <TraceIcon>
                        <StatusIcon status="running" />
                      </TraceIcon>
                      <TraceTitle>Thinking</TraceTitle>
                    </TraceLine>
                  </Trace>
                </MessageContent>
              </Message>
            )}
          </div>
        </div>
      )}

      <div className="pi-chat-chat-composer">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <PromptForm
          models={models}
          model={resolvedModel}
          onModelChange={setModel}
          isBusy={isBusy}
          onSubmit={(text) =>
            sendMessage({ text }, { body: { model: resolvedModel } })
          }
          onStop={() => stop()}
        />
      </div>

      {pendingQuestion && (
        <QuestionCard
          part={pendingQuestion}
          onAnswer={(toolCallId, answer) =>
            addToolOutput({
              tool: 'ask_user',
              toolCallId,
              output: answer,
              options: { body: { model: resolvedModel } },
            })
          }
        />
      )}
    </div>
  )
}

export { Chat as AiSdkChat } from '@ai-sdk/react'
