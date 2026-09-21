# FE-3 GUI 盲测报告 — web-gui-tester（autopilot 管线，测试与修复分离）

- 派单：`handoffs/fe/FE-3-dispatch.md`（方法论：`browser-use/web-gui-tester SKILL.md` + `control-browser SKILL.md`）
- 被测对象：`webview/journey/index.html`（+ styles.css / render-core.mjs / content.js）— YY Journey Control Room
- 测试性质：**纯 GUI 黑盒**（只与可见可操作元素交互、截图视觉验证 + 只读 DOM 交叉验证、零 JS 注入改状态、测试期未改任何被测代码）
- 结论定位：**本报告为证据交付，不自称 DONE**；测试与修复分离，发现缺陷仅记录，未改码。

## 0. 测试点总览（N/N）

**测试点 19/19 执行完毕：PASS 13 / FAIL 3 / BLOCKED 3。** 截图证据 11 张（全部经 Read 工具回读做视觉验证，见 §4）。

| # | 测试点 | 优先级 | 结果 |
|---|---|---|---|
| T1.1 | 页面加载+截图总览（健康投影） | P0 | PASS |
| T1.2 | 九节点渲染（节点名+状态徽章+gate 卡） | P0 | PASS |
| T1.3 | B 阶段手册 6 段全渲染 | P0 | **FAIL**（DEFECT-2） |
| T1.4 | C 资产手册 16 卡全渲染 | P0 | **FAIL**（DEFECT-2） |
| T2.1 | 下一步提示区+复制按钮可见 | P0 | **FAIL**（DEFECT-1） |
| T2.2 | 复制按钮点击→剪贴板反馈态 | P0 | **BLOCKED**（被 DEFECT-1 阻断） |
| T3.1 | 告警条健康时隐藏 | P1 | PASS |
| T4.1 | JOURNEY_NOT_FOUND 数据通道 | P1 | PASS |
| T5.1 | PROJECTION_CONFLICT 双侧证据告警条 | P1 | PASS |
| T6.1 | 无注入数据不白屏（degraded 通道） | P2 | PASS |
| T7.1 | 双主题切换（prefers-color-scheme dark 模拟） | P1 | PASS |
| T8.1 | 超长资产 description 不溢出 | P2 | **BLOCKED**（被 DEFECT-2 阻断） |
| T9.1 | 连点复制按钮不崩 | P2 | **BLOCKED**（被 DEFECT-1+2 阻断） |
| T10.1 | 触控区 ≥44px（DOM 量测） | P3 | PASS（带保留，见 §2） |
| T11.1 | 正文对比度 ≥4.5:1（DOM+WCAG 计算） | P3 | PASS |
| T11.2 | 状态徽章对比度（DOM+WCAG 计算） | P3 | PASS |
| T12.1 | 瑞士网格多列布局 | P3 | PASS |
| T12.2 | 零装饰（无阴影/无渐变，全 DOM 扫描） | P3 | PASS |
| T13.1 | 控制台错误收集（全程只读监听） | P1 | PASS（仅 favicon 404 噪音） |

## 1. 环境准备（黑盒限制不适用，全部如实登记）

1. 本会话的 `mcp__node_repl__js` 浏览器注册表报 `Browser is not available in subagent`（IAB/extension/cdp 均不可用）。按派单「若浏览器工具不可用→如实报告」的兜底，改用**本机 Chrome + playwright-core 驱动**（同源 GUI 语义：真实导航/真实点击/只读 DOM/截图），驱动脚本与依赖装在临时目录 `.tmp-fe3/`，未触碰 webview/。
2. 静态服务器 ×2：
   - `python -m http.server 8101`（cwd=`webview/journey/`，提供原始骨架页 `index.html` 的 degraded 通道）
   - `python -m http.server 8102 --directory .tmp-fe3/`（提供测试副本）
3. 测试副本（环境准备期允许）：复制 `index.html` + `styles.css` + `render-core.mjs` + `content.js` 到 `.tmp-fe3/`，在首个 `<script>` 前注入 `window.__YY_JOURNEY__` mock payload（host-bridge.mjs `buildPageHtml` 同款机制——注入发生在页面脚本执行前，等同宿主注入）：
   - `index-mock.html`：健康投影（9 步、phase 7、evidence 2 条、nextPrompt 带 snapshotHash）
   - `index-notfound.html`：`read.ok=false + JOURNEY_NOT_FOUND`
   - `index-conflict.html`：`project.ok=false + PROJECTION_CONFLICT`
   - `index-long.html`：健康投影 + 末尾追加一张超长 description 测试卡（DOM 追加，非页面源码修改）
   - degraded 通道直接测 **原始** `index.html`（零修改）
