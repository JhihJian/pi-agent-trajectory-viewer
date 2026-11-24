# Pi Trajectory UI

React 组件仓库与 live site，把 Pi Agent 会话变成可读的轨迹：时间线、记录表格、详情面板，以及一个可直接打开 `.jsonl` 文件的完整查看器。

组件自包含样式与逻辑，可在任意 React 18 应用中单独使用；live site 提供每个组件的活体预览、源码浏览和复制。

[Live site](https://jhihjian.github.io/pi-agent-trajectory-viewer/) · [Components](https://jhihjian.github.io/pi-agent-trajectory-viewer/#/components) · [Viewer](https://jhihjian.github.io/pi-agent-trajectory-viewer/#/viewer)

## Quick start

需要 Node.js 20+ 与 npm。

```bash
git clone git@github.com:JhihJian/pi-agent-trajectory-viewer.git
cd pi-agent-trajectory-viewer
npm install
npm run dev
```

开发服务监听 `0.0.0.0`。如果默认端口被占用，Vite 会自动选择下一个可用端口。

## 仓库结构

```
src/
  components/        组件层（自包含，统一从 index.js 导出）
    reference/       DeepSeek harness 逐字复制的参考样式，禁止修改
    styles/          组件层样式（主题聚合 index.css、黑白灰令牌主题 theme.css、viewer.module.css、detail.css）
    TrajectoryViewer.jsx   工作区容器：工具栏 + 时间线 + 表格联动
    TrajectoryToolbar.jsx  Duration / Turns / Calls 切换与搜索
    TrajectoryTable.jsx    虚拟化记录表格与详情分栏
    TrajectoryTimeline.jsx 时间线引擎（框选、缩放、平移）
    Timeline.jsx           时间线包装（投影与搜索命中）
    Detail.jsx             记录详情（标签页、Markdown、内嵌图片、usage）
    JsonTree.jsx           JSON 树与复制按钮
    Tooltip.jsx            延迟提示
    index.js               统一导出组件与纯逻辑模块
  lib/               纯逻辑层（无 React 依赖）
    parser.js          Pi JSONL 解析
    timeline.js        时间线投影、选区索引与搜索匹配
    trajectory-view.js 折叠、展开与等宽/耗时投影
  showcase/          live site（hash 路由展示站）
    main.jsx           站点入口
    Showcase.jsx       站点外壳与路由
    HomePage.jsx       首页
    ComponentPreview.jsx / ComponentDemo.jsx  组件活体预览
    ViewerDemo.jsx     完整查看器演示（文件导入 + TrajectoryViewer）
    viewer-demo.css    演示外壳样式（欢迎页、会话头部）
    showcase.css       站点框架样式
  data/              组件目录（catalog）与演示用样例会话
```

## 作为库引用

除演示站外，组件层可以打成普通 ESM 包供其他应用引用：

```sh
npm run build:lib     # 产出 dist-lib/index.js 与 dist-lib/index.css
```

```js
import { TrajectoryViewer, parsePiJsonl } from 'pi-agent-trajectory-viewer'
import 'pi-agent-trajectory-viewer/style.css'

const { turns } = parsePiJsonl(sessionText)
<TrajectoryViewer turns={turns} />
```

`package.json` 已声明 `main`/`module`/`exports`/`files`，`prepare` 在打包安装时自动构建。React 保持外部化，由宿主提供（本库按 React 18 构建），其余依赖打进产物。同仓库下 `session-viewer` 就是这样的宿主。

## 构建与预览

```bash
npm run build
npm run preview
```

生产构建输出到 `dist/`。

## Live site

线上站点由 GitHub Pages 从 `main` 分支自动部署（`.github/workflows/pages.yml`），每次推送先跑完整测试再发布。

- `#/`：概览与精选组件
- `#/components`：组件列表，支持分类与关键词过滤
- `#/components/:slug`：组件详情，含活体预览与源码（按需加载、可复制）
- `#/viewer`：完整查看器演示，拖入或选择 Pi Agent `.jsonl` 会话即可浏览

演示站内置一份样例会话驱动组件预览；查看器中的用户文件只在浏览器内解析，不上传到服务端。

## 使用组件

组件通过 `src/components/index.js` 统一导出。在 Vite 应用中按路径导入即可：

```jsx
import { TrajectoryViewer, parsePiJsonl } from './src/components/index.js'

const { turns } = parsePiJsonl(sessionText)

<TrajectoryViewer turns={turns} />
```

导出面：

- 数据与逻辑：`parsePiJsonl`、`flattenTurns`、`foldTargets`、`projectTimeline`、`matchesSearch`、`deriveTrajectoryTimeline` 等
- 容器组件：`TrajectoryViewer`（传入 `turns` 即可工作，内部接管选中、搜索、折叠与时间线选区编排；可选 `defaultDuration`、`defaultQuery`、`sessionRevision`、`onSelectionChange`）
- 展示组件：`TrajectoryToolbar`、`Timeline`、`TrajectoryTable`、`Turn`、`TrajectoryTimeline`、`Detail`、`JsonTree`、`CopyButton`、`Tooltip` 等，全部为受控 props

组件层自带主题（`src/components/styles/index.css` 聚合 reference 样式，`theme.css` 把令牌重映射为 todo-web 的出版物式黑白灰）；宿主页面只需提供页面框架。

## 轨迹切换

工具栏的切换行为对齐 DeepSeek `ui-trajectory`，时间投影与折叠计算集中在 `src/lib/trajectory-view.js`。三个按钮均按 `aria-pressed` 显示持久选中态：浅灰背景、近黑文字和图标，以及细描边。Duration 开启耗时视图时选中，Turns / Calls 全部折叠时选中，鼠标移开后仍保留高亮。

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

`src/components/reference/` 中的轨迹 CSS 和主题变量从 DeepSeek harness 对应文件逐字复制，具体包括：

- `packages/client/ui-trajectory/src/client/*.module.css`
- `packages/client/ui-theme/src/styles/base.css`
- `packages/client/ui-theme/src/styles/design-platform.css`
- `packages/client/ui-theme/src/styles/gradient-shadow-text.css`
- `packages/client/ui-theme/src/styles/focus.css`
- `packages/client/ui-theme/src/styles/scrollbar.css`

时间线指针、选区和视窗算法迁移自 DeepSeek Harness `f3803c9697`。来源及 MIT 许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。

由于原组件依赖 Cordis、DSH Session 和客户端 primitives，本项目使用独立的 Pi JSONL 适配器提供 `Trajectory` 所需的展示数据。

组件专属视觉调整集中在 `src/components/styles/`（结构与黑白灰令牌主题）与 `src/showcase/`（演示外壳），不修改 `src/components/reference/` 的来源文件。整体视觉对齐 todo-web 的出版物式风格：白底、1px #e5e5e5 细线、直角、等宽字体正文、衬线标题，仅错误状态保留 #b43c3c 红色。演示站点提供组件预览与源码浏览，`#/viewer` 保留文件导入引导、工作区紧凑表格与黑白灰角色分级（用户近黑、工具中灰、错误红）。桌面采用记录与详情分栏，760px 以下详情占满记录区，关闭后返回列表。工具输出默认按字符预算显示开头和结尾，完整内容仍保留在内存中并可按需展开或复制。详情正文统一纵向滚动，代码和宽表格在内容区内横向滚动，并尊重系统的减少动态效果设置。

页面界面沿用英文，文件始终只在当前浏览器内解析。
