# webview/journey — Journey Control Room（YY host webview 插件页）

Journey 现状导航 v2（2026-09-21 Owner 三点定位定稿）：**面向使用者的随行导航手册**——不是仪表盘，不是数据表。单页三区块 A 现状导航 / B 阶段手册 / C 资产手册，纯只读 + 复制按钮。规格出处：`plans/frontend-plan-20260921.md`（v3 Owner 定稿版）。

## 页面架构：三区块 A/B/C

### A 现状导航（数据源：`window.__YY_JOURNEY__` 注入契约）

- 九节点 journey 网格（节点 0→8，含回跳层）：每节点 = 步号 + 节点名 + 状态徽章 + gate 卡（合并进节点：卡在哪个 gate / 该看什么 / 说什么才通过；无 gate 节点标注「回跳层」）。缺失 step 行也走 `mapStep(null)` 显示 ERROR，不伪造成功。
- 顶部告警条：降级（注入载荷缺失/非法，含 bridgeReason）与投影冲突（PROJECTION_CONFLICT，节点级两侧证据均列出）时显示，健康时隐藏。
- 证据列表（`view.evidence`，空则隐藏）；页头 meta 行（session / 投影状态 / 阶段 / 更新时间）。
- 下一步提示区：nextPrompt 经 `render-core.nextPromptView` 归一化（actionHint / 目标节点 / 必需输入 / snapshotHash 快照回显，recompute=false），np=null 时显式隐藏。
- 状态语义以 `render-core.mjs` 为权威：六显示态 AUTHORIZED / OBSERVED / INFERRED / STALE / PARTIAL / ERROR；三负态 FAILED / SKIPPED / UNRESOLVED 永不渲染为成功；组内取最坏态 rollup（FAILED 压过一切）。

### B 阶段手册（数据源：`content.js` → `GUIDE_CONTENT.phases`，构建期静态产物）

7 个 command 入口逐卡片（`/yy 0` 至 `/yy 5`，含 `/yy research`）：命令编号与名称、目标、摘要、配套资产名、纪律指针及两颗复制按钮。摘要取当前 command 的 host-adapter 首行；**催办话术**与**重走等效 Prompt**返回同一 command 来源。手册不从 frontmatter prerequisites 计算准入；宿主须按 command 展示并消费 Core/V2 Decision Packet。

### C 资产手册（数据源：`content.js` → `GUIDE_CONTENT.assets`，构建期静态产物）

9 个资产逐卡片：名称、域簇徽章（cluster，文字+色）、一句话功能（源自当前 vendor 入口 description）、可能用到的命令（stages，如有）、一颗复制按钮——**强制点名话术**，模板为「请你现在读取并应用 <资产名> 的方法论」（页面侧拼接）。资产范围来自 `matrix.mjs` 的 CLUSTERS candidates 并集。

### loadGuideContent 动态装载

B/C 区块内容由 `loadGuideContent()` 动态 `import('./content.js')` 装载（与 render-core 同型的动态导入），挂到 `window.GUIDE_CONTENT` 后渲染。失败不静默：import 失败走告警条「错误：手册内容加载失败」（含异常信息）；数据不完整走「错误：手册内容装载不完整」（含 phases/assets 计数）。手册是构建期静态文档，不依赖注入投影——投影降级 / JOURNEY_NOT_FOUND 分支下 B/C 照常装载渲染，A 区块则分别只留告警条 / 未找到卡片，不伪造数据。

## 注入契约（字节锚定不变）

- 宿主侧 `host-bridge.mjs`（恢复 sha 锚 b02cfd65…）运行既有 CLI（`scripts/tt-journey.mjs --read / --project`），构建统一壳载荷，在页面**第一个 script 标签之前**注入 `window.__YY_JOURNEY__ = { read, project, injectedAt, sessionId }`（OQ-U-17=a）。
- 页面只消费统一壳 `{ok, code, data, evidence, warnings}`；`render-core.mjs`（恢复 sha 锚 93a7652b…）的 `deriveJourneyView` 是唯一视图模型入口。NOT_FOUND 走数据通道（ok=false + code + data 诊断），CONFLICT 两侧证据均列出不自动取舍。
- 只读纪律：页面唯一「写」操作是剪贴板；从不写 state/receipts/disk，从不调用 phase.transition；无轮询，数据更新 = 宿主重注入。

## 瑞士风格设计语言（styles.css）

