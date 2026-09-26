# W2-0 Ground Truth + Ingress Contract Freeze（2026-09-27）

> 角色：编排者。两份交接文档（docs/AUDIT-HANDOFF-20260927-WAVE1-TO-CAP-ING.md、docs/ORCHESTRATOR-WAVE2-CAP-ING-ACTIONS-20260927.md）已读，按 Evidence Boundary 降级为 `UNTRUSTED PRIOR / ADVISORY`——仅作反例搜索入口，不作 planning fact。
> 所有结论基于当前 revision **亲自核验**。

## A. Current Evidence（我重新核了什么）

- **revision / tree**：HEAD `8ce6394`（Wave 1 closeout），working tree 除两份未入库交接文档外 clean。
- **planner 真实 shape**：`scripts/lib/planner.mjs:44-57` 直读——`buildPlan()` 产 `{id, planId, asset, contract, status, artifactPath, attempts, phase, dependsOn, desc, estimate, lane, approved, preconditions}`，**无 capability 字段**；`grep -c capability planner.mjs` = 0（与 T0 一致，本轮复核确认仍成立）。
- **CLI 入口**：`scripts/lib/orchestrator.mjs` `parseArgs()` 直读——字段集 `{task, workspace, dryRun, verbose, help, resume, validate, plan, draft, backend, maxRetries, exec, execTimeoutMs, parallel, contract, contractDraft, tui, noTui, hosts, configHosts, argError, session}`，**无 capability 位**；`--exec` 透传的 `KNOWN` 集合亦无 `--capability`（若加入须同步该集合，否则会被当作宿主参数透传）。
- **orchestrator plan 处理**：`orchestrator.mjs:700` `plan = buildPlan(opts.task, manifest)`；后续契约覆盖均以 `subtask.asset === 'be-validator'` 判等（706/715/727 行）——**asset 是为契约路由的既有硬键**。
- **consumer 分布（实测计数）**：runtime 24 处、activation 23 处、prompt-composer 15 处、orchestrator 21 处、governance 3 处、journey 1 处、planner 1 处、matrix 0 处读 `.asset`。
- **resume 路径**：`orchestrator.mjs:132-143` `resumePlan()` 仅按 `subtask.status` 过滤后**原样返回 previous plan**——**不重建、不补字段**；旧 state.json 的 subtask 若无新字段将原样进入执行链（这是兼容性设计点，不是缺陷，但决定 ingress 必须容忍缺字段）。
- **journey**：`scripts/lib/journey.mjs:665` `asset: sub.asset ?? null` 写入投影——**新字段若不在此处传播，journey 将看不到 capability**。
- **prompt-composer**：`:290` `'vendor/' + subtask.asset + '/'`、`:331-333` `s.asset` 取 manifest row——**asset 决定 manifest 查询键**。
- **governance**：`:302-306` `STAGE_BY_ASSET[s.asset]`——**asset 决定治理阶段**（GW-2 已声明为探针用映射）。
- **activation**：`:289/505/515/548/565` asset 为 name-based 主键，`CATALOG_IDS` 静态断言 9 资产；capability 分支（`:296-315`）经 `CAPABILITY_MAP` 解析后**回填 asset 再走全链**。
- **CAPABILITY_MAP 全表**（`:317-328` 直读）：10 键 → 9 id（openapi-validation/backend-validation→be-validator；security-audit→security；skill-security-scan→skill-sentinel；code-implementation→implementation；frontend-design→frontend-design；prd-planning→planning；feature-breakdown→dev-planner；code-review→review；full-sdlc-orchestration→sdlc）。
- **前向字段搜索**：`grep --capability scripts/` = 0 命中（CLI 无 capability 旗标）。

## B. Audit Advice Disposition

