import React from 'react'
import { RiArrowUpLine, RiStopFill } from '@remixicon/react'

import { ModelSelect } from './ModelSelect.jsx'

/**
 * @param {{
 *   models?: import('./models.js').GatewayModel[]
 *   model: string
 *   onModelChange: (model: string) => void
 *   isBusy: boolean
 *   onSubmit: (text: string) => void
 *   onStop: () => void
 * }} props
 */
export function PromptForm({
  models,
  model,
  onModelChange,
  isBusy,
  onSubmit,
  onStop,
}) {
  const [input, setInput] = React.useState('')

  /** @param {React.FormEvent=} event */
  function handleSubmit(event) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    onSubmit(text)
    setInput('')
  }

  return (
    <form className="pi-chat-composer" onSubmit={handleSubmit}>
      <textarea
        className="pi-chat-composer-input"
        placeholder="Send a message…"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="pi-chat-composer-bar">
        <ModelSelect
          models={models}
          value={model}
          onValueChange={onModelChange}
        />
        {isBusy ? (
          <button
            type="button"
            className="pi-chat-composer-send"
            aria-label="Stop generating"
            onClick={onStop}
          >
            <RiStopFill />
          </button>
        ) : (
          <button
            type="submit"
            className="pi-chat-composer-send"
            aria-label="Send message"
            disabled={!input.trim()}
          >
            <RiArrowUpLine />
          </button>
        )}
      </div>
    </form>
  )
}
