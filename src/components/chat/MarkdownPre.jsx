import React from 'react'

import { useHighlightedCode } from './use-highlighted-code.js'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from './ui/CodeBlock.jsx'

/**
 * 围栏代码渲染成 <pre><code>，从 hast 节点读回原始代码与语言。
 * 配合 ReactMarkdown 的 components={{ pre: MarkdownPre }} 使用；
 * node 参数是 react-markdown 传入的 hast 树，children 是原始子节点。
 */
export function MarkdownPre({ node, children, ...props }) {
  const element = /** @type {any} */ (node?.children[0])

  if (element?.type !== 'element' || element.tagName !== 'code') {
    return <pre {...props}>{children}</pre>
  }

  const language =
    /language-([^\s,]+)/.exec(
      String(element.properties.className ?? ''),
    )?.[1] ?? ''
  const code = element.children
    .map((child) => (child.type === 'text' ? child.value : ''))
    .join('')
    .replace(/\n$/, '')

  return <MarkdownCodeBlock code={code} language={language} />
}

/**
 * @param {{ code: string, language: string }} props
 */
function MarkdownCodeBlock({ code, language }) {
  const lines = useHighlightedCode(code, language)

  return (
    <CodeBlock className="pi-chat-markdown-code">
      <CodeBlockHeader>
        <CodeBlockTitle>{language || 'text'}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
