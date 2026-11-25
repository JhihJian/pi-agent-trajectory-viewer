// 从 ursi-flow chat-web 迁移：与 AI SDK UI 消息对齐的工具与消息 part 类型。
// 客户端只关心渲染形状，不需要服务端的执行实现。
// 迁移说明：ChatTools 的工具名可按宿主应用增删，渲染端通过
// components.parts 按名字分发（见 ChatMessage）。

/** @typedef {{ repo: string, description: string, stars: number, forks: number, openIssues: number, language: string, url: string }} GithubRepoStats */
/** @typedef {{ error: string }} GithubRepoError */
/** @typedef {{ question: string, choices: string[] }} AskUserQuestion */
/** @typedef {{ question: string, answer: string }} AskUserAnswer */

/**
 * @typedef {Object} ChatTools
 * @property {{ input: { repo?: string }, output: GithubRepoError | GithubRepoStats }} github_repo
 * @property {{ input: { questions: AskUserQuestion[] }, output: AskUserAnswer[] }} ask_user
 * @property {{ input: { query?: string }, output: unknown }} web_search
 */

/**
 * @template {import('ai').UIDataTypes} [DATA=import('ai').UIDataTypes]
 * @typedef {import('ai').UIMessage<{ reasoningDurations?: Record<number, number> }, DATA, ChatTools>} ChatUIMessage
 */

/** @typedef {ChatUIMessage['parts'][number]} ChatMessagePart */
/** @typedef {Extract<ChatMessagePart, { type: 'text' }>} TextMessagePart */
/** @typedef {Extract<ChatMessagePart, { type: 'reasoning' }>} ReasoningMessagePart */
/** @typedef {Extract<ChatMessagePart, { type: 'source-url' }>} SourceUrlPart */
/** @typedef {Extract<ChatMessagePart, { type: `tool-${keyof ChatTools & string}` }>} ChatToolPart */

/**
 * 按工具名取消息里的 tool part。宿主可传自己的工具类型子集。
 * @param {ChatMessagePart[]} parts
 * @param {string} toolName
 * @returns {ChatToolPart | undefined}
 */
export function toolPartByName(parts, toolName) {
  return parts.find(
    (part) => part.type === `tool-${toolName}`,
  )
}

// 只允许 http(s) 链接进入 href，防止不可信的模型/工具输出注入
// javascript: 或 data: 协议。
/**
 * @param {string} url
 * @returns {string | undefined}
 */
export function safeHttpUrl(url) {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}
