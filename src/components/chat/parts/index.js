import { AskUserPart } from './AskUserPart.jsx'
import { GithubRepoPart } from './GithubRepoPart.jsx'
import { ReasoningPart } from './ReasoningPart.jsx'
import { SourcesPart } from './SourcesPart.jsx'
import { TextPart } from './TextPart.jsx'
import { WebSearchPart } from './WebSearchPart.jsx'

// 工具名 → 渲染器。宿主新增工具时在这里登记一个组件即可，
// 组件签名统一为 ({ part, isStreaming })。
export const TOOL_PART_COMPONENTS = {
  github_repo: GithubRepoPart,
  ask_user: AskUserPart,
  web_search: WebSearchPart,
}

export { AskUserPart, GithubRepoPart, ReasoningPart, SourcesPart, TextPart, WebSearchPart }