4. 控制台监听为只读（console/pageerror 事件），全程收集错误级日志。
5. 「环境准备完成，正式测试开始」后未再返回注入；所有结论来自页面实际行为。

## 2. P0 主流程

### T1.1 页面加载 + 总览 — PASS
- GUI：导航至 `index-mock.html`，等待 `#journey-grid .journey-node` 出现（真实加载路径，无注入等待）。
- DOM：loading 提示已隐藏；`#page-meta` = `session: test-session-fe3 | 投影状态: OBSERVED | 阶段: 7 | 更新于: 2026-09-22T09:55:00Z`。
- 视觉：![t1 总览](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t1_overview_top.png) 页头粗规则线、九节点网格、证据区、下一步提示区、双手册区块标题齐备，无白屏无错位。

### T1.2 九节点渲染 — PASS
- DOM：9 节点卡、9 徽章、9 gate 卡。节点名 = 资产整合/文档化/重执行1/拆任务/重执行1,2/规划+契约/重执行1,2,3/并行派单/批判反哺。
- 语义不靠颜色单独传义（徽章文案含中文态+英文态）：`已确认 · AUTHORIZED`、`已观察 · OBSERVED`、`不完整 · PARTIAL`；gate 行 `gate: concept-signed` 与回跳层 `gate: 无（回跳层）` 均正确。

### T1.3 B 阶段手册 6 段 — FAIL（DEFECT-2）
- DOM：`#phases-list .phase-item` = **0**（期望 6）；只读探针 `typeof GUIDE_CONTENT === 'undefined'`。
- 根因（只读交叉验证）：页面内**没有任何加载 content.js 的机制**——`index.html` 仅 1 个内联 `<script>`，无 `<script src>`；`renderPhases/renderAssets` 的 guard（`typeof GUIDE_CONTENT === 'undefined'`）静默 return，区块只剩标题与说明文字。`content.js`（FE-0 产物，`export const GUIDE_CONTENT`）存在于同目录但从未被页面消费。
- 视觉：![t1 手册区](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t1_phases_assets_area.png) 「阶段手册」「资产手册」两个 section 空置。

### T1.4 C 资产手册 16 卡 — FAIL（同因 DEFECT-2）
- DOM：`#asset-grid .asset-card` = **0**（期望 16）。与 T1.3 同根因。

### T2.1 下一步提示区/复制按钮可见 — FAIL（DEFECT-1）
- DOM：按钮在 DOM 中（`#copy-next-prompt`）但 `isVisible()=false`、`#next-section hidden=true`；`#next-hint`、`#next-meta` 全空；按钮 `onclick` 为 null（`renderNextPrompt` 从未生效执行）。
- 根因（只读复现，页面自身模块）：`main()` 中 `view.nextPrompt = nextPromptView(j.nextPrompt)` 已归一化，随后 `npNormalized = core.nextPromptView(view.nextPrompt)` **二次归一化**；而 `renderNextPrompt(view)` 内部取的是 `view.nextPrompt`——传入的是 nextPrompt 对象本身，`.nextPrompt` 恒为 `undefined` → 走 `if (!np) { section.hidden = true; return; }`。即：**注入数据有 nextPrompt 时，下一步提示区仍恒隐藏**。分支逻辑本身健在（notFound 时也显式 hidden，行为一致）。

### T2.2 复制按钮点击 → 剪贴板反馈 — BLOCKED（被 DEFECT-1 阻断）
- GUI 忠实尝试：对按钮执行真实 click → `element is not visible`（用户视角无此目标）。真剪贴板读取未执行——**剪贴板链路 GUI 级未验证**，不做任何替代（无注入、无 force click）。主流程「复制按钮点击→反馈态」整体不可达。

## 3. P1/P2/P3

### T3.1 告警条健康时隐藏 — PASS
健康投影下 `#alert-banner`（role=alert）hidden。![t3](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t3_banner_hidden_healthy.png)

### T4.1 JOURNEY_NOT_FOUND 数据通道 — PASS
grid 渲染单卡「未找到 journey」，告警条保持隐藏（契约 §8.1：走数据通道而非 overlay）。![t4](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t4_notfound.png)

