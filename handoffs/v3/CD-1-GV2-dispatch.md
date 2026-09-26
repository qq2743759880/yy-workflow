# CD-1+GV-2 派单 — capability dispatch 完整形态 + 治理迁移 composer 管道（批 2 第二波，同写面单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/batch2-dispatch-plan-20260926.md`（CD-1/GV-2 定义与批 2 验收口径）+ `plans/execution-plan-v3-20260923.md` v3.2（capability dispatch 裁定）+ 现状代码：`scripts/lib/runtime.mjs`（dispatch/资格门/能力门控）、`scripts/lib/activation.mjs`（resolveAssetEligibility）、`scripts/lib/prompt-composer.mjs`（PC-1 交付）、`scripts/lib/governance.mjs`（GW-1 交付）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘：①CD-1 dispatch capability 输入 ②resolver 接 capability ③GV-2 composer 管道迁移 ④探针 ⑤回归 ⑥RESULTS。探针输出存文件（CD-1-GV2 目录）。

## 任务 CD-1：capability dispatch 完整形态
现状：dispatch 输入 asset name → 资格门 → adapter。目标（v3.2 裁定的最终形态）：
1. **dispatch 输入升级**：接受 `{capability, constraints}`（约束可选）——asset name 降为内部解析产物：capability → resolver（resolveAssetEligibility 扩展：按 manifest 行的 capability/when_to_use 匹配 capability 请求）→ 候选资产（可多个）→ **eligible 且未 drop 的最优候选**（选择依据可审计：reason 链记录"capability match + verification pass + 未 drop"）→ adapter；
2. **向后兼容**：asset name 输入仍全支持（现网零破坏）；capability 输入解析失败 → INELIGIBLE_* 具名（fail-closed 不猜）；
3. **审计性**：capability dispatch 的选择过程留痕（selected_asset/eligible/reason[] 进 subtask.eligibility）；
4. **探针**：`{capability:"openapi-validation"}` → be-validator 被选且 semgrep/spectral adapter 可达；同 capability 多候选场景（如两资产同 when_to_use）→ resolver 决策留痕；未知 capability → INELIGIBLE_CAPABILITY_UNKNOWN 具名。
实现约束：manifest 行的 capability 字段是自由文本（非受控词表）——匹配用**显式映射表**（capability 请求 → manifest id，声明在 activation.mjs 头注释，禁模糊语义匹配——v3.4 第 4 条"主键仍 asset name"的精神延续：受控映射优先，无映射 → INELIGIBLE）。

## 任务 GV-2：治理注入迁移 composer 管道
1. 治理节从"brief 尾巴拼接"（governPlanAssets）迁移为 composer 的 `governanceSection` 插槽输入——orchestrator brief 组装处：PC-1 六段 + governanceSection（stage/event 传入）合成最终 brief；
2. **systematic-debugging 升级**：失败路径从"指路行"升级为"下一次同类失败任务的 brief 注入 debugging 摘要（≤2KB）"（运行时记忆式消费——按 F-030 冻结绑定 gate_failed/regression_failed/migration_failed 事件）；
3. **向后兼容**：governPlanAssets 保留（kill-switch YY_PROMPT_COMPOSER=off 时回落旧拼接）；governance-skills 缺失静默跳过。

## 自测（证据落 `test-reports/autopilot-work/CD-1-GV2/`）
1. CD-1 探针 ×4：capability 命中 / 多候选决策留痕 / 未知 capability 拒绝 / asset name 向后兼容；
2. GV-2 探针：composer 管道治理节在场（六段+governance）+ kill-switch 回落旧拼接字节级比对 + debugging 摘要注入（构造失败后重派场景）；
3. 截断护栏：composer+governance 合成总长超限 → 治理节优先保完整、正文段截断（或登记策略）；
4. 回归三件（regression 24 项/preflight 8/validate 0）+ manifest hash 零变化 + audit-index selftest 68。

## 白名单
scripts/lib/runtime.mjs（dispatch capability 输入）、scripts/lib/activation.mjs（resolver 扩展+CAPABILITY_MAP）、scripts/lib/prompt-composer.mjs（governanceSection 实装）、scripts/lib/governance.mjs（debugging 摘要导出）、scripts/orchestrator.mjs（调用点最小 diff）、test-reports/autopilot-work/CD-1-GV2/。

## 禁止
改 contracts/、governance-skills/、webview/、SKILL.md、commands/、plans/ 既有文件、manifest-build.mjs、migration.mjs、matrix.mjs、其他 adapters、vendor/；禁 git。

## 验收要点（编排者 L2 将复核）
capability dispatch 真实可达（探针非自造 oracle——引 F-036 教训：判定必须调生产函数）+ 向后兼容零破坏 + 治理经 composer 管道 + debugging 摘要消费 + 回归全绿 + manifest 零归因。