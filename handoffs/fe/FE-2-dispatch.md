# FE-2 派单 — B 阶段手册 + C 资产手册区块

你是本任务的独立执行 agent（autopilot 管线 L1，全新上下文）。工作区：`D:\.ai-hub\skills\yy`。
完成后由独立复核者（L2）重执行全部证据——**不自称 DONE，只交付证据**。

## 硬性 skill 调用（同 FE-1，L2 审计项）
1. **ui-ux-pro-max**：跑检索（forms & feedback / progressive disclosure 相关 domain），摘录贴 RESULTS.md；铁律：可复制按钮 ≥44px 触控、复制成功反馈（loading/success 态）、可见标签
2. **taste-skill**：Design Read 延续 FE-1 定稿（极简瑞士风格），RESULTS.md 首行声明 + pre-flight 自查；B/C 手册区块按瑞士网格继续（不做卡片堆砌/AI-purple）

## 必读
1. `plans/frontend-plan-20260921.md`（B/C 功能规格）
2. `webview/journey/content.js`（FE-0 产物：phases[6] 的 goal/summary/kickPrompt/redoPrompt + assets[16] 卡片）
3. `webview/journey/index.html` + `styles.css`（FE-1 产物，7c54b556/d079d9f1——在它们基础上扩展，保持极简瑞士风格一致）

## 交付物（白名单，仅 2 文件修改）
1. `webview/journey/index.html` 扩展：
   - **B 阶段手册区块**（数据源 content.js.phases）：6 阶段逐段——阶段名+目标一句话+注入内容摘要+配套资产名+**催办话术**（复制按钮）+**重走等效 Prompt**（复制按钮）
   - **C 资产手册区块**（content.js.assets）：16 资产卡片——name+description+cluster 徽章+**强制点名话术**（复制按钮）
   - 复制按钮 = `navigator.clipboard.writeText`，成功/失败反馈态（aria-live polite）；**纯只读页面**（唯一"写"操作是剪贴板）
   - 复制按钮触控 ≥44px、可见标签（非图标按钮无 aria-label 的反模式禁止）
2. `webview/journey/styles.css` 扩展：手册区块的瑞士网格排布（与 A 区块同一网格系统延续）、资产卡片的 cluster 徽章样式（扁平语义色）、复制按钮态样式
3. 自测 `test-reports/autopilot-work/FE-2/`：RESULTS.md（**首行 Design Read 延续声明** + ui-ux-pro-max 检索摘录 + 铁律自查 + D-xxx 偏差登记——无 discrepancy = 复核直接 FAIL）+ 探针（content.js 消费面：6 phases/16 assets 全渲染、三类复制按钮把对应文案传入 clipboard.writeText 的 mock 验证、无新增 CDN/npm、三区块样式同源）

## 禁止
改 render-core.mjs/host-bridge.mjs/content.js、contracts/、plans/、队列/看板；
读 test-reports/acceptance-*/；git 操作；引入 CDN/npm/框架；用 emoji 当图标。

