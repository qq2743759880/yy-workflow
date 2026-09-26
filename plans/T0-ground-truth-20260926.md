# T0 Ground Truth Reconciliation — yy / Post-Batch2（2026-09-26）

> 身份：项目编排者。本文所有结论**仅在当前 revision 亲自核验**基础上成立。
> 交接文档（docs/AUDIT-HANDOFF-20260926-BATCH2.md、docs/ORCHESTRATOR-NEXT-ACTIONS-20260926.md）已读，
> 但按 Evidence Boundary 纪律降级为 `UNTRUSTED PRIOR / ADVISORY`——只作反例搜索入口。

## 0. 当前 revision / 状态（实测）

- HEAD `c599f7b`（batch2 closeout report）；working tree 除两份交接文档（untracked）外 clean。
- 门禁实测：regression 24 / preflight 8 / validate 0 / audit-index selftest 68——全绿。
- 两份交接文档**未入库**（untracked）——它们不是项目 truth，且不应自动入库。

## 1. 我实际读取并核验的对象

| 面 | 核验方式 |
|---|---|
| plans/batch2-dispatch-plan-20260926.md 验收口径原文 | 直读 §验收口径 |
| planner.mjs / orchestrator.mjs / runtime.mjs 的 capability 真实链路 | grep + 代码直读（生产 caller 追踪） |
| contracts/manifest-sources/security.yaml vs scripts/lib/adapters/security-semgrep.mjs | 逐行比对 F-011/F-019 语义 |
| package.json / package-lock.json / node_modules / playbook | spectral 三件套(cli 声明/锁/安装) 逐项 |
| CAPABILITY_MAP（activation.mjs） | 直读键值 + 完整性注释 |
| FINAL-E2E v2 / PC-1 / CD-1-GV2 / R-2 RESULTS | closeout 断言与自报偏差对照 |

## 2. 审计建议裁定（ACCEPT / MODIFY / REJECT）

### ACCEPT-1：Batch 2 验收口径与 closeout 存在边界差 —— 成立

**证据（实测）**：`plans/batch2-dispatch-plan-20260926.md` §验收口径 原文三条：
1. 「production 主链（composer→dispatch→adapter→receipt）在 **mech 与 llm 双模式**各有至少一次完整验证（llm 依赖 E-4 裁定与 key）」
2. 「治理注入经 composer 管道（非拼尾巴）且三技能激活语义与 **Owner 冻结绑定逐字一致**」
3. 「capability dispatch 探针：**同一 capability 多候选时** resolver 决策可审计」

**核验结论（MODIFY，不是简单 ACCEPT）**：第 1 条的括号本身就是**计划自带的条件条款**（llm 依赖 E-4 裁定与 key）——MG-1/E-4-EXEC 在计划任务表里明确写为「Owner 提供 key 时执行；无 key 则 backlog」「Owner 拍板执行时机」。所以 closeout 写 PARTIALLY CONFIRMED 与该条**不冲突**，属计划语义内。**但第 3 条我核验为真缺口**（见 §3.3），closeout 未把它单列为未闭环项——这是 closeout 的表述遗漏。

### ACCEPT-2：capability-native 只到 runtime 单点 —— 成立（实测实锤）

**证据（实测）**：
- `grep -c capability scripts/lib/planner.mjs` = **0**——planner 完全不产出 capability。
- `scripts/lib/planner.mjs:45` subtask schema 为 `{id, planId, asset, contract, status, ...}`——**asset 硬编码为字段名**，无 capability 位。
- orchestrator 生产链**从不设置 subtask.capability**（grep 零命中）；唯一 capability 入口在 `runtime.dispatch`（`subtask.capability !== undefined` 分支，runtime.mjs:130-146）。
- CD-1 RESULTS §六 自报一致：「orchestrator 生产链尚无 capability 字段入口（planner 边界外）」。

**结论**：第 6 条测试纪律（Runtime 单点支持 ≠ production 主链支持）**在本仓库成立**。capability 目前是「dispatch 侧就绪、生产无生产者」的半闭环。

### MODIFY-1：多候选 resolver —— 不是「未完成」，是「明确未需要」

**证据（实测）**：
- `CAPABILITY_MAP` 是受控映射：**值 = 单一 manifest id**（键 10 个 → id 9 个，多键可同 id，但无「一请求→多候选」形态）；implementation 层无 candidate set / ranking / tie-break 代码。
- v3.2 裁定原文（execution-plan-v3）：完整 capability dispatch 移批 2；v3.4 第 4 条明写「主键仍 asset name」；CD-1 偏差 §3 自报「评分择优未做，保守口径留 Batch 3」。

