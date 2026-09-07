# T15 Report — TT-FRONTEND-PRD 撰写

- 日期：2026-09-02
- 执行方：TT 工作流 PRD 撰写子 agent
- 任务：为 TT 下一阶段「前端设计质变 + 前后端联调」生成正式 PRD（8 步法）并出具本报告
- 交付物：`docs/TT-FRONTEND-PRD.md`（已存在，覆盖更新）+ 本报告

## PRD 要点摘要

1. **需求来源**：用户四目标全做（反 AI-slop / 产品级 UI / Awwwards 设计感 / 视觉回归自动化）+ 核心痛点（联调缺失最痛）+ 三块范围（质量门/视觉回归/联调）+ 优先级（联调>质量门>视觉回归>设计感）+ 落地形态（工作流内嵌）。
2. **设计对齐**：复用 frontend-design（taste-skill 50+ Pre-Flight）、frontend-visual-validation（L0+L1）、visual-diff-pages.mjs、portman --contract、planner 契约先行、§6 HTML gate 双 gate 语义；4 条设计决策（工作流内嵌/零外部服务/playwright 取舍/契约前置）。
3. **源码实况核对**：13 张实况表（SKILL.md §6.1/§6.3/§4、matrix.mjs T4_FRONTEND、planner.mjs buildPlan、orchestrator.mjs --contract、gate.mjs snapshot/diffContracts、runtime.mjs CONTRACT_NOT_FROZEN、portman.mjs、visual-diff-pages.mjs、taste-skill.md §14 Pre-Flight Check、frontend-design SKILL.md）→ 8 条改造点（FE-1~FE-8）。
4. **功能条目化**：FR-1 质量门🟡 / FR-2 原型一致性🟡 / FR-3 按契约实现🔴 / FR-4 契约变更检测🔴 / FR-5 联调测试🔴 / FR-6 视觉回归🟡 / FR-7 设计感⚪，每条含 GWT 验收 + 降级路径。
5. **批判审查**：4 条（C1 Percy/Chromatic vs 零外部服务、C2 契约先行消费深度、C3 mock vs 真实后端分界、C4 Playwright 依赖与零依赖原则取舍），均带真实 URL，结论回灌 §2/§4。
6. **状态标注**：✅ 6 项（HTML gate/AI Slop 纪律/资产消费证据/视觉验证基础/契约机制/契约先行），◐ 5 项（FR-1/FR-3/FR-4/FR-6/FR-7），⬜ 3 项（FR-2/FR-5/FR-1 机验脚本化）。
7. **里程碑/风险/验收**：M1 质量门+原型一致性、M2 联调、M3 视觉回归；5 条风险（Playwright 依赖/契约可用性/联调 flaky/机验误杀/契约变更频繁）；验收=回归 8/8 + GWT + 可移植性 0 泄露 + 诚实门。
8. **修订记录**：v1.0 2026-09-01 初版。

## 节数统计

8 节齐全（需求来源 / 设计对齐 / 源码实况核对 / 功能条目化 / 批判审查 / 状态标注 / 里程碑风险验收 / 修订记录）。

## 批判条数

**4 条**（≥3 达标），每条含竞品对标 + 证据 URL（Percy/Chromatic/Playwright/openapi-generator/testcontainers/portman）。

## 优先级排序

联调（FR-3/4/5 🔴）> 质量门（FR-1/2 🟡）> 视觉回归（FR-6 🟡）> 设计感（FR-7 ⚪）

## 验收对照

- [x] `docs/TT-FRONTEND-PRD.md` 存在，8 节齐全
- [x] FR-1～FR-7 各含 GWT 验收（Given/When/Then 格式）
- [x] 批判审查 ≥3 条（实为 4 条）且含真实 URL
- [x] 本机绝对路径 0 泄露：PRD 与报告均使用相对路径，未出现盘符前缀、用户目录或用户名
- [x] 诚实标注：✅/◐/⬜ 三态均如实；明确标注「联调测试⬜」「机验脚本化⬜」「设计感⚪下期」

## 诚实声明

- 本任务为文档层交付：仅更新 1 个文档文件（`docs/TT-FRONTEND-PRD.md`）+ 新增本报告，未改动任何 scripts/、vendor/、SKILL.md、frontmatter/version。
- 未运行 `node scripts/regression-all.mjs`（本次无内核改动，不适用）；PRD 中引用的行号/字段经只读源码核对，回归基线 8/8 为任务派单给定已核实事实。
- 所有 PRD 内容基于用户确认的四目标/三块范围/优先级，未超出已确认范围。