# DeepSeek 轨迹交互对照与验收

本项目将 DeepSeek 的轨迹交互用于浏览器内的 Pi JSONL 会话。时间线可框选、缩放和平移，并与记录列表、折叠、搜索和详情联动。展示范围取决于 Pi 文件保存的消息、内容块、工具调用、结果和用量。

参考版本：DeepSeek Harness `f3803c9697`。参考目录为 `packages/client/ui-trajectory/src/client/`，重点对照 `TrajectoryTimeline.tsx`、`timeline.ts`、`TrajectoryView.tsx`、`TrajectoryTable.tsx` 和 `trajectory-search-index.ts`。

## 交互对照

| 能力 | 当前行为 | 验收方式 |
| --- | --- | --- |
| 时间线正向、反向框选 | 保留全部上下文，淡化范围外记录，展开匹配记录的折叠祖先，滚动并聚焦首条可见匹配记录 | `interactions.test.mjs` 正反向范围与远端定位 |
| 选区边界 | 使用闭区间相交，短拖动扩大到最小记录宽度，起止点保持在有效域内 | `timeline.test.mjs` 边界、反向及空交集；浏览器拖选 |
| 色块和空白点击 | 色块打开对应详情；空白处建立最小选区并定位最近记录 | 浏览器直接选择、键盘选择、空白点击 |
| 清除和取消 | Escape、双击、右键单击或 Clear 清除选区；指针取消与失去捕获清除未提交草稿 | 浏览器清除、双击、右键、pointercancel |
| 缩放和平移 | 滚轮以指针位置缩放；缩放后右键拖动平移；拖选到视窗边缘时平移；Home 恢复全域 | 浏览器缩放、右拖、边缘拖选、Home |
| 鼠标和触控 | Pointer Events 共用选区算法；触控框选结束后更新列表 | Chromium CDP 真实 touchStart/move/end |
| Duration | 默认顺序等宽；开启后使用现有耗时并压缩空闲间隔；偏好保存在当前浏览器 | 投影单测、刷新后的偏好、切换清理选区 |
| Turns、Calls | 保留全局及局部折叠；Turns 后点击 Calls 会展开外层 Turn；三个按钮保持持久选中态 | 原有折叠单测、SSR、浏览器组合操作 |
| 搜索与选区 | 多词 AND 匹配消息、思考、参数、结果、角色、Turn、记录 ID、call ID、工具名；搜索与选区取交集定位 | 多词搜索单测；折叠、搜索、选区联合验收 |
| 详情标签 | 消息有 Overview/Preview/Raw，工具有 Overview/Input/Output/Timing/Raw，压缩记录有 Overview/Raw；换记录保留可用标签 | 详情单测与真实浏览器；标签左右键、Home、End |
| 思考和内容 | 思考默认展开，可折叠；同一记录在 Overview/Preview 间保留折叠状态；图文按内容块顺序显示 | 详情 SSR、浏览器折叠和标签切换 |
| JSON 与长输出 | JSON 节点折叠、复制路径/值/JSON、字符串换行；文本头尾预览、全文展开、原文复制；Markdown 代码块复制 | `detail.test.mjs` SSR 和真实 Chrome 复制检查 |
| 详情跳转与调整 | Assistant 与工具双向导航；展开目标祖先；桌面拖动分栏、左右键调整、双击恢复；窄屏详情覆盖列表 | 全应用浏览器导航、焦点、分栏和五档宽度 |
| 时间与用量 | 原始时间可切换本地/Unix；用量保留零值与缓存字段，展示当前记录及之前记录的累计值 | 用量单测、Unix 时间切换、缺少计时说明 |
| 大会话 | 超过 100 条可见记录时虚拟化表格；搜索、框选和跳转可定位未挂载行；时间线色块采用单一 Tab 停靠点和左右键移动 | 10,200 条记录，列表 DOM 少于 100 行并定位远端工具 |

## Pi 数据适配与明确差异

- **时间语义**：优先使用文件中的 `durationMs`。工具缺少独立耗时时，展示 Assistant 到结果的时间间隔，并在 Timing 标明来源。首 token、请求起点、解码时间和生成速度仍显示为未记录。
- **零长度时域**：压缩后的总时长为零时，时间线提示“No elapsed duration · showing record order”并使用记录顺序。详情保留原始零值或未知值。耗时模式下全部缺少时间戳时显示“No timing data”。
- **选区联动**：范围匹配临时展开祖先，清除范围后恢复此前折叠状态。显式点击记录会展开其祖先。移动端框选会关闭覆盖列表的详情，使选区中的记录可见。
- **Raw**：保留完整 Pi 原始记录，便于核对本地文件字段；内容块及工具 JSON 通过树形结构查看。
- **图片**：支持 Pi 内容块内嵌的 base64 图片。只有路径、URL 或持久化引用的图片显示引用说明；DeepSeek 的远端图片加载和共享图库服务尚未接入。
- **运行时数据**：DeepSeek 的请求尝试与生命周期、系统提示词快照及差异、工具 schema/source、嵌套 subtool 链接、实时工具结果订阅和服务端历史分页依赖其会话服务。当前适配器展示本地文件的当前 `parentId` 分支，这些服务能力属于保留差异。
- **规模边界**：JSONL 在浏览器一次解析，完整记录保留在内存中。表格按视口渲染；全域时间线仍为每条记录生成色块，与参考实现一致。10,200 条记录是已验证样本规模，更大文件的解析内存与时间线 DOM 成本仍随记录数增长。

## 验证与复查

执行 `npm test` 和 `npm run build`。测试覆盖解析、折叠、投影、范围命中、SSR、独立详情浏览器交互及完整应用浏览器交互。浏览器用例优先使用 `CHROME_BIN`，其次查找本机 Chrome/Chromium 或 Playwright Chromium；安装命令为 `npx playwright install chromium`。缺少浏览器时用例会明确标记跳过。

完整应用验收覆盖 320、390、768、1024、1440px，检查横向溢出、详情边界、键盘焦点、触控和页面异常。截图写入 `.pi/acceptance/`：`range-desktop.png`、`detail-desktop.png`、`range-mobile.png`、`detail-mobile.png`。截图可用于复查桌面与移动端的范围高亮、详情布局和操作入口。

参考 CSS 集中在 `src/components/reference/`，主题聚合入口为 `src/components/styles/index.css`，组件结构样式为 `src/components/styles/viewer.module.css`，演示外壳样式为 `src/showcase/viewer-demo.css`。时间线交互迁移至 `src/components/TrajectoryTimeline.jsx`，Pi 投影及搜索适配在 `src/lib/timeline.js`，表格与详情各自维护展示职责。
