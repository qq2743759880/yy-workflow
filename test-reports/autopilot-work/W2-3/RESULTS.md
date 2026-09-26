# W2-3 RESULTS — Compatibility + Negative Matrix（S17 段，Batch 3 Wave 2 Step 3，依赖 W2-1+W2-2）

> 执行：L1 独立 agent（全新上下文）。派单：`handoffs/v3/W2-3-dispatch.md`；契约权威：`plans/W2-0-ground-truth-ingress-contract-20260927.md` §D.5 冲突语义九场景。日期：2026-09-27。
> 状态：**九场景 9/9 PASS + 注入反例 3/3 全抓 + 回归三件全绿**；存在 3 项偏差/替身登记（§F，核心为 D-W23-1），不自称 DONE，交编排者 L2 复核。

## A. 写面（白名单内，零越界）

| 文件 | 动作 |
|---|---|
| `scripts/regression-all.mjs` | 新增 S17 段（继 S16 后；文件头段表同步登记 S17 条目），九场景探针 + 判定函数 + 反例注入 + GOV 两键 + 证据落盘 |
| `test-reports/autopilot-work/W2-3/` | 证据（本 RESULTS + s17-nine-scenarios.json + 三件回归日志） |

禁改清单（planner/orchestrator/runtime/activation/capability-derivation/governance/其他任何 scripts/、contracts/、plans/、vendor/ 等）零触碰；全程未执行 git 操作；W2-1/W2-2 交付物只消费不改动。

## B. 探针架构（反 F-036：禁自造 oracle）

- **观察面全部走生产函数**：`buildPlan`（第 3 参 options）/ `route` / `deriveCapability` / `resolveCapabilityAsset` / `applyCapabilityToPlan` / `resolveAssetEligibility`（CAPABILITY_MAP 单点）/ `dispatch`（CD-1 capability 输入 + AV-3 资格门 + W2-2 selectedAsset 透传）/ `executePlan` / `store.load` / `governanceFor`（FROZEN_STAGE_EVENT_BINDINGS 两键）/ `governanceEventForFailureCode`。
- **判定函数只核对生产产物上的具名码/具名留痕**（INELIGIBLE_*、CAPABILITY_UNKNOWN、CAPABILITY_CLUSTER_MISMATCH、「capability match」解析链、override 日志），不复刻资格语义；「静默」是唯一被拒形态。
- **注入反例与真实观察共用同一判定函数**（证明非恒真 vacuous）：三种「静默」形态（场景 4 静默取一 / 场景 5 静默执行 / 场景 9 静默放行）必须被具名 FAIL。
- 替身声明（D-W23-3）：planner manifest 用 CATALOG_IDS 合成（planner 唯一读面 `entries[].name`）；dispatch 资格门用**真实** `contracts/asset-manifest-v2.json`（S17-7 drop 夹具=真实行集删 1 行落 os.tmpdir，判定仍由生产 resolver 作出）；adapter 经 B5 DI 注入 fake；`TT_GATE_MODE=warn` 仅段内生效、段末还原（不外溢 S1-S16）。

## C. 九场景矩阵（D.5 逐一机验；证据 `s17-nine-scenarios.json`）

| # | 场景（D.5） | 生产观察面 | 结果 | 要点 |
|---|---|---|---|---|
| 1 | capability only（合法）→ 解析+执行 | resolver + `dispatch({capability:'security-audit'})`（零 asset 输入） | PASS | security-audit→security；dispatch 解析绑定并执行 done；selectedAsset 双写；eligibility.reason 含「capability match」解析链 |
| 2 | asset only（legacy）→ 现行为零改动 | `dispatch({asset:'implementation'})`（无 capability） | PASS | name-based 全链 done；`capability`/`capabilitySource`/`selectedAsset` 三字段均不在场；eligibility 无 capability 键 |
| 3 | capability + matching asset → 允许双写 | `dispatch({asset:'security', capability:'security-audit'})` | PASS | asset===selectedAsset===security；eligibility.capability 留痕；零 override 痕（本就一致） |
| 4 | capability + conflicting asset → **不静默取一** | `dispatch({asset:'implementation', capability:'security-audit'})` | PASS（口径见 D-W23-1） | 生产现状 = capability 为准重绑定 implementation→security + 双重具名留痕（override 日志在场 + resolver 解析链在场）——可观测、可回查；**D.5 具名 skip 码 `CAPABILITY_ASSET_CONFLICT` 未实现**（缺口登记，非放宽） |
| 5 | unknown capability → 具名 skip | runtime `dispatch({capability:'no-such-capability'})` + planner `buildPlan(…,{capability:'no-such-capability'})` | PASS | runtime：`INELIGIBLE_CAPABILITY_UNKNOWN` 具名 skip（status=skipped/adapter=none，不静默 done）；planner：`CapabilityIngressError CAPABILITY_UNKNOWN` fail-closed throw |
| 6 | ineligible selected asset → 既有资格门 | `dispatch({capability:'security-audit', eligibilityRequirements:[真实 manifest when_not_to_use 首条]})` | PASS | capability 选中 security → 负向命中 → `INELIGIBLE_WHEN_NOT_TO_USE` 具名 skip（走既有 resolver 资格门，不静默派单） |
| 7 | dropped selected asset → 既有 drop 检查 | resolver 纯函数注入（`manifestRows` 删 review 行 / 置 drop_pending）+ runtime fixture manifest 缺行 | PASS | 行缺失 → runtime `INELIGIBLE_ASSET_NOT_FOUND` 具名 skip，resolver 同判；`drop_pending&&!drop_allowed` → `INELIGIBLE_DROP_PENDING`（DROP_ALLOWED 硬门） |
| 8 | old persisted plan（无 capability 字段）→ legacy 零改写 | `buildPlan('数据库 schema 迁移')`（派生 null）→ `store.save`→`store.load`→`executePlan` | PASS | 全链输出 0 处 `capability`/`selectedAsset` 字样——不重派生、不迁移改写历史 state（D.6 resume/replay 口径） |
| 9 | cluster×capability 不在同簇 → `CAPABILITY_CLUSTER_MISMATCH` | 派生轴 `buildPlan('前端页面功能拆解')` + 显式轴 `applyCapabilityToPlan(T1 plan, {capability:'feature-breakdown'})` | PASS | 双轴均 `CapabilityIngressError CAPABILITY_CLUSTER_MISMATCH` fail-closed throw，不静默取一（plan 层 throw 严格于 subtask 级 skip，沿 W2-1 D-W21-3 口径，D-W23-2 复验） |