| # | 交接文档建议 | 裁定 | 依据 |
|---|---|---|---|
| 1.1 | Wave 1 已入库、不重复施工 | **ACCEPT** | HEAD `8ce6394` + clean tree；`b0268798` manifest；deps 含 spectral 6.16.3（本轮直读） |
| 1.2 | security manifest 已刷 F-019，勿重复修 | **ACCEPT** | 我亲验 sidecar + manifest 语义（Wave 1 closeout） |
| 1.3 | Spectral 已入 package.json/lock | **ACCEPT** | `grep spectral package.json` 命中 6.16.3；`node scripts/bootstrap-kernels.mjs --check` exit 0 |
| 1.4 | capability 仍无 planner 生产者 | **ACCEPT（实锤）** | planner grep=0；parseArgs 无 capability；buildPlan shape 直读 |
| 2.B | 并行 staging 纪律（禁 `git add -A` / L2 按文件归属认责） | **ACCEPT（立即生效）** | Wave 1 真实事故（SECMAN-1 commit 扫入 KERNEL-1 在途文件） |
| 3.A/B/C | 三种 capability 来源选项（explicit / planner 派生 / cluster 派生） | **MODIFY** | 见 §C：A 与 C 各有硬伤；采纳**受控词表单键 + cluster 校验**的混合式（详见 §D） |
| 4.x | mini-contract 必冻字段清单 | **ACCEPT（采纳为契约骨架）** | 见 §D，字段名由我设计 |
| 5 | 10 项反例搜索清单 | **ACCEPT** | 已在本轮 §A 逐项实测（见 §E 反例矩阵） |
| 6 | 多候选勿混入本单 | **ACCEPT** | 与 ACC-1 裁定一致；本单明确不含 ranking/scoring/fuzzy |
| W2-0..W2-4 | 五步拆分 | **MODIFY** | 拆为 W2-0（本文件）→ W2-1（planner 生产）→ W2-2（状态/证据传播）→ W2-3（兼容与负向矩阵，**合并原 W2-3**）→ W2-4（E2E-v3）。W2-1/W2-2 写面高重叠，**串行**（见 §G） |

**拒绝项**：
- **REJECT**：直接采用 Option B（planner 自由文本解析 capability）——会重新引入 v3.4 已禁的语义模糊（同一任务多 capability、provenance 不可审计）。
- **REJECT**：直接采用 Option C（cluster 派生 capability）——`cluster → asset → capability → same asset` 是**伪 capability-native**（capability 只是 asset 影子）；但采纳其**校验**用法（见 §D 双键）。
- **REJECT**：顺手加入多候选/embedding/tie-break——无真实需求 + 规则未冻（ACC-1 已裁定）。

## C. Ingress Options 比较

| 维度 | A 显式输入 | B planner 自由解析 | C cluster 派生 | **D 混合（选定）** |
|---|---|---|---|---|
| authority | 单一（CLI/env） | 模糊（规则集） | 无（asset 影子） | 单一（受控词表）+ cluster 校验 |
| determinism | 完全确定 | 不确定（同句多解） | 确定但无独立性 | 完全确定 |
| 用户体验 | 需知受控 key | 无需知 key | 无需知 key | 无需知 key（有默认派生） |
| cluster DAG 兼容 | 需并存 | 需并存 | 天然兼容 | 兼容（校验不同轴） |
| provenance | 清晰（输入即证据） | 需额外审计面 | 弱（= asset） | 清晰（source + matched key + cluster check） |
| fail-closed | 未知 key 自然拒 | 难（自由文本） | 无（总能派生） | 未知 key 拒 + 冲突拒 |
| resume/replay | 老状态无字段→缺省 | 同 | 同 | 缺字段→**派生补齐**（向后兼容） |
| migration cost | 低 | 中高 | 低 | 低-中 |
| 是否 asset 换名 | 否 | 否 | **是（伪）** | 否（独立键，asset 为 resolver 产物） |

**选定 D 的理由**：capability 必须是**独立路由主键**（拒绝伪 native），但用户不应被迫掌握内部受控词表（拒绝 A 的 UX 代价）。故：**任务文本 → 受控词表确定性映射（显式规则表，禁自由文本猜测）→ capability key → CAPABILITY_MAP 解析 → asset**；同时用 cluster 路由做**交叉校验**（冲突即拒，见 §D 冲突语义），使 asset 由 capability 决定、cluster 只做守卫——**保证 capability 不是 asset 影子**。