### T5.1 PROJECTION_CONFLICT 双侧证据 — PASS
告警条显示 `冲突：投影数据源矛盾（PROJECTION_CONFLICT）` + 显示原因 + 2 条 conflict 列表项（read/project 两侧各一，不自动取舍）。![t5](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t5_conflict_banner.png)

### T6.1 degraded 不白屏 — PASS（原始 index.html，零修改）
无 `window.__YY_JOURNEY__` 时：告警条显示 `降级：数据源不可用` + 原因 `bridge payload 缺失（window.__YY_JOURNEY__ 未注入）`，九节点 grid 清空不伪造数据，页面 body 文本正常（不白屏）。![t6](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t6_degraded.png)

### T7.1 双主题 — PASS
同一 mock 页面在 `colorScheme: dark` 模拟下重载：body bg `rgb(255,255,255)` → `rgb(17,17,17)`，徽章换为深色 token（`rgb(138,180,248)` 底），文本仍可读。![t7 dark](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t7_dark_theme.png)

### T8.1 超长 description 溢出 — BLOCKED（被 DEFECT-2 阻断）
资产卡 0 张，无 GUI 渲染目标。静态交叉验证：`styles.css` 的 `.asset-desc/.asset-name/.cluster-badge` 均含 `overflow-wrap: anywhere`（仅代码级核对，GUI 未验证）。

### T9.1 连点复制按钮 — BLOCKED
全部复制按钮不可见/不存在（DEFECT-1 + DEFECT-2），无可点击目标，页面崩溃无从触发。

### T10.1 触控区 ≥44px — PASS（带保留）
DOM 量测：`.copy-button` computed `min-height=44px; min-width=44px`。保留：因 DEFECT-1/2 按钮不可见，**视觉级确认未完成**（量测的是隐藏元素的计算样式）。

### T11.1/T11.2 对比度 — PASS（DOM+WCAG 计算）
- 正文：fg `rgb(26,26,26)` / bg `rgb(255,255,255)` → **17.40:1**（≥4.5）。
- 状态徽章（AUTHORIZED）：fg `rgb(255,255,255)` / bg `rgb(11,87,208)` → **6.39:1**（≥4.5）。目测与 DOM 值互证：![t11](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t11_contrast_area.png)

