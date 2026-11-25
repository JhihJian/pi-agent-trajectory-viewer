// 从 ursi-flow chat-web 迁移。shiki 按需加载：核心高亮器单例，
// 语言 grammer 首次使用才 import，JS 引擎避免 Oniguruma WASM。
import {
  createHighlighterCore,
} from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

import morandiTheme from './morandi-theme.js'

// 按需加载的语言，首次使用才加载。
const languages = {
  bash: () => import('shiki/langs/shellscript.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
}

const aliases = {
  js: 'javascript',
  md: 'markdown',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
}

/** @type {Promise<import('shiki/core').HighlighterCore> | undefined} */
let highlighter

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [morandiTheme],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })

  return highlighter
}

function getLanguage(language) {
  const name = language.toLowerCase()

  if (name === 'ansi') {
    return name
  }

  if (name in languages) {
    return /** @type {keyof typeof languages} */ (name)
  }

  return aliases[name] ?? null
}

/**
 * 加载语言并返回高亮器，未列出的语言返回 null。
 * @param {string} language
 */
export async function loadHighlighter(language) {
  const lang = getLanguage(language)

  if (!lang) {
    return null
  }

  const shiki = await getHighlighter()

  if (lang !== 'ansi' && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(languages[lang])
  }

  return {
    // 每行返回一组 React 节点，以及最后一行之后的语法状态；
    // 把状态传回即可从上次中断处继续。
    highlight(code, state) {
      const tokenize = (text) =>
        shiki.codeToTokens(text, {
          lang,
          themes: { light: 'morandi-light' },
          defaultColor: false,
          grammarState: state,
        }).tokens

      // ANSI 没有语法状态，逐行 tokenize，颜色与整体一次性到来一致。
      const tokens =
        lang === 'ansi'
          ? code.split('\n').flatMap((line) => tokenize(line))
          : tokenize(code)

      return {
        lines: tokens.map((line) =>
          line.map((token, index) => {
            // defaultColor:false 时主题色在 --shiki-light 变量里，直接映射到 color。
            const style = /** @type {import('react').CSSProperties} */ (token.htmlStyle)
            const fallback = /** @type {any} */ (token.htmlStyle)?.['--shiki-light']
            return (
              <span key={index} style={fallback ? { ...style, color: fallback } : style}>
                {token.content}
              </span>
            )
          }),
        ),
        state: shiki.getLastGrammarState(tokens),
      }
    },
  }
}

/**
 * 返回每行一个 React 节点，未列出的语言返回 null。
 * @param {string} code
 * @param {string} language
 */
export async function highlightCode(code, language) {
  const highlighter = await loadHighlighter(language)

  return highlighter ? highlighter.highlight(code).lines : null
}
