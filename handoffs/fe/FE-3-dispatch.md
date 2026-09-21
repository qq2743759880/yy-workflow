# FE-3 派单 — web-gui-tester 全 GUI 盲测

你是本任务的专职 GUI 测试 agent（autopilot 管线，**测试与修复分离**：测试期不改任何代码）。
工作区：`D:\.ai-hub\skills\yy`。先读 `C:\Users\Administrator\.zcode\cli\plugins\cache\zcode-plugins-official\browser-use\0.5.1\skills\web-gui-tester\SKILL.md` 并严格按其方法论执行（纯 GUI 黑盒：只与可见可操作元素交互、截图+只读 DOM 交叉验证、禁 JS 注入改状态）。

## 测试对象
`webview/journey/index.html`（+ styles.css + render-core.mjs + content.js，均在 `webview/journey/`）。
目标页面 = YY 的 Journey Control Room：A 现状导航（九节点+gate 卡+告警条）+ B 阶段手册 + C 资产手册 + 复制按钮。

## 环境准备（黑盒限制不适用）
1. 起本地静态服务器：`cd D:\.ai-hub\skills\yy\webview\journey && python -m http.server 8101`（或 node 等价）
2. 测试注入：页面数据走 `window.__YY_JOURNEY__`——环境准备期允许用 file:// 打开前构造一个测试 HTML 副本（复制 index.html 到临时目录 + 注入 mock payload script），或直接测静态骨架（degraded/notFound 通道也是合法测试面）
3. 若浏览器工具不可用 → 如实报告 SKIP（不假装测试过）

## 测试计划（P0→P3，发现缺陷记录不改码）
- **P0 主流程**：页面加载（截图总览）、九节点渲染（节点名+状态徽章可见）、B 阶段手册 6 段全渲染、C 资产手册 16 卡全渲染、复制按钮点击 → 剪贴板反馈态出现
- **P1 交互反馈**：复制成功/失败反馈（按钮文案态 + live region）、告警条健康时隐藏、双主题切换（模拟 prefers-color-scheme 若工具支持，否则记录 SKIP）
- **P2 边界**：无注入数据时页面不白屏（degraded 通道）、超长资产 description 不溢出（overflow-wrap）、连点复制按钮不崩
- **P3 布局风格**：极简瑞士风格达成度（网格对齐/留白/字阶/扁平色/零装饰渐变）、对比度目测+DOM 交叉验证、触控区 ≥44px（DOM 量测）

## 交付
`test-reports/autopilot-work/FE-3/REPORT.md`：每测试点 = 截图证据（Read 工具回读）+ DOM 交叉验证 + PASS/FAIL；缺陷清单分级（P0 阻断/P1 功能/P2 视觉）；GUI 级复制验证结果（真剪贴板 or 环境不支持如实记录）。
**禁改**：webview/、scripts/、contracts/、plans/；禁 git。
