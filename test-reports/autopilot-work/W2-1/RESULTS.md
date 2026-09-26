# W2-1 RESULTS — Planner Capability Production（Batch 3 Wave 2 Step 1）

> 执行：L1 独立 agent（全新上下文）。派单：`handoffs/v3/W2-1-dispatch.md`；契约权威：`plans/W2-0-ground-truth-ingress-contract-20260927.md`（§D.1/D.2/D.4/D.5 + 附.1/附.2）。日期：2026-09-27。
> 状态：**六项自测全 PASS + 回归三件全绿 + audit-index selftest 68/68**；存在 6 项偏差登记（§F），不自称 DONE，交编排者 L2 复核。

## A. 写面（白名单内，零越界）

| 文件 | 动作 |
|---|---|
| `scripts/lib/capability-derivation.mjs` | 新建（派生规则表 + 纯函数 + 同源校验断言导出） |
| `scripts/lib/planner.mjs` | buildPlan 最小 diff（+options 第三参、守卫、加法字段） |
| `scripts/lib/orchestrator.mjs` | parseArgs `--capability` + KNOWN 集合同步 + validateOpts CAPABILITY_UNKNOWN + `applyCapabilityToPlan` plan 后处理导出 |
| `scripts/lib/activation.mjs` | 仅新增导出 `derivationRulesConsistent()`（动态 import 防静态环；既有逻辑零改动） |
| `test-reports/autopilot-work/W2-1/` | 探针/日志/基线快照/本 RESULTS |

禁改清单（contracts/、runtime.mjs、activation 既有逻辑、prompt-composer、governance、migration、regression-all、webview、SKILL.md、commands/、plans/ 既有文件、vendor/、governance-skills/）零触碰；全程未执行 git 写操作。

## B. 交付物 1：派生规则表（`capability-derivation.mjs`）

`DERIVATION_RULES`（冻结，10 键全登记，表序=派生优先序；关键词为受控词表登记项，判定与 `route()` 同款 includes 包含，禁正则/禁模糊/禁打分）：

| # | key（=CAPABILITY_MAP 已有键） | keywords | 映射 asset | 簇归属（同源断言 b） |
|---|---|---|---|---|
| 1 | openapi-validation | openapi 校验 / openapi校验 / openapi validation / 接口契约校验 | be-validator | T1/T2/T3/T5 |
| 2 | backend-validation | 后端校验 / backend validation | be-validator | T1/T2/T3/T5 |
| 3 | security-audit | 安全审计 / security audit | security | T2/T4/T5 |
| 4 | skill-security-scan | 技能安全扫描 / skill security scan | skill-sentinel | T5 |
| 5 | code-implementation | 代码实现 / code implementation | implementation | T1/T2/T3 |
| 6 | frontend-design | 前端设计 / frontend design | frontend-design | T4 |
| 7 | prd-planning | prd 规划 / prd规划 / prd planning | planning | T4 |
| 8 | feature-breakdown | 功能拆解 / feature breakdown | dev-planner | T3 |
| 9 | code-review | 代码评审 / code review | review | T2/T4/T5 |
| 10 | full-sdlc-orchestration | 全生命周期编排 / sdlc 编排 / sdlc编排 / full sdlc orchestration | sdlc | T1/T2/T3 |

导出面：`deriveCapability(taskText)`（→ `{key, matchedKey} | null`，同输入同 key，多命中按表序取首）、`resolveCapabilityAsset(key)`（CAPABILITY_MAP 单点解析，未知→null）、`checkDerivationRulesConsistency()`（纯函数零 IO）、`CapabilityIngressError`（code ∈ CAPABILITY_UNKNOWN / CAPABILITY_CLUSTER_MISMATCH）。

## C. 交付物 2：planner diff（`scripts/lib/planner.mjs`，最小 diff）

