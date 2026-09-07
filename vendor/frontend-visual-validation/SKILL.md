---
version: 1.0.0
name: frontend-visual-validation
description: Web 前端视觉验证闭环 — 启动 dev server、Playwright 截图、对照 tokens/规格审查、输出结构化视觉报告、驱动修正。触发：前端页面实现后需要真实浏览器视觉验收时。
---

# 前端视觉验证 Skill

本 Skill 指导如何在真实浏览器中验证 Web 前端页面的视觉效果，形成"截图 → 审查 → 修正 → 复测"闭环。**当前项目只覆盖 Web 前端**。

## 分层执行策略（token 受控，大型项目防爆炸）

> 全量截图送 VLM = 上千页 × 图像 token，不可扩展。改为两层：

| 层 | 方式 | token | 适用 |
|---|---|---|---|
| **L0 像素 diff 全量** | Playwright `toHaveScreenshot()` 像素基线比对（`@playwright/test` 原生，pixelmatch） | **零 LLM token**（纯像素比较） | 全量页面 × 视口，CI 自动回归，防视觉回归 |
| **L1 VLM 语义抽样** | Read 读图 + 语义审查（布局/遮挡/审美/无障碍） | 受控（仅 diff 影响页） | 只审 `node scripts/visual-diff-pages.mjs` 输出的 diff 影响页面 + 关键页 |

- **不替代**：像素 diff 抓不到语义问题（像素 pass ≠ 布局合理）；VLM 语义审查是唯一能判"像不像设计/有没有 AI slop"的层。
- **抽样规则**：L1 只审 `visual-diff-pages.mjs`（git diff 影响的前端文件）清单 + 每功能 ≥1 关键页；无 diff 时 L1 为空，靠 L0 像素回归兜底。
- **关键页例外**：用户指定或 spec 标 `visual-acceptance.md` 的关键页，即使无 diff 也进 L1。

## 使用时机

- 前端页面/组件实现并应用样式后
- 需要确认布局、颜色、字体、间距、状态呈现符合规格
- 需要视觉回归验收

## 前置

- 项目有前端工程（`package.json` + Vite 配置 + dev script）
- 可用浏览器（Playwright 已装，或可 `npx playwright`）
- 输入规格：`.claude/specs/frontend/{taskId}/` 下的 `frontend-spec.md` / `design-tokens.json` / `screen-map.md` / `visual-acceptance.md`

## 步骤

### 1. 启动应用
- 检测 dev script（`npm run dev` / `vite`）与端口（默认 5173）
- 记录 base URL
- 无法启动时输出明确"阻塞"报告，不伪造截图

### 2. 截图（Playwright）
- **L0 全量**：对每个关键页面按视口集合截像素基线（375 / 768 / 1024 / 1280 / 1440），`toHaveScreenshot()` 比对（基线只在规格改变时更新，不能为通过盲目覆盖）
- **L1 抽样**：先跑 `node scripts/visual-diff-pages.mjs --dir <repo>` 得 diff 影响页面清单，只对清单 + 关键页截语义审查图
- 关键交互后补截图（打开弹窗、下拉、错误提示）
- **主题/条件视图**：所有 L1 页面至少 1 张 dark 截图；核心页面补高对比与 200% 缩放，命名 `-dark` / `-hc` / `-200pct`
- 保存到 `test-reports/screenshots/{taskId}/{screen}-{viewport}.png`

### 3. 读取并审查（L1 语义层，token 受控）
- 用 Read 读取 **diff 影响页 + 关键页**的 PNG（看真实渲染，不能只看代码）
- 对照 tokens 检查：颜色来自 tokens（Grep 查硬编码色值）、字体、间距、圆角
- 检查布局：水平溢出、元素重叠、文本截断、空白失衡
- 检查状态：加载/空/错误/成功是否有明确视觉呈现
- 检查交互反馈：hover/focus/loading/disabled 可见
- dark / 高对比 / 200% 缩放下检查残留与裁切
- **L0 像素 diff 结果并入**：`toHaveScreenshot` 失败项列为"像素回归违背"（无需 VLM 复核，机器已判）

### 4. 输出报告（`test-reports/{taskId}-visual-report.md`）
分四类：
- **规格违背**（必须修正）
- **浏览器行为错误**（必须修正）
- **内容/文案**（建议修正）
- **主观建议**（不强制）

判定：PASS / FAIL，列出阻塞项。报告注明 L0 像素回归覆盖范围（全量 N 页）与 L1 语义抽样范围（diff M 页 + 关键页 K）。

### 5. 修正循环
- 只有"规格违背"和"浏览器行为错误"触发修正
- 修正后重新截图复测，验证已修复项
- L0 像素 diff 修正后重跑 `toHaveScreenshot` 确认绿；L1 语义修正后重读图复核

## 判定规则

- 无参考截图：规格驱动审查，注明"非像素级复刻"
- 不得为通过而伪造截图或报告
- 截图基线只在规格改变时更新，不能为通过盲目覆盖基线
- **token 纪律**：L1 只读 `visual-diff-pages.mjs` 清单 + 关键页；禁止全量截图全送 VLM

## 关键工具

- Playwright（`npx playwright` / Playwright MCP / `@playwright/test` 的 `toHaveScreenshot()`）
- `node scripts/visual-diff-pages.mjs`（diff 驱动抽样清单）
- 截图读取（Read 图片）
- 可选：pixelmatch

## 参考

截图到代码/视觉还原流程参考 `abi/screenshot-to-code`（MIT）的截图解析思想；浏览器自动化基础设施参考 `microsoft/playwright`；像素回归参考 `americanexpress/jest-image-snapshot`、`reg-viz/reg-suit`（分层内核对标）。