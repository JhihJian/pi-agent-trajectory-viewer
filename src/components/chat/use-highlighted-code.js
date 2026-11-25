// 从 ursi-flow chat-web 迁移的 AI 聊天组件。
// 原件为 TypeScript（apps/chat-web/web/src），此处转为 JSDoc 类型供 JSX 使用。
import { useEffect, useMemo, useState } from 'react'
import { loadHighlighter } from './highlighter.jsx'

/**
 * @param {string} value
 * @param {string} language
 * @returns {import('react').ReactNode[]}
 */
export function useHighlightedCode(value, language) {
  // 结尾换行会渲染成多余的空行。
  const code = value.endsWith('\n') ? value.slice(0, -1) : value
  const [loaded, setLoaded] = useState(null)
  const highlighter = loaded?.language === language ? loaded.highlighter : null

  useEffect(() => {
    let cancelled = false

    loadHighlighter(language)
      .then((next) => {
        if (!cancelled) {
          setLoaded({ language, highlighter: next })
        }
      })
      .catch(() => { /* 未支持的语言：回退纯文本。 */ })

    return () => {
      cancelled = true
    }
  }, [language])

  // 已完成的完整行。代码流式到达时，只对新增行 tokenize，
  // 从上一行的语法状态继续。
  const [done, setDone] = useState(() => ({
    highlighter: null,
    text: '',
    lines: [],
    state: undefined,
  }))

  let next = done

  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, text: '', lines: [], state: undefined }
  }

  const end = code.lastIndexOf('\n') + 1

  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(
      code.slice(next.text.length, end - 1),
      next.state,
    )

    next = {
      highlighter,
      text: code.slice(0, end),
      lines: [...next.lines, ...result.lines],
      state: result.state,
    }
  }

  if (next !== done) {
    setDone(next)
  }

  // 最后一行仍在写入，每次渲染时重新 tokenize。
  const tail = code.slice(end)

  return useMemo(() => {
    if (!highlighter) {
      return code.split('\n')
    }

    return [...next.lines, highlighter.highlight(tail, next.state).lines[0]]
  }, [code, highlighter, next, tail])
}
