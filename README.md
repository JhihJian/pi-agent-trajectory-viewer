# Pi Agent Trajectory Viewer

一个只读的微型前端，用于打开并渲染 Pi Agent 保存的 `.jsonl` 会话文件。

## 功能

- 浏览器本地选择或拖拽 Pi Agent session JSONL
- 按当前 `parentId` 分支展示 User、Assistant、Tool 和 Compacted 轨迹
- 展示 Assistant thinking、工具参数、工具结果、错误状态和 usage
- 基于 deepseek harness `ui-trajectory` 的表格、时间线和详情结构，统一浅色中性色与绿色操作强调色
- 支持命中轨迹搜索、Turn 和工具调用折叠、记录详情和响应式移动端布局
- 工具记录显示命令、路径或查询目标及结果状态，可通过 Calls 按钮统一折叠
- 工具参数与结果使用保留换行的纯文本面板，长输出默认展示头尾片段，支持复制原文、展开全文和换行切换
- 搜索时自动显示折叠中的命中记录，展示匹配数量、无结果提示与清空入口
- Markdown 详情连续滚动，原始结果块按需展开，支持 Escape 关闭并返回记录
- 提供文件拖放高亮、读取状态、导入错误提示及本地文件隐私说明
- Pi 未记录首 token 时间时不推算 assistant 时间指标

文件只在浏览器内解析，不上传到服务端。

## 启动

```bash
npm install
npm run dev
```

开发服务监听 `0.0.0.0`。如果默认端口被占用，Vite 会自动选择下一个可用端口。

## 轨迹切换

工具栏的切换行为对齐 DeepSeek `ui-trajectory`，时间投影与折叠计算集中在 `src/trajectory-view.js`。三个按钮均按 `aria-pressed` 显示持久选中态：浅绿色背景、绿色文字和图标，以及细描边。Duration 开启耗时视图时选中，Turns / Calls 全部折叠时选中，鼠标移开后仍保留高亮。

- **Duration**：默认关闭，所有记录按顺序等宽显示。开启后按已有耗时绘制，并压缩操作之间的空闲间隔。没有耗时的记录显示为时间点，没有时间戳的记录不进入耗时视图。切换只改变时间线位置与宽度，详情始终使用原始时间和耗时。
- **Turns**：默认展开。点击 `⊟` 折叠所有包含多条记录的 Turn，保留首条记录及步骤数、工具调用数摘要。全部折叠后图标变为 `⊞`，再次点击展开全部。只有一条记录的 Turn 保持原样。
- **Calls**：默认展开。点击 `⊟` 按 Assistant 折叠其工具调用，保留 Assistant 及调用数量、工具名称摘要。点击某条摘要只展开该组。部分展开时，全局按钮仍执行全部折叠。
- Turn 与工具调用的折叠状态独立保存。双击 Turn 首条记录或带工具调用的 Assistant 可局部切换，摘要支持 Enter 和空格展开。搜索期间显示命中记录，清空搜索后恢复此前折叠状态。点击时间线会展开目标所属的 Turn 与调用组，并定位到记录。

## 检查

```bash
npm test
npm run build
```

## 样式来源

`src/reference/` 中的轨迹 CSS 和主题变量从 deepseek harness 对应文件逐字复制，具体包括：

- `packages/client/ui-trajectory/src/client/*.module.css`
- `packages/client/ui-theme/src/styles/base.css`
- `packages/client/ui-theme/src/styles/design-platform.css`
- `packages/client/ui-theme/src/styles/gradient-shadow-text.css`
- `packages/client/ui-theme/src/styles/focus.css`
- `packages/client/ui-theme/src/styles/scrollbar.css`

由于原组件依赖 Cordis、DSH Session 和客户端 primitives，本项目使用独立的 Pi JSONL 适配器提供 `Trajectory` 所需的展示数据。

项目专属视觉调整集中在 `src/app.css`，不修改 `src/reference/` 的来源文件。入口页提供文件导入引导，工作区保留紧凑表格与角色配色，使用统一的文字层级、控件尺寸、键盘焦点和选中反馈。桌面采用记录与详情分栏，760px 以下详情占满记录区，关闭后返回列表。工具输出默认按字符预算显示开头和结尾，完整内容仍保留在内存中并可按需展开或复制。详情正文统一纵向滚动，代码和宽表格在内容区内横向滚动，并尊重系统的减少动态效果设置。

页面界面沿用英文，文件始终只在当前浏览器内解析。