1. 头部 +1 import：`deriveCapability / resolveCapabilityAsset / CapabilityIngressError`。
2. `buildPlan(taskText, manifest)` → `buildPlan(taskText, manifest, options = undefined)`；route 命中簇后：
   - `explicitCap`（options.capability，trim+小写）在场 → **跳过派生**（D.1 precedence 1>2，override）；
   - 否则 `deriveCapability(taskText)`；无命中 → capability=null（**零字段**，legacy 路径）；
   - capability 在场时双重守卫（fail-closed，不静默取一）：值域守卫（解析不到 CAPABILITY_MAP → `CAPABILITY_UNKNOWN` throw）；同簇守卫（解析 asset ∉ cluster.candidates → `CAPABILITY_CLUSTER_MISMATCH` throw，按 CLUSTERS 定义簇成员资格判，可用性仍走既有资格链）；
3. subtask map 回调：原对象字面量**逐字不动**赋给 `subtask`，仅 `capabilitySource` 在场时追加 `subtask.capability` / `subtask.capabilitySource`（asset 原语义零改动；无 capability 任务零字段 → 字节级兼容）。
4. 返回 plan 形状其余字段（id/task/cluster/contract/requireExec/preconditions/phases/status/createdAt）零改动；`route()`/`NoMatchError`/`FRONTEND_IMPL_ASSETS`/`isFrontendImplementation` 零改动。

## D. 交付物 3：CLI diff（`scripts/lib/orchestrator.mjs`）+ activation 导出

1. parseArgs 默认值 +`capability: null`；新分支 `--capability <值>`（缺值/`--`开头 → `out.argError`，与 `--draft`/`--backend` 同款纪律）。
2. `--exec` 分支 KNOWN 集合追加 `'--capability'`（契约附.1：防旗标被静默吞入宿主命令；实测判别见 §E-3）。
3. validateOpts 新增：`--capability` 值非空时逐字命中 CAPABILITY_MAP（大小写不敏感精确匹配），未命中 → `{ok:false, error:'CAPABILITY_UNKNOWN: …', exitCode:2}`。主 CLI 经 `libParseArgs`/`libValidateOpts` 复用（orchestrator.mjs:38-39/573），**真实 main() 即时生效**。
4. 新增导出 `applyCapabilityToPlan(plan, opts)`（plan 后处理，纯函数）：无显式 → plan 原样（派生字段保留、legacy 零触碰）；有显式 → 覆盖全部 subtask 为 `capability/capabilitySource:'explicit'`（precedence 1>2），并做与 buildPlan 同款值域+同簇守卫（CAPABILITY_UNKNOWN / CAPABILITY_CLUSTER_MISMATCH fail-closed throw）。
5. `activation.mjs`：CATALOG_IDS 后新增 `export async function derivationRulesConsistent()`——动态 import `capability-derivation.mjs` 并委托 `checkDerivationRulesConsistency()`（activation 静态依赖环规避：derivation 静态 import CAPABILITY_MAP 为唯一词表事实源）。既有导出/逻辑零改动。

## E. 六项自测逐项（证据全部在本目录）

### 1. 派生探针（`w2-1-probe.log` T1a–T1f，`probe-results.json`）
- PASS T1a：`对登录接口做安全审计` → `{key:'security-audit', matchedKey:'安全审计'}`；
- PASS T1b：`对登录接口做 OpenAPI 校验` → `{key:'openapi-validation', matchedKey:'openapi 校验'}`（CN/EN 混合文本、大小写归一）；
- PASS T1c：`写一份项目周报` → `null`（无命中 → legacy，不造键）；
- PASS T1d：确定性——同组输入 5 轮派生输出 distinctOutputs=1（同输入同 key）；
- PASS T1e/T1f：buildPlan 产物 subtask 全量附加 `capability`/`capabilitySource:'derived'`（T2 五子任务 implementation/sdlc/security/review/be-validator 逐个留痕；openapi-validation 例 be-validator 子任务在场），asset 原值零改动。

