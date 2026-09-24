# AV-3 RESULTS — Asset Eligibility Resolver v1（批 1 第二波 Step 1，v3.5 串行管线起步）

- 派单：`handoffs/v3/AV-3-dispatch.md`；设计缘由：`plans/execution-plan-v3-20260923.md` §v3.2/v3.4/v3.5
- 执行：AV-3 L1 独立 agent，2026-09-24；工作区 `D:\.ai-hub\skills\yy`
- 状态：**交付待 L2 复核（不自称 DONE）**

## 1. 交付物

| 交付物 | 位置 | 说明 |
|---|---|---|
| resolver 纯函数 | `scripts/lib/activation.mjs`（新增导出 `resolveAssetEligibility`、`ASSET_MANIFEST_V2_PATH`） | 输出 `{selected_asset, eligible, reason[]}`（v3.4 形态）；fail-closed 码以 token 内嵌 reason 字符串（CANDIDATE_INVALID / ASSET_NOT_FOUND / INELIGIBLE_WHEN_NOT_TO_USE / INELIGIBLE_DROP_PENDING） |
| CLI | `scripts/eligible.mjs`（新建） | 见 §2 |
| runtime 接线 | `scripts/lib/runtime.mjs` dispatch 头部 + executePlan 汇总段 | 资格门 + Gate-2 hash 绑定；EX-1 能力门控段逐字零改动 |
| 探针证据 | 本目录 `out-probe-results.json` / `run-probes.mjs` / `out-preflight.txt` / `out-regression-all.txt` / `out-validate.txt` | 21/21 探针 PASS |

## 2. resolver CLI 用法

```
node scripts/eligible.mjs --asset <name> [--requirements a,b,c] [--constraints k=v,k2=v2] [--manifest <path>]
```

- `--asset` 必填（name-based 主键，批 1 边界 v3.2 第三次确认）；`--requirements`/`--constraints` 可选提示；`--manifest` 仅探针用（覆盖读面，禁指仓库真产物做写——本 CLI 零写入）。
- 输出 JSON 到 stdout（`{selected_asset, eligible, reason[]}`）；exit 0=判定已产出（eligible=false 也是正常结果）、2=用法错误、1=判定实现异常。
- 判定规则（序号=判定序，详见 activation.mjs 头注）：①manifest 缺失/坏 → false+CANDIDATE_INVALID（AV-1 `readManifest` 接口）②when_not_to_use 负向命中 → false 具名引用条目 ③when_to_use 正向命中 → reason 记 `manifest match`，无命中不否决（如实标注）④`drop_pending:true && drop_allowed:false` → false ⑤纯函数零 LLM 零网络（提示与 manifest 行文本的确定性子串匹配，token 切分 CJK 连续段 + ASCII 词段 + 连字符子词）。

## 3. 四态探针（run-probes.mjs A1-A5/B1-B5，21/21 PASS）

| 探针 | 输入 | 期望 | 实测 |
|---|---|---|---|
| A1/B1 正向命中 | be-validator + `openapi-validation` | eligible=true，reason 含 manifest match | PASS（token「openapi」命中 when_to_use「…自动生成 OpenAPI 3.1 规格…」） |
| A2/B2 负向命中（构造场景） | be-validator + `纯静态页面` | false，具名引用命中条目 | PASS（INELIGIBLE_WHEN_NOT_TO_USE：「无后端接口面的纯静态页面/文档任务」） |
| A3/B3 drop_pending | 临时副本 be-validator 行改 `drop_pending:true, drop_allowed:false` | false + INELIGIBLE_DROP_PENDING | PASS |
| A4/B4 manifest 篡改 | 临时坏 JSON 文件 | false + CANDIDATE_INVALID | PASS |
| A5 附加 | 不在 manifest 的 asset | false + ASSET_NOT_FOUND | PASS |
| B5 附加 | CLI 缺 --asset | exit 2 + stderr 具名 | PASS |

动作登记（按派单允许口径）：现 16 行 manifest 无「when_not_to_use 实际负向内容命中场景」，负向探针以**真实 manifest 行的负向条目原文 + 构造提示串**实现（A2），未改仓库真产物；drop_pending 与坏 JSON 场景用本目录 `tmp/` 临时副本（探针结束保留供 L2 复验，`tmp/` 不入 contracts/）。

## 4. Gate-2 hash 绑定证明（C1-C3）

- C1：重算 `sha256(contracts/asset-manifest-v2.json)` = `f770140ca4bc0e458a7eaa74b21a3956e45e34112a1c24132337a27e849a3360` == AV-2 build 产物现值（16 行）。
- C2：dispatch 时读 manifest 并记账——`ctx.set('manifest_sha256', …)` + 日志行 `Gate-2 manifest_sha256=f770140c… (contracts/asset-manifest-v2.json)`，与重算值相等（探针断言）。
- C3：不一致路径——注入期望值不匹配 → 日志具名 `MANIFEST_SHA256_MISMATCH: manifest_sha256=… != 期望 …（Gate-2 批 1 记账不阻断；AS-2 晋升时升级硬门）`，dispatch 继续执行不阻断（软门），探针断言 warning 在场且子任务照常 done。
- 期望值来源：`opts.manifestExpectedSha256` 或环境变量 `YY_MANIFEST_EXPECTED_SHA256`（不写死 hash 进代码——产物再构建后由调用方/编排者给期望值；批 1 内默认只记账不比对）。

