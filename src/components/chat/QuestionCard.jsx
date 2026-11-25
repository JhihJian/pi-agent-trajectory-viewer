import React from 'react'

/**
 * @param {{
 *   part: import('./types.js').ChatToolPart
 *   onAnswer: (toolCallId: string, answers: import('./types.js').AskUserAnswer[]) => void
 * }} props
 */
export function QuestionCard({ part, onAnswer }) {
  const questions = part.state === 'input-available' ? part.input.questions : []
  // 每个问题：选择的选项 + 自定义输入，提交时自定义优先。
  const [selected, setSelected] = React.useState(/** @type {Record<string, string>} */ ({}))
  const [custom, setCustom] = React.useState(/** @type {Record<string, string>} */ ({}))

  const keyFor = (index) => `q${index}`

  return (
    <div className="pi-chat-question-card">
      <div className="pi-chat-question-card-inner">
        {questions.length === 0 ? (
          <div className="pi-chat-question-card-loading">Preparing a question…</div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onAnswer(
                part.toolCallId,
                questions.map((question, index) => {
                  const key = keyFor(index)
                  const answer = custom[key]?.trim()
                    ? custom[key]
                    : (selected[key] ?? '')
                  return { question: question.question, answer }
                }),
              )
            }}
          >
            <div className="pi-chat-question-card-eyebrow">Needs your input</div>
            {questions.map((question, index) => {
              const key = keyFor(index)
              const hasCustom = Boolean(custom[key]?.trim())
              return (
                <div key={index} className="pi-chat-question-item">
                  <div className="pi-chat-question-title">{question.question}</div>
                  <div className="pi-chat-question-choices">
                    {question.choices.map((choice) => (
                      <label
                        key={choice}
                        className={`pi-chat-question-choice${
                          !hasCustom && selected[key] === choice
                            ? ' pi-chat-question-choice-selected'
                            : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name={key}
                          value={choice}
                          checked={!hasCustom && selected[key] === choice}
                          onChange={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [key]: choice,
                            }))
                          }
                        />
                        {choice}
                      </label>
                    ))}
                    <input
                      className="pi-chat-question-input"
                      aria-label="Another answer"
                      placeholder="Type another answer…"
                      value={custom[key] ?? ''}
                      onChange={(event) =>
                        setCustom((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )
            })}
            <div className="pi-chat-question-actions">
              <button
                type="submit"
                className="pi-chat-btn pi-chat-btn-primary"
                disabled={questions.some((_, index) => {
                  const key = keyFor(index)
                  return !custom[key]?.trim() && !selected[key]
                })}
              >
                Answer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
