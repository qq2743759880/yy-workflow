# W2-2 RESULTS — Runtime + State Provenance Integration（Batch 3 Wave 2 Step 2，依赖 W2-1）

> 执行：L1 独立 agent（全新上下文）。派单：`handoffs/v3/W2-2-dispatch.md`；契约权威：`plans/W2-0-ground-truth-ingress-contract-20260927.md`（先读 §D.3/D.4/D.7，全文通读）。日期：2026-09-27。
> 状态：**四项自测 15 PASS / 0 FAIL + 回归三件全绿 + tt-journey 真 CLI smoke exit 0**；存在 6 项偏差/登记项（§F），不自称 DONE，交编排者 L2 复核。

## A. 写面（白名单内，零越界）

| 文件 | 动作 |
|---|---|
| `scripts/lib/runtime.mjs` | 最小透传 diff：**仅加 1 行语句 + 4 行注释**（CD-1 块之后、AV-3 段之前）。逐行 diff 见 `w2-2-runtime-diff.txt` |
| `scripts/lib/journey.mjs` | 唯一投影写点（原 :664 subtasks.push）追加三字段（D.7：null 也显式写）+ 2 行注释 |
| `test-reports/autopilot-work/W2-2/` | 探针/日志/diff/基线快照/本 RESULTS |

禁改清单（contracts/、scripts/orchestrator.mjs、scripts/lib/planner.mjs、scripts/lib/activation.mjs、prompt-composer、governance-skills/、webview/、SKILL.md、commands/、plans/、vendor/、其他 scripts/）零触碰；全程未执行任何 git 操作；仓库根零污染（无 .tt-state 生成，探针全部写面在本目录 `tmp/`，已实测确认）。

## B. 交付物（两处 diff，均加法式）

### B1. runtime.mjs 透传（契约 §F「runtime（subtask 透传+失败记忆）」的透传半边）

```js
// 插入点：dispatch() 内 CD-1 capability 块收口之后、AV-3 资格门段之前
if (capabilityEligibility) subtask.selectedAsset = capabilityEligibility.selected_asset;
```

- **透传确认（零改动实证）**：planner 产的 `capability`/`capabilitySource` 经 executePlan → runGroup → dispatch 为**同一对象引用**，runtime 全链无重建/无白名单字段拷贝，天然不丢（探针 P1e）；CD-1 解析成功后 `subtask.asset` 已被绑定为 resolver 产物，本行使 `selectedAsset` 与之双写（D.3 一致性）。
- **受保护段零触碰**：CD-1（capability dispatch 输入）、AV-3（资格门）、EX-1（能力门控）、recordFailureMemory（失败记忆）各段语义零改动——diff 文件可逐行复核（唯一逻辑差异即上述 1 行）。
- **legacy 零字段**：无 capability 时 `capabilityEligibility` 恒为 null → 该行不执行 → state.json 字节级不变（探针 P4 双向字节级实证）。

### B2. journey.mjs 投影（契约 §F「journey（投影三字段）」；D.7）

```js
subtasks.push({
  subtaskId: sub.id, asset: sub.asset ?? null, status: sub.status ?? 'unknown',
  capability: sub.capability ?? null, capabilitySource: sub.capabilitySource ?? null,
  selectedAsset: sub.selectedAsset ?? sub.asset ?? null,   // 缺席回落 asset（D.3：legacy = asset）
  displayStatus: memberDisplay, receipt: rcpt ? rcpt.path : null,
});
```

capability 行三字段落真实值；legacy/老 state 行 **null 也显式写入**（D.7 明文），`selectedAsset` 回落 `sub.asset`。全文件唯一 subtask 行写点（grep 实证），消费面（`assets.find(x => x.subtaskId === ...)` 等）按键取值，加法字段零破坏；webview journey 渲染面 grep 证实不消费 subtasks 行（无破坏面）。

## C. 四项自测逐项（探针 `w2-2-probe.mjs`，日志 `w2-2-probe.log`，结构化 `probe-results.json`；15 PASS / 0 FAIL）

