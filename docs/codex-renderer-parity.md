# codex-session-renderer 提取对照

本文档记录从 `D:\github\codex-session-renderer`（零框架、服务端投影的会话渲染器）提取 pi 会话渲染价值到本组件库的映射。该项目的 pi 渲染是独立实现：格式适配器 + 规范化事件 + 多投影（正文/执行/诊断），浏览器端为字符串模板。本项目以 React 18 组件 + 纯逻辑 lib 的形式吸收其设计。

## 视图映射

| codex-session-renderer | 本项目 | 说明 |
| --- | --- | --- |
| 正文视图 `detail.compact`（`src/session-compact-reading-projection.mjs`, `public/views/compact-*.js`） | `src/lib/reading-view.js` + `src/components/ReadingView.jsx` | 轮次化阅读流。Skill 指令块、goal 控制消息、压缩事件投影为上下文卡片；工具调用保留为一行卡片（源实现正文不显示普通工具调用，本项目保留以维持组件独立性）；subagent 批次带覆盖率。 |
| 执行视图 `detail.trace`（`src/core/trace-model.mjs`, `public/views/trace*.js`） | `src/lib/trace-view.js` + `src/components/TraceView.jsx` | 执行树：turn → user/step/tool/context 节点，工具节点走摘要规则，可复制执行报告。 |
| 执行文本导出 `src/session-execution-export-projection.mjs` | `trace-view.js::executionReport` | 供其他 agent 排查的纯文本报告；未记录的事实保持未记录。 |
| 诊断视图 `public/controllers/diagnostic.js` + `jsonl_parse_error` 事件 | `src/components/DiagnosticView.jsx` + `parser.js` 诊断 | 原始行 + 解析失败诊断。坏行不再中断解析（有 session 头时）；无 session 头时保持原报错信息。 |
| 正文视图（左栏）阅读视图层级目录 `public/controllers/compact-outline.js` + 轮次时间轴 `renderCompactTimelineEntry` | `src/components/ReadingOutline.jsx` + `reading-view.js::projectReadingOutline` | ReadingView 左侧 sticky 目录：根会话 → 轮次（标题 + 状态点 + 压缩/子代理徽标）→ 嵌套上下文事件；点击滚动跳转 + 闪烁高亮 + 滚动联动（时间戳节流）；省略源实现的嵌套子代理会话层。 |
| 轮次时间轴 `views/compact.js::renderCompactTimelineEntry` | 未单独提取 | 时长加权导航轨的职责并入目录组件；本项目已有 `TrajectoryTimeline`（框选/缩放）。 |

## pi 语义映射

| 源文件 | 本项目 |
| --- | --- |
| `src/pi-context-events.mjs`（`<skill>` 指令块、SKILL.md 读取） | `src/lib/pi-semantics.js::parsePiSkillInstruction / piSkillReadFromToolCall` |
| `src/embedded-subagents.mjs`（subagent 批次/结果/覆盖率） | `pi-semantics.js::parsePiSubagentCall / projectPiSubagentResult`（省略 taskViews/execution 展示模型） |
| `src/pi-goal-projection.mjs`（goal 控制消息投影） | `pi-semantics.js::piGoalControlOf`——按决定性标记识别（start/update/resume/continuation），不做全模板严格匹配：目标解析器不保留 goal-state 事件，无法支撑同等推断。 |
| `src/core/turn-model.mjs::inferOpenTurnStatus` | `pi-semantics.js::turnStatusOf`（running/waiting/failed/aborted/complete/context） |
| compaction 适配（`tokensBefore`、`retainedTailCount` 等） | `pi-semantics.js::piCompactionOf` |
| `public/models/summary-rules.js` + `public/views/tool-summary.js` + `src/tool-summary-command.mjs` | `src/lib/tool-summaries.js`（内置规则改为英文标签，新增 subagent/edit/bash catch-all 规则） |

## 有意不提取

- ~~**服务端尾窗读取与字节游标**（`jsonl-tail-reader.mjs`、`getSessionWindow`）~~ → **已客户端化提取**：`src/lib/tail-window.js`（只读完整行、尾窗字节预算、未完成尾记录如实上报、`readVersion(size+modified)` 失效），`WorkspaceDemo` 以 Load earlier / Simulate live record 演示。
- **数据 URI 脱敏与 searchText 预聚合**（`event-normalizer.mjs`）：React 受控过滤在内存中完成；图片渲染由 `Detail` 支持，无需脱敏占位。
- **状态切片 + 冻结详情竞态治理**（`composition.js::stateSlice`、`controllers/session-detail.js`）：React 单向数据流下由容器 `TrajectoryViewer` 统一持有状态。
- **格式适配器注册表**（codex/claude-code 适配）：本项目定位为 pi 轨迹组件库；`TrajectoryViewer` 只消费 `turns`，未来多格式可作为适配器接入同一组件面。

## 组合最小实例

`src/components/WorkspaceDemo.jsx`（演示站 `#/components/workspace`）把上述结构装进一个最小应用，对应源项目 `会话目录 → 会话详情（三视图） → 规则 → 活动会话` 的整体结构：

- `SessionCatalog`（数据源分组 + 日期分组 + 多词搜索，`lib/session-catalog.js`）选择会话
- `tail-window` 只读尾部字节窗口：Load earlier 翻倍窗口、Simulate live record 追加记录并变更 readVersion
- `TrajectoryViewer` 四视图 + `ReadingOutline` 目录
- `RulesEditor` 编辑自定义摘要规则（持久化 localStorage，参数贯通 Reading/Trace 视图）

## 集成点

- `TrajectoryViewer` 新增 `view` 状态（Ledger / Reading / Trace / Diagnostic），`rows` + `diagnostics` 可选 props 启用诊断视图。
- 共享详情分栏：`src/components/DetailsSplit.jsx`（与 `TrajectoryTable` 相同的可拖拽 Detail 面板）。
- 样式：`src/components/styles/views.css`，沿用 `--viewer-*` / `--dsw-alias-*` 令牌（带回退值）。
- 演示站：`catalog.js` 三个新条目 + `ComponentDemo.jsx` 注册；样例 fixture 扩展了 skill/subagent/compaction 行。
