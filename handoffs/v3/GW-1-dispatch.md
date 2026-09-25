# GW-1 派单 — 治理层三技能运行时接线（批 1 第三波，与 AS-1 并行，写面不相交）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `governance-skills/VENDORED.md` + `plans/superpowers-selection-v1.json`（Owner 圈选记录：3 技能/绑定阶段/激活时机）。完成后交付证据，不自称 DONE。

## 任务：把 3 个治理技能从"入库"接到"被消费"

Owner 圈选的绑定期望：
- `verification-before-completion` → **stage 8（verification）**，激活时机=agent 宣称完成之前（before_final_receipt）
- `systematic-debugging` → **failure_recovery**，激活时机=gate_failed / regression_failed / migration_failed
- `test-driven-development` → **stage 7（implementation）**，激活时机=实现类子任务派单时

### 实现（最小接线，禁过度设计）
1. 新建 `scripts/lib/governance.mjs`：`governanceFor(stage, eventType)` 纯函数——读 `governance-skills/<skill>/SKILL.md` 正文（带 5KB 截断上限防 prompt 膨胀），返回 `{skill, body, binding}` 或 null；零 LLM 零网络。
2. **接线点 A（stage 7/8 派单 brief）**：orchestrator 组装 executor brief 时，implementation 类子任务 brief 尾部追加 TDD skill 正文（标注 `--- governance: test-driven-development ---`），verification 类（stage 8/review-gate 前）追加 verification-before-completion 正文。落点=`scripts/orchestrator.mjs` brief 组装段（先读代码定位，最小 diff）。
3. **接线点 B（失败路径）**：`scripts/lib/runtime.mjs` gate/adapter 失败分支（CAPABILITY_MISSING/INELIGIBLE_*/OUTPUT_INVALID 等 error 路径）日志追加一行 `GOVERNANCE: systematic-debugging 正文见 governance-skills/systematic-debugging/SKILL.md`（失败时不注入全文防 prompt 爆炸——只指路）。
4. **截断护栏**：注入正文超 5KB 截断并标注 `[truncated]`；governance-skills 缺失时静默跳过（向后兼容）。

### 自测（探针输出存文件，落 `test-reports/autopilot-work/GW-1/`）
1. stage 7 implementation 子任务 brief 含 TDD 正文（截断护栏实测：临时加 6KB 文件验证截断标注）；
2. stage 8 子任务 brief 含 verification-before-completion 正文；
3. runtime 失败路径日志含 GOVERNANCE 指路行；
4. governance-skills 目录临时改名 → 全部接线点静默跳过零崩溃（向后兼容）；
5. 回归三件（regression 14/preflight 8/validate 0）+ manifest hash 零变化（governance 层不进资产注册表——Owner 裁定）。

## 白名单
scripts/lib/governance.mjs（新建）、scripts/orchestrator.mjs（brief 组装段最小 diff）、scripts/lib/runtime.mjs（失败分支日志行）、test-reports/autopilot-work/GW-1/。

## 禁止
改 governance-skills/ 本体、manifest-build.mjs、contracts/、matrix.mjs、eligible.mjs、SKILL.md、commands/、webview/、plans/、其他 scripts/（runtime.mjs 仅失败分支日志行）；禁 git。

## 验收要点
三技能按阶段真实注入 brief（探针+存文件）/失败路径指路/向后兼容/回归三件全绿/manifest hash 零变化。