### 自测 1 — capability 子任务 state.json 三字段在场（P1，PASS）
- P0 前置：真实 manifest（contracts/asset-manifest-v2.json，sha b0268798…）上 `security-audit` → resolver `{selected_asset:'security', eligible:true}`。
- 任务「对登录接口做安全审计」（W2-1 派生 security-audit）→ buildPlan 5 子任务**仅带两字段**（P1b：plan 期无 selectedAsset，符合 W2-1 D-W21-2 交接口）→ 经 live runtime executePlan + store.save 落 state.json。
- P1c：state 子任务全量在场 `capability:'security-audit'` / `capabilitySource:'derived'` / `selectedAsset:'security'===asset`（D.3 双写一致性）；raw 文件 grep 实证（:29/:30/:40）。
- P1d：`eligibility{capability, selected_asset, eligible, reason[]}` 在场（D.4 eligibilityReason 面；reason 含「capability match: 请求…→ manifest id security」可回查链）。
- P1e：透传零丢失（planner 两字段全链原样）。

### 自测 2 — resume 老 state（无字段）不崩溃（P2，PASS）
- 老式 state（T1 plan，零 capability 字段，1 done + 余 idle 模拟历史进度）→ 双份落盘 → `store.load`（JSON 全量反序列化）→ 复刻 resumePlan 最小面（done 保留、余者重跑）→ **新旧 runtime 均不崩溃**（P2b）。
- P2c：resume 后 `capability`/`selectedAsset` **不凭空出现**（D.5 行 8：老 state 走 legacy，不重派生、不改写历史）。
- P2d：resume 输出 state.json 新旧 runtime **字节级全等**（sha256 双方 `5e9241cd…`，2886 bytes）。

### 自测 3 — journey 投影三字段在场（P3，PASS）
- `journeyRead` 内联双 state 行（capability state + legacy state）mode:full：
- P3b：capability 行 5/5 三字段在场且与 state 一致（`security-audit`/`derived`/`security`）。
- P3c：legacy 行 3/3 三字段**显式在场**：`capability:null`、`capabilitySource:null`、`selectedAsset` 回落=asset（`implementation`）——D.7「null 也显式写入」达成（state 有 UI 也有的全链闭环，契约附.2 风险点消除）。
- P5 补充：`node scripts/tt-journey.mjs --workspace tmp/ws-cap` 真 CLI exit 0，正确从 capability state.json 推断渲染（`w2-2-cli-journey.log`）。

### 自测 4 — 向后兼容字节级（P4，PASS）
- 5 个无 capability 路由任务（数据库 schema 迁移/登录接口开发/前端页面重构/运维部署监控/知识库模型接入，**T1–T5 全簇覆盖 × 派生全 null**，W2-1 T4a 同款任务集）。
- 基线 = `baseline-runtime.snapshot.mjs`（**改造前** runtime.mjs 逐字快照，唯一差异 = import 行重写绝对 file:// URL，W2-1 同法；探针已验证可加载）。
- P4a：5/5 任务 state.json 新旧 runtime **字节级全等**（Buffer.equals + sha256 双录，探针 JSON 留痕）。
- P4b：legacy state 全文 **0 处** `capability`/`selectedAsset` 字样（零字段变化）。

## D. 回归三件（全绿，证据在本目录）

| 件 | 命令 | 结果 | 证据 |
|---|---|---|---|
| regression | `node scripts/regression-all.mjs` | **24 PASS / 0 FAIL**，exit 0 | regression-all.log |
| preflight | `node scripts/preflight.mjs` | **8 PASS / 0 FAIL / 0 SKIP**，exit 0 | preflight.log |
| validate | `node scripts/validate-structure.mjs` | **[OK] 结构校验通过 (0 项警告)**，exit 0 | validate.log |

## E. state.json 归因核验（派单前置事实的实测勘误，结论不变）

实测：state.json 的全量序列化点是 **`scripts/lib/store.mjs:7` `createStore().save`（`scripts/orchestrator.mjs:789 store.save(result.plan)` 调用）= `JSON.stringify(plan, null, 2)`**；派单所述 writeStateSummary（scripts/orchestrator.mjs:219）实写 `artifacts/<planId>/state-summary.json` **聚合摘要**（不含 subtask 行）。结论不受影响：**白名单外零改动**，subtask 新字段经 plan 全量序列化自动落 state.json（P1c 实证）；resume 经 `store.load` JSON 全量反序列化天然容忍缺字段（P2b/P2c 实证）；writeStateSummary 聚合面只读 `s.status/s.asset/s.recovery` 等既有可选字段，老 state 缺新字段不崩溃（同一容忍语义）。

