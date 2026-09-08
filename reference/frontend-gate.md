# 附 A7：前端页面设计执行流程（来源：SKILL.md §6.0~§6.6，自包含可读）

> 本文件是 YY 前端页面任务（HTML 原型 gate）的权威说明（原 SKILL.md §6 迁移至此）。仅前端页面类任务时读取。

## 6.0 为什么必须走 HTML 原型

先出 HTML 原型 → 用户签收 → 才写 React：改动只在静态文件，返工成本低一个量级。**HTML 原型 = 用户签收设计后再投入实现成本的闸门。**

## 6.1 流程总览（硬 gate，顺序不可跳）

```
0 风格定调（项目级前置）：问风格 → 无想法引导"对标品类" → 实时搜索主流/小众/获奖站点 → 出 N 个风格 Prompt → 用户选定 → 冻结
1 页面设计规范：有就用 doc-frontend-design-spec（缺失页先补规范）
2 产出 HTML 原型：纯 HTML（全交互态 + 内联样式 + 模拟数据），不写框架，让用户看效果
3 用户审核 ← 【Gate A：用户审美签收】（主观）
4 AI 按 SOP 返工改 HTML（§6.2，每步接真实工具调用）
5 循环 3↔4 直到用户签收 APPROVED ← 【Gate A 通过】（看板态 `HTML_APPROVED`）
6 冻结设计 token + 布局快照：产出 `design-tokens.json` + 原型各视口截图基线（FR-2，来自 frontend-design）
7 原型→实现一致性门 ← 【PARITY_CHECK：token 冻结 + 接近度比对】（客观机验）
8 才允许写框架组件（fe-implementer，按冻结 token 实现，禁硬编码色值）
9 测试 + 视觉验证（fe-tester + playwright 截图矩阵）← 【Gate B：技术验收】（客观机验）
```

**双 gate 区分**：Gate A（用户审美签收，HTML 阶段，主观，看板态 `HTML_APPROVED`）；Gate B（技术验收，组件阶段，客观机验，看板态 `REACT_DONE`）。**两个 gate 都过才真正完成**。

**原型→实现一致性门（PARITY_CHECK，FR-2，Gate A 与 Gate B 之间）**：Gate A APPROVED 时冻结 `design-tokens.json` + 截图基线；React 实现完成、进 Gate B 前跑 `$SKILL_DIR/scripts/prototype-parity-check.mjs --proto <原型.html> --impl <实现路径> [--threshold 0.03]`：token 差异须为 0；截图接近度（Playwright 可用时）≥ 1-threshold，不可用如实标 `SCREENSHOT_UNAVAILABLE`（不伪造）。不一致 → 返工对齐（`FIX-R{n}` 回读 AUDIT LOG），直至 tokenDiff=0 且接近度达标。

## 6.2 HTML 返工设计调用链 SOP（每步接真实工具调用）

调用链（增强资产可用时）：定方向 → 发散（≥3 个 axis 互斥变体）→ 配色（60/30/10 + 对比度）→ 打磨（12 维 checklist）→ **视觉验证（Playwright 截图多视口 + 读图真渲染 + grep hex）** → 独立审查（audit 五维 + critique UX）→ 用户签收 → 组件实现。
- **增强资产缺失时降级**：用通用设计原则（§6.3 反 AI Slop 清单 + 四大基本原则）替代具名 skill，但**视觉验证与审查两步不可省**。
- **返工类型判定**：布局/结构 → 发散；色彩 → 配色；细节/对齐 → 打磨；整体"不像设计" → 全链。
- **AUDIT LOG 状态机**：HTML 头部注释 `DRAFT → SUBMITTED → REVISING → APPROVED/REJECTED`；返工标记 `<!-- FIX-R{n}-{序号} -->`。

## 6.3 AI Slop 红线（一票否决，任一命中即返工）

1. 深色底+霓虹强调 / 紫-蓝渐变 2. 渐变文字 3. 玻璃拟态滥用 4. Hero 大数字指标模板 5. 千篇一律图标+标题+正文卡片网格 6. 通用字体（Inter/Roboto/Arial） 7. 纯黑/纯白/纯灰 8. 灰字压彩色底 9. 弹跳/弹性缓动 10. 动画 layout 属性（应只动 transform/opacity） 11. 圆角+单侧粗彩边 12. 装饰性 sparkline。

**可自动校验（Gate B 必查）**：硬编码 hex=0 / 通用字体=0 / 纯黑白=0 / 弹性缓动=0 / layout 动画=0（grep 机验）；其余主观项保留人工 review。

## 6.4 失败模式与止损

| 失败模式 | 止损 |
|---|---|
| 变体趋同（3 稿只是换色） | 重跑发散，强制 axis 命名互斥 |
| 过度打磨（功能未完成就 polish） | 先功能完整，polish 是最后一步 |
| 截图骗人（只看代码不看渲染） | 强制读图真渲染 |
| 讨好式批判（审查全 PASS） | 换视角从 UX 重审，诚实判 AI Slop |
| 返工失忆（重复上轮已改问题） | 先读 AUDIT LOG 历史轮次 |
| 猜色翻车 | 色彩决策明确澄清，禁止猜 |

## 6.5 强制要求

- README 索引列：风格定调 gate + HTML 审核流 + 设计规范 + 看板 HTML 审核态（`HTML_DRAFT/SUBMITTED/REVISING/APPROVED/PARITY_CHECK/REACT_DONE`）。
- 硬 gate：没有设计规范 → 先补规范再产出；**未 APPROVED → 不派组件任务**；PARITY_CHECK 未过 → 不得进入 Gate B。开工 prompt 硬性守则含：`未收到 APPROVED 前不得进入框架实现`。
- 视觉回归（FR-6）：前端任务完成、进入 Gate B 前必跑 `node $SKILL_DIR/scripts/visual-regression.mjs`（L0 像素回归 + L1 VLM 语义抽样），报告并入验收；L0 FAIL → 返工，L0_NOT_AVAILABLE → 如实标注（L1 照常），不伪造 PASS。
- 效果图数据用**真实数据**（贴近真实数量），禁止空数据/MOCK 冒充。

## 6.6 资产分级明细（增强资产，均可选）

| 级别 | 资产 | 用途 | 缺失降级 |
|------|------|------|---------|
| 核心（随包） | `$SKILL_DIR/vendor/dev-planner/dev-planner.md`、`$SKILL_DIR/templates/*` | 拆任务/产物模板 | — |
| 增强（随包） | frontend-design、planning（簇） | 设计系统生成/品味护栏/需求挖掘 | 内置 `$SKILL_DIR/vendor/<name>/SKILL.md`，缺失走通用步骤（`reference/documentation.md` / §6.2） |
| 增强（随包） | agent-research、agent-vision-toolkit、skill-sentinel | 调研/视觉质检/第三方 skill 安全扫描 | 内置 `$SKILL_DIR/vendor/<name>/SKILL.md`，跳过该环节或人工替代 |
| 外部（引用） | TTHP 协议包（handoff） | 任务交接协议 | 契约冻结退化为文件+人工核对 |

> 引用任何增强资产前先探测存在性；不引用不存在的资产（`reference/asset-integration.md`）。