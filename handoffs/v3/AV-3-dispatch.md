# AV-3 派单 — Asset Eligibility Resolver v1（批 1 第二波 Step 1，v3.5 串行管线起步）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §v3.2/v3.4/v3.5 与 `handoffs/v3/write-faces-batch1.md`（runtime.mjs 已增补为你的写面）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘：①resolver 纯函数 ②CLI ③runtime 接线 ④Gate-2 hash 日志 ⑤探针 ⑥RESULTS。

## 任务 A：Asset Eligibility Resolver v1（`scripts/lib/activation.mjs` 内新增导出）
命名与契约（v3.5 裁定）：
```
输入：{ asset: "be-validator",                       // 主键（批 1 边界：name-based）
        requirements: ["openapi-validation"],        // 可选提示
        constraints: { language: "python" } }        // 可选提示
输出：{ selected_asset, eligible: true|false, reason: ["manifest match", ...] }  // 可审计资格判定
```
规则：
1. 读 `contracts/asset-manifest-v2.json`（AV-1 的 readManifest 接口）——manifest 缺失/坏 → eligible=false reason 含 CANDIDATE_INVALID（fail-closed）；
2. `when_not_to_use` 负向命中 → eligible=false，reason 引用命中条目；
3. `when_to_use` 正向命中 → reason 记"manifest match"；无命中不否决（理由=无负向、无正向依据，如实标注）；
4. `drop_pending:true && drop_allowed:false` → eligible=false；
5. 纯函数零 LLM 零网络，CLI 形态 `node scripts/eligible.mjs --asset <name> [--requirements a,b]`（新文件）打印 JSON。

## 任务 B：runtime 接线（Gate-2 + 资格门）
`scripts/lib/runtime.mjs` dispatch 路径最小接入（EX-1 能力门控段零改动）：
1. **Gate-2 hash 绑定**：dispatch 时读 manifest 并在 state/日志记 `manifest_sha256`（与 build 产物 hash 比对——不一致 → warning 具名，批 1 内先记账不阻断，AS-2 晋升时升级为硬门）；
2. **资格门**：dispatch 前过 resolver；eligible=false → mode=skipped + reason=INELIGIBLE_*（对齐 EX-1 CAPABILITY_MISSING 诚实降级模式），plan.warnings 汇总；
3. 无 manifest 时维持旧行为（向后兼容，与 preflight P6 同口径）。

## 自测（证据落 `test-reports/autopilot-work/AV-3/`）
1. 资格探针 ×4：正向命中（be-validator + openapi 类任务提示）eligible=true；负向命中（构造 when_not_to_use 场景）false 具名；drop_pending 资产 false；manifest 篡改（坏 JSON）false+CANDIDATE_INVALID；
2. Gate-2：dispatch 日志含 manifest_sha256 且 == `sha256(contracts/asset-manifest-v2.json)`（现值 f770140c…，重算比对）；
3. runtime 接线：skipped 路径 reason 具名 + 正常路径零行为变化（对照探针）；
4. 回归：regression 14 段 + preflight 7 项 + validate 0（三件全跑）。
5. RESULTS.md：逐项 + D-偏差。

## 白名单
scripts/lib/activation.mjs、scripts/lib/matrix.mjs（如需）、scripts/lib/runtime.mjs（仅 dispatch 接入点）、scripts/eligible.mjs（新建 CLI）、test-reports/autopilot-work/AV-3/。

## 禁止
改 scripts/manifest-build.mjs、contracts/、SKILL.md、commands/、webview/、plans/、其他 scripts/、vendor/；禁 git；禁跑 BFX/FE 历史回归目录。

## 验收要点（编排者 L2 将复核）
资格判定四态探针 + Gate-2 hash 绑定日志 + 诚实降级 + 三件回归全绿。