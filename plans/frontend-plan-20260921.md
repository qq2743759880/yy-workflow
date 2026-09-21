# 前端任务规划 — Journey Control Room 插件页（2026-09-21，v3 Owner 定稿版）

> 定位（Owner 2026-09-21 裁定）：**面向使用者的随行导航手册**——不是仪表盘，不是数据表。
> 三大功能：A 现状导航（journey）+ B 阶段手册（每阶段注入内容/配套资产/催办话术/重走 Prompt）
> + C 全 16 资产手册（清单+功能说明+强制点名话术）。纯只读 + 复制按钮。
> 技术栈：design-taste-frontend（taste-skill）主笔设计方向 + ui-ux-pro-max 出规则/审计 +
> web-gui-tester 出 GUI 盲测验收。skill-sentinel 体系内资产按需引用。

## 功能规格（Owner 三点定位 → 页面结构）

### A 现状导航（数据源：`window.__YY_JOURNEY__` 注入契约，字节锚定不变）

- 九节点 journey 进度（0→8，含回跳层）：每节点名 + 状态徽章
- 状态语义（render-core.mjs 权威）：AUTHORIZED✅ / OBSERVED🔵 / INFERRED🟡 / STALE🟠 /
  PARTIAL⚫ / ERROR🔴；三负态 FAILED/SKIPPED/UNRESOLVED **永不渲染为成功**
- gate 卡（合并进节点）：当前卡在哪个 gate、该看什么、说什么才通过
- 冲突/降级告警条：数据源矛盾或缺数据源时顶部横幅（render-core conflictView/deriveJourneyView）

### B 阶段手册（构建期静态生成，零运行时依赖）

6 个阶段逐段（0 立项/1 需求/2 拆任务/3 契约/4 派单/5 批判）：
- 本阶段干什么（一句话）
- 会对 agent 注入什么（`commands/yy-N.md` 实际内容摘要）
- 配套资产：名字 + **功能一句话**
- **催办话术**（可复制按钮）：agent 没调资产时 owner 说什么，如
  "按阶段 2 纪律先走 dev-planner Step0 前提挑战"
- **重走等效 Prompt**（可复制按钮）：整个阶段重来的指令模板

### C 资产手册（构建期静态生成）

16 资产逐卡片：名字、一句话功能（从各 `vendor/<a>/SKILL.md` frontmatter description 提取）、
所属域簇（matrix CLUSTERS）、哪些阶段可能用到、**强制点名话术**（可复制）：
"请你现在读取并应用 vendor/planning 的方法论"

## 技术栈与产出约定

- **产出**：`webview/journey/index.html` + `webview/journey/styles.css`（Owner 新设计，取代
  旧 journey.css 基线）+ `webview/journey/content.js`（B/C 静态内容构建产物，由
  `scripts/build-guide-content.mjs` 从 commands/、reference/、vendor/ 提取生成——**构建脚本
  让内容可再生成**，手写会腐烂）
- **接口不变**：注入契约 `window.__YY_JOURNEY__` 与 render-core.mjs（93a7652b）、host-bridge.mjs
  （b02cfd65）是恢复 sha 锚，**不修改**；新页面消费 render-core 的导出（纯视图模型）
- **风格轴（Owner 2026-09-21 定稿：极简主义与瑞士风格 Minimalism & Swiss Style）**——Design Read 定稿：
  *"Reading this as: developer utility handbook, with Minimalism & Swiss Style language —
  grid-driven layout, generous whitespace, strong typographic hierarchy, flat semantic color
  accents, zero decoration"*；ui-ux-pro-max 已部署 ZCode（junction 验证 name: ui-ux-pro-max）、
  taste-skill 已部署（name: design-taste-frontend）——两个 skill 必须在 FE-1/FE-2 施工中被执行者
  显式调用（派单 brief 硬性要求：先跑 ui-ux-pro-max --domain ux/style/color 检索，再按 taste-skill
  §0 Design Read 流程声明后动工）；
  ui-ux-pro-max 铁律：对比 4.5:1、触控 44px、语义色 token、无 emoji 图标、reduced-motion
- 明暗主题：跟随 `prefers-color-scheme`（盲行工作区不可控环境，双主题都要可读）

## 任务分解（排进 autopilot 队列，严格串行 per-task）

| id | task | L1 白名单 | 验收（L2 分级复核） |
|---|---|---|---|
| FE-0 | `scripts/build-guide-content.mjs`：构建期内容提取（6 阶段注入摘要/资产/话术 + 16 资产卡片数据 → content.js） | scripts/build-guide-content.mjs + 产物 content.js | 16 资产全在、6 阶段全在、话术含可复制标记；重跑幂等 |
| FE-1 | 页面骨架 + 新 styles.css（A 现状导航：九节点+gate 卡+告警条；消费 render-core 导出；双主题；taste Design Read 声明 + ui-ux-pro-max 优先级 1-2 铁律逐条过） | webview/journey/{index.html,styles.css} | DOM 结构对 render-core 消费面；对比度/触控达标；注入契约不变 |
| FE-2 | B 阶段手册 + C 资产手册区块（消费 content.js；可复制按钮 = clipboard API，无写操作） | 同上 | 三大功能全渲染；复制按钮真可复制（GUI 盲测验证）；[WEB-GUI-TESTER 盲测] |
| FE-3 | web-gui-tester 全 GUI 盲测（黑盒：真实点击/截图+只读 DOM 交叉验证；P0 主流程→P1 反馈→P2 边界→P3 布局；**修复分离**：测试期不改码） | 无（只读测试） | P0-P3 全过 + 截图证据齐 + 缺陷清单；发现缺陷 → 修复环 → 复测 |
| FE-4 | 交付收口：README 更新 + release 目录刷新 + 部署验证 | webview/journey/README.md | 发布面审计零命中；GUI 复测抽样过 |

- FE-0/1/2 各 = 新执行者 + L2 复核者（分级复核：白名单含产品面走全量重执行）+ L3 登记
- FE-3 = web-gui-tester 专职 GUI 盲测（skill 自带"测试与修复分离"纪律，与 C-01 同构），
  编排者直接验收其报告
- FE-4 收口

## 依赖与排位

- FE-0 → FE-1 → FE-2 → FE-3 → FE-4（严格串行）
- **排位：前端 5 个 task 全部排在 autopilot 队列最前**；W1-W2 修复批（FIX-1..5）与
  W3 加固化批（HARD-1..3）整体顺延到 FE-4 之后；BW 盲行任务（BW-1..4）**只入队列不执行**，
  排最后（Owner 裁定：盲测任务先入队不跑）
- 20-task 容量重排：FE×5 + FIX×5 + HARD×3 + BW×4（只入队）+ 动态槽 + ACC/DOC = 20±动态

## 验收锚点（L2 复核者用）

- render-core.mjs = 93a7652b…、host-bridge.mjs = b02cfd65…（**逐字节不变**）
- 旧 index.html 基线 3af78072…（被新设计取代，异同在 RESULTS.md 声明）
- coverage-matrix.md（幸存）与 render-core 语义互验
- ui-ux-pro-max 优先级 1-2（无障碍/触控）硬指标进 L2 复核清单
