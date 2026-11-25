// 演示用 transport：不连任何服务端，按消息内容回放一段
// AI SDK UIMessageChunk 流，覆盖全部内置 part 类型（markdown、
// 代码、推理、工具、来源引用、ask_user 问卷续跑）。
import { generateId } from 'ai'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const MARKDOWN_ANSWER = [
  '## Short story',
  '',
  '> The lighthouse keeper kept a ledger of every ship that passed.',
  '',
  'Each night he recorded:',
  '',
  '- the **name** of the vessel',
  '- the *hour* it crossed the point',
  '- whether it signaled with `three flashes`',
  '',
  '| Ship | Hour | Signal |',
  '| --- | --- | --- |',
  '| Meridian | 21:40 | yes |',
  '| Petrel | 23:15 | no |',
  '',
  'By morning the ledger held the whole sea.',
  '',
  'His tally script kept the count honest:',
  '',
  '```python',
  'def ships(recorded):',
  '    total = sum(1 for entry in recorded if entry.signal)',
  '    return f"{total} ships signaled"',
  '```',
].join('\n')

/** 每次发送按触发词挑选剧本，其余默认 markdown 剧本。 */
function scriptFor(text) {
  if (/github stats|look up a repo/i.test(text)) {
    return { tool: 'github_repo', input: { repo: 'vercel/next.js' } }
  }

  if (/search the web|what.s new in next\.js/i.test(text)) {
    return {
      tool: 'web_search',
      input: { query: 'Next.js latest release' },
      sources: [
        { url: 'https://nextjs.org/blog', title: 'Next.js Blog' },
        { url: 'https://github.com/vercel/next.js/releases', title: '' },
      ],
    }
  }

  if (/dinner|plan/i.test(text)) {
    return { tool: 'ask_user' }
  }

  return { text: MARKDOWN_ANSWER }
}

/**
 * @param {import('ai').UIMessageChunk[]} chunks
 */
function streamOf(chunks) {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
        // 文本增量用更快的节奏，模拟打字而不拖慢演示。
        await delay(chunk.type === 'text-delta' ? 35 : 90)
      }
      controller.close()
    },
  })
}

/**
 * @implements {import('ai').ChatTransport<import('./types.js').ChatUIMessage>}
 */
export class MockChatTransport {
  /** @param {{ latencyMs?: number }=} options */
  constructor(options = {}) {
    this.latencyMs = options.latencyMs ?? 400
  }

  async sendMessages({ messages, abortSignal }) {
    const last = messages.at(-1)
    const text =
      last?.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('') ?? ''
    const script = scriptFor(text)
    const selfMessageId = generateId()
    /** @type {import('ai').UIMessageChunk[]} */
    const chunks = [{ type: 'start', messageId: selfMessageId }, { type: 'start-step' }]

    await delay(this.latencyMs)
    if (abortSignal?.aborted) return streamOf([{ type: 'abort' }])

    if (script.tool === 'github_repo') {
      chunks.push(
        { type: 'tool-input-start', toolCallId: 'mock-gh-1', toolName: 'github_repo' },
        { type: 'tool-input-available', toolCallId: 'mock-gh-1', toolName: 'github_repo', input: script.input },
        { type: 'finish-step' },
        { type: 'start-step' },
        {
          type: 'tool-output-available',
          toolCallId: 'mock-gh-1',
          output: {
            repo: 'vercel/next.js',
            description: 'The React Framework.',
            stars: 132000,
            forks: 28900,
            openIssues: 620,
            language: 'JavaScript',
            url: 'https://github.com/vercel/next.js',
          },
        },
        {
          type: 'text-start',
          id: 't1',
        },
        {
          type: 'text-delta',
          id: 't1',
          delta: 'vercel/next.js has about 132k stars and 28.9k forks. See the [repo](https://github.com/vercel/next.js).',
        },
        { type: 'text-end', id: 't1' },
      )
    } else if (script.tool === 'web_search') {
      chunks.push(
        { type: 'tool-input-start', toolCallId: 'mock-ws-1', toolName: 'web_search' },
        { type: 'tool-input-available', toolCallId: 'mock-ws-1', toolName: 'web_search', input: script.input },
        { type: 'finish-step' },
        { type: 'start-step' },
        { type: 'tool-output-available', toolCallId: 'mock-ws-1', output: { results: script.sources.length } },
        { type: 'source-url', sourceId: 'src-1', url: script.sources[0].url, title: script.sources[0].title },
        { type: 'source-url', sourceId: 'src-2', url: script.sources[1].url, title: script.sources[1].title },
        { type: 'text-start', id: 't1' },
        {
          type: 'text-delta',
          id: 't1',
          delta: 'The latest Next.js release focuses on caching improvements and a faster dev overlay.',
        },
        { type: 'text-end', id: 't1' },
      )
    } else if (script.tool === 'ask_user') {
      chunks.push(
        { type: 'tool-input-start', toolCallId: 'mock-au-1', toolName: 'ask_user' },
        {
          type: 'tool-input-available',
          toolCallId: 'mock-au-1',
          toolName: 'ask_user',
          input: {
            questions: [
              { question: 'How many guests are coming?', choices: ['2', '4', '6+'] },
              { question: 'Any dietary restrictions?', choices: ['None', 'Vegetarian', 'Gluten-free'] },
            ],
          },
        },
      )
      // 等待宿主 addToolOutput 注入回答后自动续跑，本流到此为止。
      return streamOf(chunks)
    } else {
      chunks.push({ type: 'reasoning-start', id: 'r1' })
      chunks.push({ type: 'reasoning-delta', id: 'r1', delta: 'Planning the story structure: hook, scene, turn.' })
      chunks.push({ type: 'reasoning-delta', id: 'r1', delta: ' Then drafting with markdown formatting.' })
      chunks.push({ type: 'reasoning-end', id: 'r1' })
      chunks.push({ type: 'finish-step' }, { type: 'start-step' })
      chunks.push({ type: 'text-start', id: 't1' })
      // 逐词推流，模拟真实打字效果。
      const words = script.text.split(/(\s+)/)
      for (const word of words) {
        if (abortSignal?.aborted) return streamOf([{ type: 'abort' }])
        chunks.push({ type: 'text-delta', id: 't1', delta: word })
        // 直接 enqueue 会有节流去重，无妨；仅控制节奏。
      }
      chunks.push({ type: 'text-end', id: 't1' })
    }

    chunks.push({ type: 'finish-step' }, { type: 'finish', finishReason: 'stop' })
    return streamOf(chunks)
  }

  async reconnectToStream() {
    return null
  }
}