## F. D-偏差/登记项

| # | 项 | 说明与处置 |
|---|---|---|
| D-W22-1 | 派单归因勘误（非缺陷） | state.json 全量写点 = store.save（store.mjs:7），非 writeStateSummary（详见 §E）。无需任何白名单外改动，探针实证 |
| D-W22-2 | 门跳早退路径不落 selectedAsset | capability 子任务被 CD-1/AV-3 门跳（INELIGIBLE_* / RESOLVER_INTERNAL_ERROR）时 dispatch 早退 return，不可达透传行（透传行置于受保护段之外，不碰段约束优先）。该形态 provenance 仍完整：`subtask.eligibility{capability, selected_asset, eligible, reason[]}` 在场（CD-1 既有），journey 投影 selectedAsset 回落 asset。若要求 skip 路径也双写，须在 CD-1 段内加行——留编排者裁定后接线 |
| D-W22-3 | D.4 `matchedKey` 未进 state/journey | W2-1 D-W21-2 同源遗留：planner subtask 不携带 matchedKey（planner.mjs 本单禁改），本派单任务清单（4 项）亦未列。`deriveCapability` 已返回 matchedKey（P1a 实证「安全审计」），后续批次可经 planner 附加或 eligibility.reason 回查 |
| D-W22-4 | journey 投影对 legacy 行为三键显式写 | D.7 明文「null 也显式写入」→ journey 投影对无 capability 任务新增三键（selectedAsset=asset 回落）。自测 4 的字节级兼容**限定 state.json**（派单原文），journey 属投影面、D.7 优先；消费面按键取值 + webview 不读 subtasks 行（grep 实证），无破坏面 |
| D-W22-5 | 探针替身声明（W2-1 D-W21-5 同风格） | (a) planner manifest 用 CATALOG_IDS 合成（planner 只读 entries[].name）；dispatch 资格门用**真实** contracts/asset-manifest-v2.json（P0 预检 eligible）；(b) adapter 经 B5 DI 注入 fake（不碰真实 vendor adapter）；gate 用官方 `TT_GATE_MODE=warn` 档（fake 零产物）。仅影响执行替身，不影响被测 provenance/兼容断言 |
| D-W22-6 | 契约 §F 的 prompt-composer 写面未在本派单白名单 | 契约 §F 把 prompt-composer.mjs（读 selectedAsset 回退 asset）列为 W2-2 写面，但本派单白名单仅 runtime/journey/W2-2 目录——零触碰。现状即正确工作：capability 模式下 `subtask.asset` 已被 CD-1 绑定为 resolver 产物，composer 读 asset 行为正确；「显式 selectedAsset 回退」留编排者扩白名单后接线 |
| 观察项 O-1 | CD-1 既有语义（非本单引入）：plan 级单 capability → 全部子任务绑定为同一映射 asset | P1 实测 security-audit 计划 5 子任务 asset 全部解析为 security（原 asset 提示 implementation/sdlc/review/be-validator 被覆盖，dispatch 日志留痕）。这是 W2-1（plan 级 capability）× CD-1（capability 为准）的既有组合语义，本轮零改动；子任务粒度差异化路由属后续批次，供 L2 知悉 |

## G. 证据文件清单（本目录）

`w2-2-probe.mjs`（探针源，零凭据/零网络/零 SQL）、`w2-2-probe.log`、`probe-results.json`（15 断言结构化留痕）、`baseline-runtime.snapshot.mjs`（改造前 runtime 逐字快照）、`w2-2-runtime-diff.txt`（逐行 diff，唯一逻辑差异=透传 1 行）、`w2-2-cli-journey.log`（真 CLI smoke）、`regression-all.log`、`preflight.log`、`validate.log`、`tmp/`（探针工作区：capability state 与新旧 runtime 成对 state 字节比对现场）、本 `RESULTS.md`。