## D. Selected Contract（Ingress Mini-Contract v1）

> 落地位置：`plans/capability-ingress-contract-20260927.md`（本文件即其冻结说明；后续实现单引用）。

### D.1 Source（单一 precedence）
1. **显式输入**（CLI `--capability <key>` / env `YY_CAPABILITY`）——最高优先级；
2. **受控派生**（`CAPABILITY_DERIVATION_RULES`，静态表：受控关键词组 → capability key，与 `CLUSTERS[].keywords` **同源校验**）；
3. **缺省**（无 capability 输入、无派生命中）→ **capability = null，全链回落 legacy asset-only 路径**（零破坏）。
precedence：1 > 2 > 3；多来源冲突 → `CAPABILITY_SOURCE_CONFLICT` fail-closed（不静默取其一）。

### D.2 Vocabulary authority
`CAPABILITY_MAP`（`scripts/lib/activation.mjs`）是**唯一** capability key 事实源。**禁止**复制第二份 taxonomy；D.1 的派生规则表只允许产出 `CAPABILITY_MAP` 已有键（构建时断言 ⊆ keys）。

### D.3 Subtask schema（追加字段，不改 asset）
```
subtask.capability        // requested capability（请求了什么；可为 null）
subtask.capabilitySource  // 'explicit' | 'derived' | null（provenance）
subtask.selectedAsset     // resolver 结果（选择了什么）；legacy 路径 = asset
```
**保留 `subtask.asset` 原语义**（既有 24+23+15+21 处消费零改动）——`selectedAsset` 为 capability 模式下 resolver 的显式产物，与 asset 一致时双写（可观测一致性），不一致 → fail-closed（不应发生，见 D.5）。

### D.4 Provenance（必须可回查）
每个含 capability 的 subtask 在 state.json 内留：
`{capability, capabilitySource, matchedKey, selectedAsset, eligibilityReason[]}`
——支持 §A 的 `requested capability → resolver → selected asset → eligibility → adapter` 回查链。

### D.5 Conflict semantics（全部 fail-closed，禁 silent fallback）
| 场景 | 行为 |
|---|---|
| capability only | 解析 → asset；成功则执行；未知 → `INELIGIBLE_CAPABILITY_UNKNOWN` skip |
| asset only（legacy） | 现行为零改动 |
| capability + matching asset | 允许；双写 `selectedAsset`；provenance 记 `explicit+asset-agree` |
| capability + conflicting asset | **`CAPABILITY_ASSET_CONFLICT` skip**（不静默取一） |
| unknown capability | `INELIGIBLE_CAPABILITY_UNKNOWN` skip（既有语义） |
| ineligible selected asset | 走既有资格门 `INELIGIBLE_*` skip |
| dropped selected asset | 走既有 drop 检查（`CATALOG_IDS`/manifest 行缺失 → skip） |
| old persisted plan（无 capability 字段） | D.1 rule 3 → legacy 路径（**不重派生**，防 replay 语义漂移） |
| cluster 与 capability 解析的 asset 不在同簇 | **`CAPABILITY_CLUSTER_MISMATCH` skip**（校验轴） |

### D.6 Compatibility & exit
- asset-only **继续接受**（pinned 语义不变）；
- capability **优先**于 asset（同传时），冲突即拒；
- legacy 退出条件：**不设时间表**（由后续批次按真实使用率裁定；不写"计划废弃"空话）；
- resume/replay：老 state 缺字段 → legacy 路径（D.5 第 8 行），**不迁移改写历史 state**。

### D.7 Evidence / receipt
state.json 的 subtask 记录 + journey 投影（`journey.mjs:665` 扩展）均须含 capability 三字段（null 也显式写入）——保证 receipt/证据不丢 provenance。

## E. Compatibility（旧 asset 主链怎么处理）

