# 附 A6：派单与验收（来源：SKILL.md §5.0~§5.6）

> 先消费/复核 Decision，草案不授权；V1 marker 不等于 V2 APPLIED/VERIFIED。见 `decision-interface.md`。
> 拆读：派单 §5.0~§5.1；验收 §5.2~§5.4；收尾 §5.5~§5.6。

## 5.0 架构与并行度分级（N 自适应）

```
主agent（编排者）── 1 会话（规划/调度/验收汇总/集成 gate）
 ├─ 测试agent A（域 A）── 1 会话（分派 + 独立验收）→ 开发A1/A2 各 1 会话
 └─ 测试agent B（域 B）── 1 会话（分派 + 独立验收）→ 开发B1/B2 各 1 会话
```

**并行度分级（不过拟合）**：简单→单线；中等→2 线；复杂→N 线（N=可用平台/会话数上限）。**N=1 单平台模式**：跳过并行派单，"跨平台切换返工"退化为"换子 agent / 换批判视角复验"；其余纪律不变。

## 5.1 依赖调度算法（契约先行流水线）

- 并行度受"可并行任务数"约束，不硬凑数；主 agent 每次下发前重算可并行集（动态）。
- **依赖二值化**：契约依赖 → 契约先行流水线；完成依赖（迁移/共享状态/schema）→ 严格等 DONE。
- **契约先行已代码化**：子任务带 `contractMode:'frozen'`；`runtime.mjs` 调度前校验冻结契约存在——缺失 → `CONTRACT_NOT_FROZEN` skip 且计划 `failed`。**契约 = 下游开工前置**（硬约束）。
- 三层防线：planner 写依赖 + 主 agent 依赖图判定 + 契约验收闸门；上游契约变更 → 下游退出 READY 待重验收。

## 5.2 回传机制（最少中转开销）

- 员工完工 → 按 `templates/completion-report.md` 写报告 → **只传文件路径引用，不复制内容** → 测试 agent 读报告验收。
- **验收必须独立实证，不采信报告**：git log / 数据库实测 / 真实 HTTP / 测试实跑 / grep 审计——报告每一项都要验收方复现。
- **验收即出下一任务 prompt（强制）**：每完成一个任务验收，必须同时生成并输出下一任务开工 prompt（双件套）。
- **跨平台切换返工循环**：同一 task 不过，不在原平台反复改——按"切平台→修→再测"推进直到通过；N=1 时切换子 agent/视角。
- 纪律：每任务完成必须等验收指令才能做下一任务；员工跳序/连做 → 核查后纠正看板 + 注入记忆 + 追加纪律。
- **资产调用硬约束**：开工 prompt 列**具名资产路径**；完工报告**必含「资产消费证据」段**；产物须含**资产锚点 + ≥1 内核词**（`assetConsumed` 机验）。未消费资产 = 验收不通过 → 返工。编排者用 `scripts/asset-call-rate.mjs` 测调用率。
- **完工前自检（critique 三视角）**：子 agent 交付前按 `vendor/review/SKILL.md` critique 内核过一遍自己的改动（交互态/边界/错误反馈三视角），发现问题先修再交。

## 5.3 测试 agent（验收调度员）

- 开发/测试 agent 的开工 prompt 都由**主 agent 唯一派生**（消除双源）；测试 agent 只做"验收调度"，不派生开工 prompt。
- **契约独立验收闭环**：下游解锁前必须经测试 agent 独立核验（L1/CDC）；状态机：`待验收 → 已验收(解锁) → 契约变更单 → 待重验 → 重验收/失效`。

## 5.4 集成验收 gate（主 agent 独占）

- **合并检查点（每次双域合并必跑）**：①changed-files 交集扫描 ②L2 冒烟 ③语义级冲突（同 schema/接口双改）。
- **gate 分层**：L0 合并检查点 → L1 契约 CDC → L2 集成测试 → L3 关键 E2E → L4 全量回归（仅里程碑）。
- **契约冻结机器校验**：`gate.mjs` 对契约文件做 hash 比对——被篡改 → `ContractViolationError` → **exit 4**。
- **契约级 cascade（C-1）**：契约缺失 → `CONTRACT_NOT_FROZEN` skip；下游 cascade skip（`DEP_CONTRACT_NOT_FROZEN`），计划 `failed`（exit 5）。
- **棕地契约模式**：`scripts/contract-reverse.mjs` 反推草案 → `--contract-draft`（兼容草案；仍须 packet 许可）→ 后端确认后 `--contract` 升级；差异用 `scripts/contract-discrepancy.mjs` 上浮。
- **一键回归/CI**：`node scripts/regression-all.mjs` 全量回归；`node scripts/ci.mjs` = validate + review-gate + plan-review + regression-all。
- **资产消费证据强化（D-1）**：带 `## Execution kernel` 的资产，产物须含**锚点 且 ≥1 内核词**（culori/semgrep 等）才计 `assetConsumed=true`；`regression-all` S8 断言。
- **可验证边界**：所有判定给可机验客观边界（依赖图边 / git diff 交集 / 退出码 / 契约 hash），禁止仅凭主观。
- **宿主 CLI 认证（真实教训）**：改用户代理配置前先备份、只经 env/CLI 参数接入、不写宿主配置——曾误改致 claude `Not logged in`。

## 5.5 产物落盘（引用传递，不复制内容）

| 产物 | 路径 | 谁写 |
|------|------|------|
| 完工报告 / 验收报告 | `test-reports/taskNN-{completion,fe-tester}-report.md`（`$PROJECT_ROOT/.ai-hub/`） | 开发 / 测试 agent |
| 技术批判 / 优化方案 | `plans/tasks/taskNN-{技术批判,优化修改方案}.md` | 测试 agent |
| 契约 / 执行报告 / 指令包 | `contracts/<planId>.json`、`artifacts/report-<planId>.md`、`artifacts/<subtaskId>/brief.md` | orchestrator |

> 均落 `--workspace`，gitignore 不入库；每层只传文件路径引用（开工 prompt ≤200 token）。压缩规则：保留（架构决策/未解决 bug/契约/验收结论），上下文 70% 时压缩写断点。

## 5.6 批判滞后任务闭环（防"只批判不修复"）

1. 每条验收批判（P2+）产出时，必须在 `plans/critique-backlog-tracker.md` 登记：修复措施 + 落点任务 + 验收指标。
2. 滞后任务文档「批判承接」段引用 tracker；开工 prompt「必读」含 tracker 路径。
3. 完工报告新增「批判承接核对」段；验收时逐条核对，未完成项标注 ❌ 不予 DONE。
4. **开工前拉取待优化执行项**：`node $SKILL_DIR/scripts/critique-backlog-next.mjs [--task "<关键词>"]` 输出待落地 C-xx 清单；任务命中某 C-xx → 完工报告批判承接核对段列完成证据，缺项 ❌ 不予 DONE；无重叠写"无承接项"。

## 5.7 Owner 缺席代推进纪律（escape hatch）

1. 决策点问一次（不复述等待）；无响应 → 取保守推荐默认值推进。
2. 代签决策标注 `[待确认 owner]`；gate 记「代推进」，不冒充 owner 签收（不写 APPROVED）。
3. 白话版补审页（概念/前提 plain 版）留给 owner，恢复在场后补审。
4. 冻结契约变更不走代签，登记变更单待 Owner 批；唯一例外：向后兼容且不违约的数据正确性修复可先行并留痕待追认。
