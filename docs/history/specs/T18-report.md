# T18 报告 — TT 版本迭代「owner 可驾驶」正式 PRD 撰写

- 日期：2026-09-07
- 执行方：TT 工作流派出的 PRD 撰写子 agent（单会话，未调用外部子 agent；方法论依据 `docs/history/specs/` 既有 PRD 范式 + T17 调研报告，属编排提示词完成，无新资产消费）
- 产出：`docs/TT-OWNER-UX-PRD.md`（v1.0，2026-09-07）

## 1. PRD 要点

| 项 | 内容 |
|---|---|
| 8 节结构 | 需求来源 / 设计对齐 / 源码实况核对 / FR 条目化 / 批判审查 / 状态标注 / 里程碑风险 / 修订记录 ✅ 全齐 |
| 需求基础 | §2.1 需求挖掘 gate 已完成（用户确认 5 痛点全流程体验类 + 上下文优化取「结合方案」：阶段命令注入摘要 + 状态外置按需读） |
| 设计对齐 | T17 调研结论直接落地：渐进披露三级模型（anthropics/skills）、斜杠命令形态（SuperClaude，6 个命令文件）、状态外置+最小化纪律（BMAD）；明确不借向量记忆/swarm/安装器/Python 依赖链 |
| 源码实况 | 全部相对路径 + 2.9.1 实测行号：orchestrator `writeStateSummary`（L165-229，收尾派生点）、summary-read 用法（L8-10）、guide 8 阶段落点（L29/48/63/77/96/109/127/139）、matrix.mjs T1-T5 preconditions（L1-6）、kickoff-prompt T4 具名清单（L31-41）、completion-report 消费证据段（L5-11）、store.mjs `.tt-state/`（L4）、SKILL.md §0b 八步（L30-42） |
| 诚实标注 | ✅/◐/⬜ 全标；实测确认 `--session` 现不存在（parseArgs L24 无此字段）、`commands/`、`tt-journey.mjs`、`templates/owner-review/` 均为待建物，未夸大为已有 |
| 约束遵守 | 不写本机绝对路径（PRD 内全部相对路径）；F4 定位为「建议+隔离+汇总」不自动派发（批判 C4 锁定）；零依赖不动摇 |

## 2. FR 数与 GWT

| FR | 名称 | 优先级 | GWT 条数 | 状态 |
|---|---|---|---|---|
| FR-1 | 阶段导航/进度图（journey.json + tt-journey.mjs + 防跳阶段） | 🔴 | 4 | ⬜ |
| FR-2 | 阶段化 Prompt 快捷注入（commands/ 6 文件，300-500 token 摘要+指针） | 🔴 | 4 | ⬜ |
| FR-3 | 报告白话化（templates/owner-review/ 5 份指引） | 🟡 | 3 | ⬜ |
| FR-4 | 多分支自动编排（拆分建议 + `--session` 隔离 + summary-read 汇总） | 🟡 | 4 | ⬜ |
| FR-5 | 资产指定透明化（全簇开工清单 + 域声明 + 按域展示） | 🟡 | 4 | ◐ |

合计：**5 FR / 19 GWT**。

## 3. 批判审查

5 条，全部含真实 URL（取自 T17 的 2026-09-07 GitHub API 实时核验数据）：

1. C1 commands 摘要双源漂移风险 → validate 漂移门（须含 guide 具名章节指针行）
2. C2 命令爆炸与安装器覆辙（SuperClaude 30 命令 + pipx 跳票教训）→ 写死 6 个命令上限
3. C3 journey 复述内容反成上下文负担（BMAD "smaller or equal" 纪律）→ 只记三字段
4. C4 多分支编排 ≠ 重造 ruflo swarm → 只做建议+隔离+汇总，不自动派发
5. C5 拆分判据误报/漏报风险 → 判据保守（lane ≥3）+ 建议不自动执行 + 复用 L0 交集检查

## 4. 优先级与里程碑

- 优先级：🔴 F1+F2（导航与注入）→ 🟡 F3+F5（可读化与透明化）→ 🟡 F4（多分支编排）
- 里程碑：M1（F1+F2）/ M2（F3+F5）/ M3（F4），每个出口条件均含回归 8/8 + validate 0
- 改造点：11 项（新增 3 类：tt-journey.mjs、commands/ 6 文件、owner-review/ 5 模板；改 8 处，全部向后兼容）
- 风险：6 条（漂移/口径冲突/session 隔离遗漏/域声明形式化/合并冲突/无斜杠平台），全部给了可机验缓解

## 5. 诚实声明

- 本报告与 PRD 均未调用外部子 agent 与网络请求；竞品 stars/license 数据转引自 T17 报告（其已注明 GitHub API 实时核验），未在本轮重测。
- `regression-all` 8/8 在本轮基线复核中实跑通过（`结果: 8 PASS / 0 FAIL`），validate/泄露数为既有记录口径。
- 行号引用为撰写时 2.9.1 工作区实测；后续开发若文件变更须在实现报告中重新核对。
- FR-5 标 ◐：T4 专用段与消费证据段已存在，全簇泛化/域声明/按域分组待实现——未把已有部分夸大为全完成。

## 6. 修订记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | 初版：PRD 要点 / FR 5 条 19 GWT / 批判 5 条 / 优先级 M1-M3 / 诚实声明 |