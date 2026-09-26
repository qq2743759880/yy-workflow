# PC-1 派单 — Prompt Compiler v1（批 2 第一波）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/batch2-dispatch-plan-20260926.md`（PC-1 定义与验收口径）+ `plans/execution-plan-v3-20260923.md` v3.1-v3.6（Prompt Composer 裁定史）+ `scripts/lib/governance.mjs`（治理注入现状——你的 composer 要兼容它）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘：①composer 骨架 ②六段模板 ③orchestrator 切换 ④探针 ⑤截断/降级护栏 ⑥RESULTS。探针输出存文件。

## 任务：`scripts/lib/prompt-composer.mjs`
1. **输入**：`{task, capability:{manifest 行三字段}, project_context, constraints}`（capability 为可选——无 manifest 行时降级为 legacy 资产正文注入，向后兼容）。
2. **输出六段 brief**（v3.1 裁定的 Role Compiler 结构）：
   - `# Role`：manifest.role/name（capability 命名）
   - `# Mission`：task 一句话 + when_to_use 摘要（为何选你）
   - `# Context`：project_context（workspace 现状/上一子任务产物引用）
   - `# Output Contract`：constraints 中的产出要求（文件路径/格式）
   - `# Constraints`：manifest.when_not_to_use + 全局红线（禁造接口/路径可移植/诚实降级）
   - `# Verification`：manifest.verification + verify_command（TK-1 executor_acceptance 口径）
3. **治理叠加（GV-2 兼容位）**：composer 提供 `governanceSection` 插槽——现有 GW-1 的治理节（TDD/verification）经此插槽进入而非尾巴拼接（GV-2 实施迁移，你先留插槽+兼容旧形态）。
4. **护栏**：单段 4KB 截断（复用 GW-1 截断语义）；manifest 缺失 → 降级 legacy brief（零崩溃）；确定性输出（同输入同 hash）。

## orchestrator 切换（最小 diff）
brief 组装处：manifest 行在场 → composer 六段；否则 legacy。探针必须证明：**两种模式产物均被 S8 锚点/内核词机验消费**（anchor/kernel 提取不受影响）。

## 自测（证据落 `test-reports/autopilot-work/PC-1/`）
1. 六段结构探针（be-validator capability 样例 → 六段齐 + when_not_to_use 进 Constraints + verification 进 Verification 段）；
2. 降级探针（无 manifest 行 → legacy brief 字节级兼容比对）；
3. 确定性：同输入两次构建 hash 一致；
4. S8 兼容：composer 产物过锚点+内核词机验（S8 同款提取逻辑实测命中）；
5. 截断护栏：6KB 段 → 4096B+[truncated]；
6. 回归三件（regression 24 项/preflight 8/validate 0）+ manifest hash 零变化。

## 白名单
scripts/lib/prompt-composer.mjs（新建）、scripts/orchestrator.mjs（brief 组装切换最小 diff）、test-reports/autopilot-work/PC-1/。

## 禁止
改 contracts/、governance-skills/、webview/、SKILL.md、commands/、plans/ 既有文件、其他 scripts/（governance.mjs/runtime.mjs/matrix.mjs/eligible.mjs——GV-2/CD-1 领地）、vendor/；禁 git。

## 验收要点（编排者 L2 将复核）
六段齐+降级兼容+确定性+S8 兼容+截断护栏+回归全绿+manifest 零归因。