### 2. cluster 交叉校验（T2a–T2f）
- PASS T2a：`前端页面功能拆解` → route=T4_FRONTEND（candidates 不含 dev-planner）×派生 feature-breakdown→dev-planner → **`CAPABILITY_CLUSTER_MISMATCH`** CapabilityIngressError fail-closed；
- PASS T2b：显式轴同款——T1 plan × `--capability frontend-design`（→frontend-design ∉ T1）→ `CAPABILITY_CLUSTER_MISMATCH`；
- PASS T2c：buildPlan 显式未知键 → `CAPABILITY_UNKNOWN` throw；
- PASS T2d/T2e：显式命中同簇 → capabilitySource=`explicit` 覆盖派生（precedence 1>2，大小写不敏感）；
- PASS T2f：applyCapabilityToPlan 无显式 → plan 原样返回（派生字段保留）。

### 3. CLI + KNOWN（T3a–T3f + 真实 CLI 双日志）
- PASS T3a/T3b：`--capability security-audit` 解析入 opts；缺值 → argError；
- PASS T3c：`--capability unknown-key` → validateOpts `{ok:false, CAPABILITY_UNKNOWN, exitCode:2}`；
- **真实 CLI**（`w2-1-cli.log`）：`node scripts/orchestrator.mjs --task 写周报 --capability unknown-key` → stderr 输出 `CAPABILITY_UNKNOWN: …` 且 **exit=2**（主链 libValidateOpts 生效实证）；
- PASS T3e + **KNOWN 端到端判别**（`w2-1-cli-exec-known.log`）：`--exec node definitely-missing-host.mjs --capability unknown-key --plan --dry-run` → **先出 CAPABILITY_UNKNOWN、exit=2、未达 planning**——证明裸 `--capability` 被 KNOWN 集合截停解析为 planner 旗标；若 KNOWN 未同步，该旗标会被吞入 exec 收集、validateOpts 见 capability=null 而放行到宿主失败路径（对照 T3f：未知旗标 `--port 3000` 仍按既有语义收集进 exec，`--exec` 原行为零改动）。

### 4. 向后兼容字节级（T4a）
基线 = 改造前 planner 快照 `baseline-planner.snapshot.mjs`（唯一改动：import 行重写为绝对 file:// URL，逻辑逐字保留）。5 个路由任务（数据库 schema 迁移/登录接口开发/前端页面重构/运维部署监控/知识库模型接入，覆盖 T1–T5 全簇）×新旧 planner 双跑，planId/createdAt 挥发字段归一后 **JSON 字节级全等**，且新输出全文 **0 处 `capability` 字样**（零字段变化）。PASS。

### 5. 同源校验（T5a–T5e，探针实测）
- PASS T5a：`derivationRulesConsistent()`（activation 导出）→ `{consistent:true, violations:[], rulesCount:10, capabilityMapKeys:10}`；
- PASS T5b：DERIVATION_RULES 键 ⊆ CAPABILITY_MAP keys（10/10；**无第二份 taxonomy**——键值事实源单点=activation.mjs:56-67，规则表只引用不复刻）；
- PASS T5c：每键映射 asset ∈ ∪CLUSTERS[].candidates（直读 matrix.mjs CLUSTERS 断言，非抄清单）——即**派生不可产出 CAPABILITY_MAP 值域/簇系统之外的键**（派单同源校验定义）；
- PASS T5d：既有探针保持——CAPABILITY_MAP values ⊆ CATALOG_IDS（9 资产）仍成立；
- PASS T5e：resolveCapabilityAsset 未知键 → null（D.2 单点 fail-closed）。

### 6. 回归三件 + audit-index selftest
| 件 | 命令 | 结果 | 证据 |
|---|---|---|---|
| regression | `node scripts/regression-all.mjs` | **24 PASS / 0 FAIL**，exit 0 | regression-all.log |
| preflight | `node scripts/preflight.mjs` | **8 PASS / 0 FAIL / 0 SKIP**，exit 0 | preflight.log |
| validate | `node scripts/validate-structure.mjs` | **[OK] 结构校验通过 (0 项警告)**，exit 0 | validate.log |
| audit-index | `node plans/audit-index-selftest.mjs` | **68 PASS / 0 FAIL**，exit 0 | audit-index-selftest.log |