### T12.1/T12.2 瑞士风格 — PASS（达成度高）
- `.journey-grid` 实际 4 列轨道（minmax(220px,1fr) 显式轨道），卡片对齐、留白均匀、字阶对比强。
- 全 DOM 扫描：`box-shadow` 元素 0 个、`background-image`（渐变）元素 0 个——零装饰达成。
- ![t12 top](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t12_swiss_top.png) ![t12 grid](file:///D:/.ai-hub/skills/yy/test-reports/autopilot-work/FE-3/screenshots/t12_swiss_grid.png)

### T13.1 控制台错误 — PASS（只读收集）
全程唯一错误：2 次 `Failed to load resource: ... 404`，均为 `favicon.ico`（环境噪音）。**无任何 JS 异常 / unhandledrejection / 页面错误文案**。

## 4. 截图证据清单（11 张，均已 Read 回读做视觉验证）

| 文件 | 对应测试点 |
|---|---|
| `screenshots/t1_overview_top.png` | T1.1/T1.2 |
| `screenshots/t1_phases_assets_area.png` | T1.3/T1.4（FAIL 证据：两手册区块空置） |
| `screenshots/t2_next_section_hidden.png` | T2.1（FAIL 证据：next 区隐藏） |
| `screenshots/t3_banner_hidden_healthy.png` | T3.1 |
| `screenshots/t4_notfound.png` | T4.1 |
| `screenshots/t5_conflict_banner.png` | T5.1 |
| `screenshots/t6_degraded.png` | T6.1 |
| `screenshots/t7_dark_theme.png` | T7.1 |
| `screenshots/t11_contrast_area.png` | T11.1/T11.2 |
| `screenshots/t12_swiss_top.png` / `t12_swiss_grid.png` | T12.1/T12.2 |

结构化结果另存：`results.json`（19 条逐点记录 + 控制台错误 + 截图路径）。

## 5. 缺陷清单（分级：P0 阻断 / P1 功能 / P2 视觉）

### DEFECT-1 【P0 阻断】下一步提示区恒隐藏，复制主链路不可达
- 现象：注入数据携带 `nextPrompt`（actionHint/targetNode/requiredInputs/snapshotHash 齐全）时，`#next-section` 仍 `hidden`，`#copy-next-prompt` 在 DOM 中但永不可见、`onclick` 恒 null；用户永远无法复制下一步提示。
- 根因：`index.html` 内联脚本 `main()`：`view.nextPrompt` 已是 `nextPromptView()` 归一化产物，`const npNormalized = core.nextPromptView(view.nextPrompt)` 做了二次归一化（此时对象上已无 `.nextPrompt` 字段），而 `renderNextPrompt(view)` 内部第一行取 `view.nextPrompt` → undefined → `section.hidden = true; return;`。参数语义与调用实参不匹配。
- 复现：健康投影 payload（含 nextPrompt）注入后加载页面 → 观察下一步提示区（T2.1 证据截图）。
- 影响面：FE-2 交付的三类复制按钮中「下一步提示」这一类 GUI 不可达；派单 P0「复制按钮点击→剪贴板反馈」被阻断。

### DEFECT-2 【P0 阻断】content.js 从未被页面加载，B/C 手册零渲染
- 现象：`#phases-list .phase-item` = 0/6、`#asset-grid .asset-card` = 0/16；`typeof GUIDE_CONTENT === 'undefined'`。
- 根因：`index.html` 无 `<script src="./content.js">`（或任何 module 加载路径）；`content.js` 是 `export const GUIDE_CONTENT` 的 ESM，页面也没有 `import` 它的代码。两个 render 函数的 undefined guard 静默吞掉该状态，不报错。
- 复现：任意注入状态下打开页面 → 滚动至「阶段手册/资产手册」区块（T1.3 证据截图）。
- 影响面：派单 P0 三大功能中的两大（B 阶段手册、C 资产手册）在 GUI 上不存在；P2 的长文本溢出、连点复制等边界测试随之不可达。

### DEFECT-3 【P2 视觉/验证面】复制成功态回落文案硬编码
- 说明（静态核对，GUI 因 DEFECT-1/2 未验证）：`copyText` 成功回落写死 `'复制提示'`/`'复制文本'`，但阶段/资产复制按钮初始文案即为「复制文本」且各自携带 `data-copy-label`（如「催办话术」「强制点名话术」）；2 秒后按钮文字回落为与 `data-copy-label` 语义不符的通用文案。等级 P2（不影响功能正确性，影响可见标签一致性）。待 DEFECT-1/2 修复后 GUI 复测。

（无 P1 级功能缺陷：notFound/conflict/degraded 三条降级通道行为均符合契约。）

## 6. GUI 级复制验证结果（如实记录）

- **真剪贴板验证：未能执行。** 唯一可见路径 `#copy-next-prompt` 因 DEFECT-1 不可见，真实点击被浏览器判定 `element is not visible`（即真实用户同样点不到）；阶段/资产复制按钮因 DEFECT-2 根本不存在。测试遵循「若正常 GUI 操作失败即如实记录，不用替代手段强行推进」，未做任何注入/force click/URL 构造绕过。
- 可佐证的间接证据（只读交叉验证，非剪贴板本身）：① `copyText` 函数存在于页面且 `navigator.clipboard && navigator.clipboard.writeText` 分支健在（成功/失败双反馈 + 2s 回落逻辑完整）；② `copy-feedback`/`copy-status` 双 aria-live=polite 反馈区在 DOM 中就位；③ T6 degraded 页告警条文本渲染正常，说明反馈通道的 DOM 基础无恙。**结论：复制链路 GUI 级验证 = 环境不支持（被阻断），待缺陷修复后重测。**

## 7. 方法论符合性自查

- 纯 GUI 黑盒：交互仅限真实导航与真实点击；DOM 读取全部只读（evaluate 仅 getComputedStyle/innerText/performance 等无副作用读）；未用 Tab/快捷键/force click/刷新/URL 构造绕过任何失败。
- 测试与修复分离：测试全程未改 `webview/`（禁改清单字节级未触碰）；所有修复性发现仅记录于 §5。
- 双重验证：每个测试点均有「只读 DOM 交叉验证 + 已回读的截图视觉验证」，二者互证，无一以代码验证替代截图。
- 环境与测试分离：§1 全部 setup 操作已登记；测试开始后无返回注入。
- console 只读监听注册于测试起点，全程收集；无监听能力缺口。

— FE-3 专职 GUI 测试 agent · 2026-09-22 · 不自称 DONE，仅交付证据
