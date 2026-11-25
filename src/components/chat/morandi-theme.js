// 与 src/components/styles/theme.css 同色板的 shiki 自定义主题：
// 雾蓝常量、灰绿字符串、赭石关键字与函数、暖灰注释，低饱和大地色。
const morandiTheme = {
  name: 'morandi-light',
  type: 'light',
  colors: {
    'editor.foreground': '#2b2925',
    'editor.background': '#ffffff',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#9c968c', fontStyle: 'italic' } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'], settings: { foreground: '#5f7057' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character.escape', 'constant'], settings: { foreground: '#647788' } },
    { scope: ['keyword', 'keyword.operator.new', 'storage.type', 'storage.modifier'], settings: { foreground: '#7d6248' } },
    { scope: ['keyword.operator', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: '#6e6860' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call', 'variable.function'], settings: { foreground: '#8a6f4d' } },
    { scope: ['entity.name.tag', 'markup.tag'], settings: { foreground: '#7d6248' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#5a6b52' } },
    { scope: ['variable', 'variable.other', 'meta.parameter', 'variable.parameter'], settings: { foreground: '#2b2925' } },
    { scope: ['entity.name.type', 'support.type', 'support.class', 'entity.name.class'], settings: { foreground: '#647788' } },
    { scope: ['entity.name.section', 'markup.heading'], settings: { foreground: '#2b2925', fontStyle: 'bold' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
    { scope: ['markup.inserted'], settings: { foreground: '#5f7057' } },
    { scope: ['markup.deleted'], settings: { foreground: '#a3564a' } },
    { scope: ['markup.quote'], settings: { foreground: '#6e6860', fontStyle: 'italic' } },
    { scope: ['invalid'], settings: { foreground: '#a3564a' } },
  ],
}

export default morandiTheme