Minimalism & Swiss Style，Design Read 定稿："developer utility handbook, grid-driven layout, generous whitespace, strong typographic hierarchy, flat semantic color accents, zero decoration"。落到实现：CSS Grid 显式轨道（`--grid-track: minmax(220px,1fr)`，三个网格共用同一轨道系统）；大留白间距尺度（`--sp-1`…`--sp-6`）；强字阶（`--fs-micro` 0.75rem 到 `--fs-display` 2.25rem）；扁平语义色徽章（纯色块，六态 token 全部定义在 `:root`，组件不裸 hex）；零装饰（无阴影/渐变/动画堆砌，Swiss 粗规则线 `border-top: 3px` 代替卡片堆砌，直角系统 `border-radius: 0`）；明暗双主题跟随 `prefers-color-scheme`，全部前景对比按 4.5:1 校准（token 注释带实测比值）；`prefers-reduced-motion` 显式兜底。

## 复制按钮语义

统一走一个 `copyText()` 通道，**clipboard API 是页面唯一写操作**。按钮文案即反馈态：点击 → 「复制中...」→ 成功「已复制」2 秒后回落到该按钮自身的 `data-copy-label`（复制提示 / 催办话术 / 重走等效 Prompt / 强制点名话术）→ 失败显示具体原因（环境拒绝剪贴板访问 / 不支持 clipboard API）。反馈承载：按钮自身可见文案变化 + 页面级单个 `#copy-status`（aria-live polite）承载最近一次复制结果，避免数十个 live region。触控铁律：`min-height/min-width: 44px`。

## Files

| file | role |
|---|---|
| index.html | 单页三区块（A 现状导航 + B 阶段手册 + C 资产手册）+ 告警条 + 内联入口脚本（消费 `__YY_JOURNEY__` 与 render-core 导出；loadGuideContent 动态装载 content.js） |
| styles.css | 瑞士风格设计系统：显式轨道网格 / 留白与字阶 token / 六态扁平语义色（:root 定义，明暗双主题 4.5:1）/ 零装饰直角规则线（取代旧 journey.css 基线） |
| content.js | B/C 手册静态数据（`GUIDE_CONTENT` = 7 command entries + 9 assets），由 `scripts/build-guide-content.mjs` 构建期生成，可再生成、不手写 |
| render-core.mjs | 纯视图模型（Node 可测，恢复 sha 锚 93a7652b…，未动）：bridge 检测、状态映射、最坏态 rollup、nextPrompt 快照回显、conflict 视图、NOT_FOUND 数据通道 |
| host-bridge.mjs | 宿主侧注入器（恢复 sha 锚 b02cfd65…，未动）：跑既有 CLI、构建载荷、首个 script 标签前注入；可选 dev 静态服务器 |
| journey.css | 旧版 51 行基线，已被 styles.css 整体取代，保留未引用（历史对照用） |
| README.md | 本文件（v2 页面架构说明） |

## 与旧版 README 的差异（R5b 基线 → v2）

- **页面结构**：旧版描述「5 views：进度/规划/执行/证据/更多」的多视图页；v2 是单页三区块 A/B/C（无视图路由），证据与下一步提示并入 A 区块，B/C 为新增手册区块。
- **样式基线**：旧 styles.css 描述（10px radius、pill 999px 圆角胶囊）对应旧 journey.css 基线；v2 的 styles.css 是全新瑞士风格设计系统——直角、扁平规则线、无圆角胶囊。journey.css 保留但不再被 index.html 引用。
- **新增文件**：content.js（FE-0 构建产物）与 B/C 两区块的装载渲染路径（loadGuideContent 动态 import，失败走告警条不静默）。
- **降级呈现**：旧版「degraded overlay」描述为整页遮罩；v2 降级/冲突统一为顶部告警条（alert-banner），A 区块不伪造数据，B/C 静态手册独立照常渲染。
- **不变项**：注入契约 `window.__YY_JOURNEY__`、render-core/host-bridge 两个 sha 锚文件、只读纪律、三负态永不渲染为成功、NOT_FOUND 数据通道、CONFLICT 两侧证据、nextPrompt 快照回显（recompute=false）、无轮询、对 scripts/ contracts/ plans/ vendor/ prototypes/ 零改动。旧版「manual refresh button（host hook first, else reload）」条目为旧页面机制，v2 页面内无刷新按钮，更新依赖宿主重注入。