## 5. runtime 接线零回归证明（D1-D7）

- D1 资格门 skipped 路径：drop 副本 + be-validator → `{ok:true, skipped:true, error:'INELIGIBLE_DROP_PENDING'}`，subtask `mode=skipped`、`error` 具名、adapter 零执行（ran=0）——对齐 EX-1 CAPABILITY_MISSING 诚实降级模式。
- D2 ASSET_NOT_FOUND → `INELIGIBLE_ASSET_NOT_FOUND` 同形态。
- D3 正常路径零行为变化：真实 manifest + 正向提示 → resolver 通过，adapter 真执行 `done/exec`，与接线前基线一致。
- D4 无 manifest → 维持旧行为（与 preflight P6 同口径）：无 Gate-2 记账、无资格门日志、adapter 真执行 done（向后兼容）。
- D5 与 EX-1 共存：资格门在前、EX-1 能力门控段逐字零改动——资格门过后缺 `run_cmd` → `CAPABILITY_MISSING`/`mode=prompt` 行为与 EX-1 实测一致；且 `subtask.eligibility` 留痕资格判定。
- D6/D7 executePlan 汇总：INELIGIBLE_* 子任务 → `plan.warnings` 具名聚合（`资格门：1 个子任务未通过 asset eligibility resolver（be-validator:INELIGIBLE_DROP_PENDING）…`）+ `plan.degraded=true`；正常计划零资格门 warning。
- 资格判定留痕：`subtask.eligibility = {eligible, reason[]}`（additive 字段，不改变既有字段语义）。

## 6. 回归三件

| 件 | 命令 | 结果 |
|---|---|---|
| preflight 7 项 | `node scripts/preflight.mjs --owner AV-3` | **7 PASS / 0 FAIL / 0 SKIP**（P1 85 个 .mjs 语法全过；P2 零新增同名导出——存量 13 组 legacy WARN 为既有登记；P6 扫 16 行） |
| validate | `node scripts/validate-structure.mjs` | exit 0，0 项警告 |
| regression 14 段 | `node scripts/regression-all.mjs` | **14 PASS / 0 FAIL**（S1 validate-structure、S2 test-retry、S3 替换清单、S4 契约工作流 smoke、S5 宿主执行 smoke、S6 资产缓存、S7 review-gate、S8 资产消费证据 exec=8、S9 域声明、S10 token 量尺、S11 引用链、S12 kickoff 漂移门、S13 junction 4/4、S14 preflight invariants 7 项全过） |

## 7. D-偏差与登记

1. **D-AV3-1（微偏差，必要接线点）**：派单白名单写「runtime.mjs 仅 dispatch 接入点」。INELIGIBLE_* 的 `plan.warnings` 汇总落在 `executePlan` 收尾段（dispatch 同文件）。依据：EX-1 先例同构（其 ③汇总即在 executePlan，CAPABILITY_MISSING 同法），且派单任务 B 第 2 条明确要求「plan.warnings 汇总」——不在 executePlan 落点无法满足；EX-1 能力门控段与其余逻辑零改动。
2. **D-AV3-2（口径登记）**：资格门 skipped 路径经 runGroup 收尾后 `subtask.status` 会被置 `done`（runGroup 对 `ok:true` 结果的既有行为）——与 EX-1 CAPABILITY_MISSING 路径实测行为**完全一致**（EX-1 out-e2-state.json 同形态），本单按派单「对齐 EX-1 诚实降级模式」不另改 runGroup；诚实性由 `mode=skipped` + `error=INELIGIBLE_*` + `plan.warnings` 聚合 + `plan.degraded=true` 承载（plan.modes/degraded 口径与 EX-1 相同）。若 L2 认定 runGroup 需把 INELIGIBLE_* 纳入 skipped 终态列表，属一行改动，建议随 AS-2 晋升硬门化一并裁定。
3. **D-AV3-3（Gate-2 期望值来源）**：build 产物 hash 无持久化 receipt（manifest-build 仅 stdout 打印），runtime 的比对期望值走 `opts.manifestExpectedSha256`/`YY_MANIFEST_EXPECTED_SHA256` 注入而非写死常量；本单证明口径 = dispatch 记账值 == 重算值 == AV-2 RESULTS 登记值（f770140c…）。AS-2 晋升硬门化时期望值供给方式（receipt 文件 vs 编排者注入）待 L2/Owner 裁定。
4. **D-AV3-4（v1 匹配语义局限，如实声明）**：命中判定 = 提示 token 与 when_to_use/when_not_to_use 条目的大小写不敏感子串匹配（宽匹配，宁多报 reason 少漏报），无同义词/语义扩展（零 LLM 纪律）；CJK 长提示需与条目存在连续子串（如「纯静态页面」）。语义级匹配属批 2 capability 字段边界，不在本单扩权。
5. **D-AV3-5（CLI exit code）**：eligible=false 时 CLI exit 仍为 0（判定已产出即正常）；派单未规定退出码语义，如管线需要 `eligible=false → 非零` 请 L2 裁定后一行改。

## 8. 禁改面核查

未触碰：manifest-build.mjs、contracts/、SKILL.md、commands/、webview/、plans/、其他 scripts/、vendor/；未执行 git；未跑 BFX/FE 历史回归目录。改动文件全量：`scripts/lib/activation.mjs`、`scripts/lib/runtime.mjs`、`scripts/eligible.mjs`（新建）、`test-reports/autopilot-work/AV-3/*`。