另：真实 CLI `--plan --dry-run` 深路径两次运行通过 arg 校验进入 planning 态（w2-1-cli.log），lib 语法/导入面零破坏。

## F. D-偏差登记

| # | 偏差 | 理由与处置 |
|---|---|---|
| D-W21-1 | **显式 `--capability` → plan 的「最后一跳」未接生产 main()**：`scripts/orchestrator.mjs:700 buildPlan(opts.task, manifest)` 调用点在白名单外（白名单仅 lib 三件 + activation 断言导出 + W2-1 目录）。W2-1 已就绪：parseArgs/KNOWN/validateOpts（真实 main 即时生效）、buildPlan 第三参显式优先级语义、`applyCapabilityToPlan` 后处理纯函数。 | 白名单硬约束；W2-2 与本步同写 orchestrator 面（契约 §G 串行纪律），最后一跳（main 调 applyCapabilityToPlan 或传第三参）留 W2-2 接线或编排者扩白名单。派生路径（D.1 rule 2）在生产链**已完整生效** |
| D-W21-2 | subtask 仅加 `capability`/`capabilitySource` 两字段，未双写 D.3 `selectedAsset` | 派单任务 2 明确限定两字段；selectedAsset 双写 + provenance（matchedKey/selectedAsset/eligibilityReason 落 state.json/journey 投影）属 D.4/W2-2 传播面。`deriveCapability` 已返回 `matchedKey` 供 W2-2 直接消费 |
| D-W21-3 | `CAPABILITY_CLUSTER_MISMATCH` 在 plan 层为 **throw**（不产出 plan），非 D.5 的 subtask 级 skip | planner 生成期无 subtask 终态语义；skip 裁决属 runtime 执行链（W2-2 面）。plan 层 fail-closed 严格于 skip（零静默）；契约 H.1 停单条件同时受同源校验保护——规则表映射 asset 全部 ∈ 簇（T5c），生产任务不可达 mismatch（探针中 mismatch 均为注入式构造，T2a/T2b） |
| D-W21-4 | `usage()` 帮助文案未登记 `--capability` | usage() 位于 scripts/orchestrator.mjs（白名单外）；留编排者接线时一并补 |
| D-W21-5 | 探针 manifest 用 `CATALOG_IDS` 合成（`manifestSource=synthetic:CATALOG_IDS`），非真实 loadManifest | loadManifest 需 vendorDir 且无缓存时会在仓库 `.tt-state/` 落盘（白名单外写）。planner 对 manifest 的唯一读面是 `entries[].name`，CATALOG_IDS 即权威 9 资产名单（T5d 与 CAPABILITY_MAP 同源成立），断言效力不受影响 |
| D-W21-6 | D.1 的 `CAPABILITY_SOURCE_CONFLICT` 码未实现；env `YY_CAPABILITY` 载体未接线 | W2-1 显式来源仅 CLI 单通道，单来源下「多来源冲突」不可达（空集守卫，非放宽）；fail-closed 精神由 CAPABILITY_UNKNOWN/CLUSTER_MISMATCH 双守卫承担。多来源 precedence 仲裁（CLI vs env）留多来源接线批次，届时单点实现在 applyCapabilityToPlan/buildPlan 入口 |
| D-W21-7 | 派生表内多关键词同键多命中时按**表序**取首（非报冲突） | D.1 冲突语义定义于「来源」间（explicit/derived/default），表内同键多命中不构成来源冲突；表序 tie-break 是确定性要求（同输入同 key）的最小实现，已在模块头注释声明 |

## G. 证据文件清单（本目录）

`w2-1-probe.mjs`（探针源，零凭据/零 SQL/零网络）、`w2-1-probe.log`、`probe-results.json`、`w2-1-cli.log`、`w2-1-cli-exec-known.log`、`regression-all.log`、`preflight.log`、`validate.log`、`audit-index-selftest.log`、`baseline-planner.snapshot.mjs`、本 `RESULTS.md`。