**结论**：这不是执行遗漏，是**分级保守设计的既定状态**。且我核验**当前无真实多候选业务需求证据**：manifest 行 capability 字段为自由文本，未有任何一 capability 请求需要两个以上 eligible 候选（security/be-validator/review 各司其职，无职责重叠到需择优的程度）。
→ 因此**拒绝**为满足旧文案强造多候选 resolver。若将来确有需求，须先冻结 candidate set / eligibility / deterministic ranking / tie-break / zero-candidate / selection receipt 六项规则（禁先引入 LLM/embedding 模糊选择）。

### ACCEPT-3：security manifest source 确为 stale —— 成立（实锤）

**证据（实测逐行比对）**：
- `contracts/manifest-sources/security.yaml` when_not_to_use 末条现写：「…F-011 后守门为**文件级**：显式非 Python 文件目标拒绝，**目录目标放行**（目录内 .py 生效；**0 findings 属真实扫描结果如实记录**，REMEDIATION-1）」
- `scripts/lib/adapters/security-semgrep.mjs:69-110` 实际（F-019 后）：**纯非 Python 源码目录 → SCOPE_LANGUAGE_UNSUPPORTED 拒绝**；**混合目录 → 照扫但 pass=false**（`errors.length===0 && uncoveredLanguages.length===0`）+ `uncovered_languages` 显式列出。

**结论**：源头权威语义（sidecar）落后于 adapter 真实语义 → **确认为 stale**。这违反 S15-A5 建立的不变量（真实执行≠能力覆盖）。修法遵循 AV-2 纪律：**从 sidecar 修，禁止手改生成后的 manifest JSON**，并重跑 build→hash→consumers→regression→audit-index/evidence。

### ACCEPT-4：Spectral 内核不可重复部署 —— 成立（实锤）

**证据（实测）**：
- `grep spectral package.json package-lock.json` = **零命中**（未声明、未锁）。
- `node_modules/@stoplight/spectral-cli` 在场（本机 `npx spectral --version` = 6.16.3），但 **node_modules 被 .gitignore 忽略**——即：仓库声明层面无法恢复该 PRIMARY 内核。
- `plans/asset-migration-playbook.md:131` 唯一安装记录是 `npm install --no-save @stoplight/spectral-cli`——**--no-save 恰是 R-2 D-1 事故根因**。
- manifest 的 provider identity（verification 字段）已写明 npm 安装通道与版本 6.16.3——**声明存在，但可执行声明未落到 package.json/lock**。

**结论**：干净环境**不能**据仓库声明稳定恢复该内核。这是 PRIMARY 资产的**部署可重复性缺口**（非本机可用性问题）。

### REJECT-1：拒绝「顺手删 reflect-metadata / tslib」

**证据**：`grep reflect-metadata|tslib scripts/` = 零命中（无 import），但**无完整证据**证明其无其它消费面（playwright 链路/工具链）。交接文档亦提示「没有完整证据时禁止顺手删除」。→ **不删**，仅在 KERNEL-1 内做一次正式核实后单独裁定。

### REJECT-2 / 过期项：交接文档中的部分叙述已过期或属过度推论

- 「T1 Acceptance Reconciliation 优先，closeout 只证明 mech」——**部分过期**：closeout 与 plan 自身的条件条款一致（见 ACCEPT-1 MODIFY），真正缺的是**把第 3 条（多候选）显式列为未闭环**并给出裁定，而非重造整改轮。
- 交接文档 §建议的 7 项候选任务中，**Multi-candidate Resolver 应降为「先冻结规则、无需求不实施」**（见 MODIFY-1）。

## 3. 当前真正未闭环的问题（按优先级）

| # | 问题 | 性质 | 实测证据 |
|---|---|---|---|
| 1 | security sidecar 语义 stale（目录放行口径落后于 F-019） | **正确性/治理**（源头错误 → 污染 consumer） | 逐行比对 §2 ACCEPT-3 |
| 2 | Spectral PRIMARY 内核无仓库声明可恢复安装 | **部署可重复性**（干净环境不可复现） | package.json/lock 零命中 |
| 3 | capability 无生产生产者（planner/orchestrator 不产 capability） | **主链能力未接通**（单点≠主链） | planner grep=0 / orchestrator 零设置 |
| 4 | closeout 未显式裁定「多候选」与「llm 模式」的归属 | **口径遗漏**（非工程质量） | 与 plan §验收口径第 3 条比对 |
| 5 | audit-index/evidence 将随 #1/#2 产生新 hash 需同步 | **证据新鲜度**（已有 S14b/selftest 可验） | audit-index B-6 manifest hash 期望值 |

