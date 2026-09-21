# FE-1 派单 — 页面骨架 + 新 styles.css（极简主义与瑞士风格）

你是本任务的独立执行 agent（autopilot 管线 L1，全新上下文）。工作区：`D:\.ai-hub\skills\yy`。
完成后由独立复核者（L2）重执行全部证据——**不自称 DONE，只交付证据**。

## 硬性 skill 调用（派单要求，L2 审计项）
1. **必须调用 ui-ux-pro-max**（已部署）：先跑其检索脚本（`node C:\Users\Administrator\.agents\skills\ui-ux-pro-max\scripts\search.js --domain ux --query "minimalism swiss accessibility"` 等，读该 skill 的 SKILL.md 用法），产出检索摘录贴进 RESULTS.md；铁律逐条过：对比 4.5:1、触控/点击区 ≥44px、语义色 token（不裸 hex 于组件）、无 emoji 图标、reduced-motion 支持、焦点环保留
2. **必须调用 taste-skill**（已部署，name: design-taste-frontend）：读其 SKILL.md §0，在交付 RESULTS.md 首行声明 Design Read（已定稿："developer utility handbook, Minimalism & Swiss Style — grid-driven layout, generous whitespace, strong typographic hierarchy, flat semantic color accents, zero decoration"），并按其 pre-flight check 自查

## 必读
1. `plans/frontend-plan-20260921.md`（FE-1 规格 + A 现状导航功能定义）
2. `webview/journey/render-core.mjs`（冻结锚 93a7652b——**只消费不改**；其导出 DISPLAY_STATES/NEGATIVE_STATES/mapStep/deriveJourneyView/conflictView/nextPromptView 是页面的唯一视图模型）
3. `webview/journey/host-bridge.mjs`（注入契约 `window.__YY_JOURNEY__`，冻结锚 b02cfd65 不改）
4. `webview/journey/content.js`（FE-0 产物，B/C 内容暂不用——FE-2 才接；本任务只做 A）

## 交付物（白名单，仅 2 文件）
1. `webview/journey/index.html` — A 现状导航页骨架：
   - 消费 `window.__YY_JOURNEY__`（host-bridge 注入）+ 动态 import `./render-core.mjs` 调 `deriveJourneyView`
   - 九节点 journey（0→8 含回跳层）：瑞士网格排布，每节点 = 节点名 + 状态徽章（六态色语义）+ gate 卡（合并进节点：卡在哪个 gate/看什么/说什么通过）
   - 顶部告警条：degraded/conflict 时显示（conflictView），健康时隐藏
   - **零运行时依赖**（无 CDN/框架）；`prefers-color-scheme` 双主题
   - 下一步提示区（nextPromptView 输出 + 复制按钮——clipboard API，FE-2 完善但占位先放）
2. `webview/journey/styles.css` — 极简瑞士风格：网格驱动（CSS Grid 显式轨道）、大量留白、强字阶（大标题 vs 小注释字号对比 ≥2 级）、扁平语义色徽章（纯色块）、零装饰（无阴影渐变动画堆砌）、reduced-motion 媒体查询、对比 4.5:1、触控 44px
3. 自测 `test-reports/autopilot-work/FE-1/`：RESULTS.md（**首行 Design Read 声明** + ui-ux-pro-max 检索摘录 + 铁律自查表 + D-xxx 偏差登记——无 discrepancy = 复核直接 FAIL）+ 探针（本地起静态服务器/文件加载页面：注入 mock payload 渲染九节点/告警条隐藏/双主题截图路径记录；DOM 消费面对 render-core 导出）

## 禁止
改 render-core.mjs/host-bridge.mjs/content.js（FE-0 产物）、contracts/、plans/、队列/看板；
读 test-reports/acceptance-*/；git 操作；引入 CDN/npm/框架；用 emoji 当图标。

## 瑞士风格锚（taste-skill 纪律）
Do not default to AI-purple gradients / centered hero over dark mesh / glassmorphism。
判据：删除所有装饰后信息仍完整可读 = 极简成立。

