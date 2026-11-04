# Pi Agent Trajectory Viewer

一个只读的微型前端，用于打开并渲染 Pi Agent 保存的 `.jsonl` 会话文件。

## 功能

- 浏览器本地选择或拖拽 Pi Agent session JSONL
- 按当前 `parentId` 分支展示 User、Assistant、Tool 和 Context 轨迹
- 展示 Assistant thinking、工具参数、工具结果、错误状态和 usage
- 复用 deepseek harness `ui-trajectory` 的表格、时间线、工具栏、详情面板和主题样式
- 支持轨迹搜索、Turn 折叠、记录详情和响应式移动端布局

文件只在浏览器内解析，不上传到服务端。

## 启动

```bash
npm install
npm run dev
```

开发服务监听 `0.0.0.0`。如果默认端口被占用，Vite 会自动选择下一个可用端口。

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

由于原组件依赖 Cordis、DSH Session 和客户端 primitives，本项目保留原视觉和布局样式，使用独立的 Pi JSONL 适配器提供 `Trajectory` 所需的展示数据。