## 4. 只是历史/文档口径、不值得修

- FINAL-E2E 目录名与「Runtime Boundary E2E」新名不一致（更名时刻意保留目录防证据路径断裂——已登记）。
- REMEDIATION-2 s16 探针 JSON 被回归器重写（固有行为，D-3 已登记）。
- D-2 两个名义依赖（reflect-metadata/tslib）——无证据不动。

## 5. 下一批是否成立

**成立**，但**不含**交接文档建议的全部 7 项。理由是上述 5 个未闭环项中有 3 项属真实缺陷（#1/#2/#3），1 项属口径收口（#4），1 项是随动（#5）。

## 6. 任务 DAG + write faces + gates（Batch 3 提案）

### Wave 1（并行——写面实测无交集）

| id | 任务 | write face（实测交集核验） | gate |
|---|---|---|---|
| **ACC-1** | Acceptance Reconciliation：裁定 #4（llm 模式归属 E-4-EXEC 条件条款；多候选降为规则先冻结），把 Batch 2 closeout 边界补正 | `plans/`（新文档）+ `plans/autopilot-ledger-20260921.md` | 文档面，无生产改动 |
| **SECMAN-1** | Security Manifest Semantic Freshness：从 sidecar 修 when_not_to_use 至 F-019 真实语义 → rebuild → hash → consumers | `contracts/manifest-sources/security.yaml` + `contracts/asset-manifest-v2.json`（构建产物）+ `plans/audit-index-20260925.md`(hash 行) + 证据 | S15-A5 不变量复跑 + 门禁全绿 |
| **KERNEL-1** | External Kernel Reproducibility：Spectral 正式声明 + 可复现安装通道 + 干净环境验证 | `package.json` + `package-lock.json` + `scripts/`(bootstrap 脚本，如新建) + `plans/asset-migration-playbook.md` | 干净副本重建可跑 + S15-A2/S16-2 真扫复跑 |

**交集核验（实测）**：SECMAN-1 仅触 contracts/ 与 audit-index 行；KERNEL-1 仅触 package/lock/scripts-bootstrap/playbook；ACC-1 仅触 plans/。**三者两两无交集** → 允许并行。

### Wave 2（串行，依赖 Wave 1 稳定）

| id | 任务 | write face | gate |
|---|---|---|---|
| **CAP-ING-1** | Capability Ingress：让 planner/orchestrator 真实产出 capability（**先冻结 ingress 契约**：能力入场来源 = 任务文本受控词表？cluster 派生？须先出 mini-contract） | `scripts/lib/planner.mjs` + `scripts/orchestrator.mjs` (+ 视需要 `runtime.mjs`) + contracts（ingress schema） | 与 CAPABILITY_MAP 全集一致 + fail-closed 未知 + 主链 E2E |

**不得与多候选并行**（同触 planner/activation/runtime）。

### Wave 3（最终验证）

| id | 任务 | gate |
|---|---|---|
| **E2E-v3** | Runtime Boundary E2E v3：全部生产改动后复跑 | mech PASS；llm 视 E-4-EXEC |

### Owner-resource gated（不得污染其他任务）

- **MG-1**（sentinel 多 agent 分析器）：需 Owner API key。
- **E-4-EXEC**（llm 行为面）：需 Owner 拍板时机 + key。

### 明确不做

- **Multi-candidate Resolver**：无真实需求证据 + 规则未冻结 → **不做**（先冻结规则为前置；见 MODIFY-1）。
- **顺手删 reflect-metadata/tslib**：无完整证据 → **不做**（REJECT-1）。

## 7. 派单前纪律检查（§五）适用性

Wave 1 三单均按 §五 十四个字段书写（current revision / Evidence Boundary / 目标 / 非目标 / dependency / allowed+forbidden write face / frozen-contract impact / production caller / production authority / positive+negative probe / counterexample / failure semantics / rollback+compat / regression / evidence path / stop condition）。**白名单遗漏 → 先 amendment 后修改**（沿用 D-3 教训）。

---

**结论**：审计建议中 ACCEPT-1（边界差，但 MODIFY 为口径收口）、ACCEPT-2（capability 单点≠主链）、ACCEPT-3（security stale）、ACCEPT-4（Spectral 不可复现）**成立**；MODIFY-1（多候选降级）与 REJECT-1/2（不删依赖、部分叙述过期）**已明确拒绝并给出证据**。Batch 3 成立，取 3 项真实缺陷 + 1 项口径收口 + 1 项主链接通，**不含**多候选与模糊选择。