- **零破坏承诺**：`subtask.asset` 语义、消费点（runtime/activation/composer/governance/orchestrator）全部保留；capability 为**加法**。
- **resume 兼容**：`resumePlan()` 原样返回 previous → 缺字段走 legacy，无需迁移（实测其过滤仅按 status）。
- **契约路由兼容**：`subtask.asset === 'be-validator'`（orchestrator 706/715/727）保持可用——capability 模式下 selectedAsset 必须等于解析出的 asset（D.3 双写一致性）。
- **前端契约门兼容**：`isFrontendImplementation()`（planner:7-11）依赖 `subtask.asset ∈ FRONTEND_IMPL_ASSETS`——capability 模式下 selectedAsset 先于该判定写入，故兼容。
- **governance 兼容**：`STAGE_BY_ASSET[s.asset]`（governance:303）继续可用。

## F. Write Faces（W2 各步真实写面）

| 步 | 写面 |
|---|---|
| W2-1 planner 生产 | `scripts/lib/planner.mjs`、新增 `scripts/lib/capability-derivation.mjs`、`scripts/lib/orchestrator.mjs`（parseArgs + KNOWN 集合 + plan 后处理） |
| W2-2 状态/证据传播 | `scripts/lib/runtime.mjs`（subtask 透传+失败记忆）、`scripts/lib/journey.mjs`（投影三字段）、`scripts/lib/prompt-composer.mjs`（读 selectedAsset 回退 asset） |
| W2-3 兼容与负向矩阵 | `scripts/regression-all.mjs`（S17 段）、`test-reports/autopilot-work/W2-3/` |
| W2-4 E2E-v3 | `test-reports/autopilot-work/E2E-v3/`（只读+证据） |

**W2-1 与 W2-2 写面重叠于 orchestrator/runtime（同源链路）→ 必须串行。** W2-3 依赖 W2-1+W2-2。W2-4 最后。

## G. DAG

```
W2-0（本文件，已完成）
  └─→ W2-1（planner 生产 capability）
        └─→ W2-2（状态/证据传播：runtime/journey/composer）
              └─→ W2-3（兼容 + 负向矩阵：S17 段）
                    └─→ W2-4（E2E-v3：真实 task → buildPlan → capability → resolver → asset → adapter）
```
**可并行**：W2-1 与「W2-3 的探针脚手架预写」可并行（写面不重叠：前者改 scripts/，后者只写 test-reports/）——但探针断言须在 W2-3 才启用。
**不可并行**：W2-1 ↔ W2-2（同写 orchestrator/runtime）。

## H. Stop Conditions

任一触发即停单并报 Owner，不得硬推：
1. `CAPABILITY_ASSET_CONFLICT` / `CAPABILITY_CLUSTER_MISMATCH` 在生产链上出现（说明契约或实现有误）；
2. planner 形状变更导致任一既有 consumer（runtime/activation/composer/governance/orchestrator 共 62 处 asset 读）回归 FAIL；
3. state.json 序列化/反序列化丢字段（resume 后 capability 丢失）；
4. 需要修改 `CAPABILITY_MAP` 语义（如新增键）而未经 Owner 裁定；
5. 出现「为了通过测试而放宽 fail-closed」的任何倾向。

## 附：本轮发现的、交接文档**未提及**的 ingress 风险（编排者补充）

1. **`--exec` 透传 KNOWN 集合**：新增 `--capability` 必须同步该集合，否则旗标会被静默透传给宿主（实测 `lib/orchestrator.mjs` KNOWN 无 capability）。
2. **CN/EN 混合关键词派生**：`CLUSTERS[].keywords` 混含中文（`render-core` 类），派生规则表须与其**同源校验**（防两套关键词漂移）——这是 D.2 禁复制 taxonomy 的具体落地。
3. **`journey.mjs:665` 是唯一投影写点**：若 W2-2 遗漏此点，capability provenance 在驾驶舱不可见（而 state.json 有）——"state 有 UI 无"是典型半链。
