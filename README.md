# Pi Agent Trajectory Viewer

一个只读的微型前端，用于打开并渲染 Pi Agent 保存的 `.jsonl` 会话文件。

## 功能

- 浏览器本地选择或拖拽 Pi Agent session JSONL
- 按当前 `parentId` 分支展示 User、Assistant、Tool 和 Compacted 轨迹
- 展示 Assistant thinking、工具参数、工具结果、错误状态和 usage
- 基于 deepseek harness `ui-trajectory` 的表格、时间线和详情结构，统一浅色中性色与绿色操作强调色
- 时间线支持正反向框选、滚轮缩放、右键拖动平移及边缘平移，选区联动记录定位和高亮
- 支持多词搜索、Turn 和工具调用折叠、记录详情和响应式移动端布局
- 大会话表格按视口渲染，支持跳转到尚未挂载的远端记录
- 工具记录显示命令、路径或查询目标及结果状态，可通过 Calls 按钮统一折叠
- 工具参数与 JSON 结果支持树形展开、复制值/路径/JSON；长文本保留换行，默认展示头尾片段，支持原文复制、全文展开和换行切换
- 搜索时自动显示折叠中的命中记录，展示匹配数量、无结果提示与清空入口
- 消息与工具分别提供详情标签，支持思考折叠、内嵌图片、Markdown 代码复制、助手与工具双向跳转
- 桌面详情支持拖动和键盘调整宽度；标签支持方向键，Escape 关闭详情并返回记录
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

- **Duration**：首次使用默认关闭，所有记录按顺序等宽显示，之后记住浏览器内的选择。开启后按已有耗时绘制，并压缩操作之间的空闲间隔。没有耗时的记录显示为时间点，没有时间戳的记录不进入耗时视图。总时长为零时明确提示并回退到记录顺序。切换会清除旧选区并恢复完整视窗，详情始终使用原始时间和耗时。
- **Turns**：默认展开。点击 `⊟` 折叠所有包含多条记录的 Turn，保留首条记录及步骤数、工具调用数摘要。全部折叠后图标变为 `⊞`，再次点击展开全部。只有一条记录的 Turn 保持原样。
- **Calls**：默认展开。点击 `⊟` 按 Assistant 折叠其工具调用，保留 Assistant 及调用数量、工具名称摘要。若 Turn 已折叠，点击 Calls 会同时展开 Turn 层，让调用组的变化立即可见，并取消 Turns 的选中态。点击某条摘要只展开该组。部分展开时，全局按钮仍执行全部折叠。
- 折叠或展开 Turn 会保留其内部的工具调用折叠状态。双击 Turn 首条记录或带工具调用的 Assistant 可局部切换，摘要支持 Enter 和空格展开。搜索期间显示命中记录，清空搜索后恢复此前折叠状态。点击时间线会展开目标所属的 Turn 与调用组，并定位到记录。

## 时间线操作

在时间线上按住左键或触控拖动，即可框选一段记录。选区外记录变淡，列表保留上下文并定位首条匹配记录；选区内折叠记录会临时展开。搜索存在时定位两者共同命中的记录，清除选区会恢复此前折叠状态。

- 滚轮围绕指针缩放，缩放后按住右键拖动平移，拖选到边缘继续平移。
- 点击色块打开详情，点击空白处定位最近记录。
- Escape、双击、右键单击或记录计数旁的 Clear 清除选区。
- 时间线获得焦点后按 Home 恢复完整视窗；色块之间用左右键移动，Enter 或空格打开详情。
- 重新导入文件会清除旧选区和缩放，移动端框选会回到列表显示匹配记录。

完整能力对照、Pi 数据限制和验收方法见 [DeepSeek 交互验收清单](docs/deepseek-parity.md)。

## 检查

```bash
npm test
npm run build
```

浏览器验收使用已安装的 Chrome/Chromium，也可设置 `CHROME_BIN` 或执行 `npx playwright install chromium`。缺少浏览器时相应用例会标记跳过。测试生成的截图位于 `.pi/acceptance/`。

## 样式来源

`src/reference/` 中的轨迹 CSS 和主题变量从 deepseek harness 对应文件逐字复制，具体包括：

- `packages/client/ui-trajectory/src/client/*.module.css`
- `packages/client/ui-theme/src/styles/base.css`
- `packages/client/ui-theme/src/styles/design-platform.css`
- `packages/client/ui-theme/src/styles/gradient-shadow-text.css`
- `packages/client/ui-theme/src/styles/focus.css`
- `packages/client/ui-theme/src/styles/scrollbar.css`

时间线指针、选区和视窗算法迁移自 DeepSeek Harness `f3803c9697`。来源及 MIT 许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。

由于原组件依赖 Cordis、DSH Session 和客户端 primitives，本项目使用独立的 Pi JSONL 适配器提供 `Trajectory` 所需的展示数据。

项目专属视觉调整集中在 `src/app.css`，不修改 `src/reference/` 的来源文件。入口页提供文件导入引导，工作区保留紧凑表格与角色配色，使用统一的文字层级、控件尺寸、键盘焦点和选中反馈。桌面采用记录与详情分栏，760px 以下详情占满记录区，关闭后返回列表。工具输出默认按字符预算显示开头和结尾，完整内容仍保留在内存中并可按需展开或复制。详情正文统一纵向滚动，代码和宽表格在内容区内横向滚动，并尊重系统的减少动态效果设置。

页面界面沿用英文，文件始终只在当前浏览器内解析。