## D. 注入反例（自测 2：探针有牙，全部抓到具名 FAIL）

| # | 注入的「静默」形态 | 期望 | 结果 |
|---|---|---|---|
| CE-1 | 场景 4 静默取一：冲突 asset 被重绑定且零具名留痕（overrideLogged=false 且 reasonChained=false）——**派单点名的反例形态** | FAIL 具名 CAPABILITY_ASSET_CONFLICT | 抓到：`S17-4 CAPABILITY_ASSET_CONFLICT: 静默取一（冲突 asset 被取一且零具名留痕——D.5「不静默取一」明令禁止）` |
| CE-2 | 场景 5 unknown capability 静默 done（未具名 skip） | FAIL 具名 INELIGIBLE_CAPABILITY_UNKNOWN | 抓到 |
| CE-3 | 场景 9 簇失配静默放行（解析 asset 不在簇 candidates 仍照常产出） | FAIL 具名 CAPABILITY_CLUSTER_MISMATCH | 抓到 |

S17-CE 段：3/3 全抓（判定与真实观察共用同一函数，排除恒真 vacuous）。

## E. 回归三件（自测 3：全绿，计数如实登记）

| 件 | 命令 | 结果 | 证据 |
|---|---|---|---|
| regression | `node scripts/regression-all.mjs` | **35 PASS / 0 FAIL**，exit 0（S16 后新增 S17 段 11 节 = 9 场景 + CE + GOV；S13 junction 在场 4/4 PASS，无 SKIP） | regression-all.log |
| preflight | `node scripts/preflight.mjs --owner W2-3` | **8 PASS / 0 FAIL / 0 SKIP**，exit 0（P1 语法门 88 个 .mjs 全过，含改动后 regression-all.mjs） | preflight.log |
| validate | `node scripts/validate-structure.mjs` | **[OK] 结构校验通过 (0 项警告)**，exit 0 | validate.log |

## F. D-偏差/登记项

| # | 项 | 说明与处置 |
|---|---|---|
| D-W23-1 | **D.5 行 4 具名 skip 码 `CAPABILITY_ASSET_CONFLICT` 未实现**（scripts/ 全树 grep 0 命中，2026-09-27 实测） | 生产现状 = capability 为准重绑定 + 双重具名留痕（`subtask.eligibility.reason`「capability match」解析链 + dispatch override `logger.info`；W2-2 观察项 O-1 同源——plan 级单 capability × CD-1「capability 为准」的组合语义）。S17-4 判定口径 = **反「静默」**：具名 skip 或具名留痕其一在场即过，静默取一即具名 FAIL（CE-1 证明有牙）。skip 化需 `scripts/lib/runtime.mjs` CD-1 段写面（**本单白名单外**，runtime 仅 W2-2 透传一行已交付）→ 留编排者裁定后接线。W2-0 H.1 停单条件未触发（该码是**缺席**而非生产链误触发）。本判定不构成「为过测试放宽 fail-closed」：静默形态在判定中恒被拒 |
| D-W23-2 | D.5 行 9 生产实现为 plan 层 fail-closed throw（非 subtask 级 skip） | 沿 W2-1 D-W21-3 已登记口径复验：生成期无 subtask 终态语义，throw 严格于 skip（零静默）；同源校验保证规则表映射 asset 全 ∈ 簇，生产任务不可达 mismatch，探针内为注入式构造 |
| D-W23-3 | 探针替身声明 | 见 §B 末段；仅影响执行/夹具替身，被测判定全部由生产函数作出 |

## G. 证据文件清单（本目录）

`RESULTS.md`（本文件）、`s17-nine-scenarios.json`（九场景 + 反例 + GOV + 偏差结构化留痕，schema s17-nine-scenarios@1.0.0）、`regression-all.log`、`preflight.log`、`validate.log`。
（自测迭代用临时 smoke 脚手架已删除——S17 段本体即唯一判定源，防判定逻辑双头漂移。）
