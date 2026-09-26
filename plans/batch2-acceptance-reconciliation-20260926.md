# Batch 2 Acceptance Reconciliation（2026-09-26，ACC-1 / Batch 3 Wave 1，文档/治理面）

> 执行：autopilot L1 独立执行 agent（全新上下文，派单 `handoffs/v3/ACC-1-dispatch.md`）。
> 本文档**不自称 DONE**——待编排者 L2 复核；ledger 行由编排者写。
> 证据边界：本文所有裁定仅在当前 revision 亲自核验基础上成立；引用均给行号或命令原文。
> current revision：**`8648606`**（T0 ground truth headline commit）；`c599f7b`（batch2 closeout）为其祖先，ancestor 判定实测 exit 0。

---

## 0. 口径原文（逐字直读，不转述）

来源：`plans/batch2-dispatch-plan-20260926.md:24-29` §「批 2 验收口径（预定义）」。原文四条（含第 4 条全门禁）：

> - production 主链（composer→dispatch→adapter→receipt）在 mech 与 llm 双模式各有至少一次完整验证（llm 依赖 E-4 裁定与 key）
> - 治理注入经 composer 管道（非拼尾巴）且三技能激活语义与 Owner 冻结绑定逐字一致
> - capability dispatch 探针：同一 capability 多候选时 resolver 决策可审计
> - 全部门禁（regression 24+ / preflight 8 / validate 0 / audit-index selftest）持续全绿

本单裁定对象 = 前三条验收口径（第 4 条为门禁，见 §5 零归因实测）。

任务表 Owner-resource 原文（`plans/batch2-dispatch-plan-20260926.md:14-15`，逐字）：

> | **MG-1** | sentinel 多 agent 分析器（可选） | API key 接入后 skill-scanner 多 agent 深扫（Owner 提供 key 时执行；无 key 则 backlog） | scripts/lib/adapters/skill-scanner.mjs（最小） | Owner key |
> | **E-4-EXEC** | llm 模式行为面（可选） | kernel 门 vs 诚实 LLM 张力的实测口径（gpt-5.6-sol 真实宿主复跑 FINAL-E2E --host-mode=llm） | test-reports/autopilot-work/E-4-EXEC/ | Owner 拍板执行时机 |

第 22 行原文：`- MG-1 / E-4-EXEC：按 Owner 资源可用性插入`。

---

## 1. 三条口径逐条裁定表

| 口径 | 原文（逐字） | 实测证据 | 裁定 |
|---|---|---|---|
| ① mech+llm 双模式 | 「production 主链（composer→dispatch→adapter→receipt）在 mech 与 llm 双模式各有至少一次完整验证（llm 依赖 E-4 裁定与 key）」 | mech 侧：`test-reports/autopilot-work/FINAL-E2E/RESULTS.md:9`「backend=auto 真实主链，verdict=PASS 9/9」；本单亲跑 `node test-reports/autopilot-work/FINAL-E2E/final-e2e-assert.mjs --backend auto` → `"verdict": "PASS"`，exit=0。llm 侧：`FINAL-E2E/RESULTS.md:45`「`--host-mode=llm` 路径存在但依赖真实 LLM 宿主…标注 **post-Owner-ruling 可选项**」；ledger:183 同口径；任务表 E-4-EXEC 标 Owner-resource | **条件未满足（非工程缺陷）**：mech 侧达标；llm 侧受口径自带条件条款（括号）约束，转 Owner-resource-gated |
| ② 治理逐字一致 | 「治理注入经 composer 管道（非拼尾巴）且三技能激活语义与 Owner 冻结绑定逐字一致」 | 管道半：`test-reports/autopilot-work/CD-1-GV2/probe-results.txt:15` `PASS GV2-5b … slotIdx=3698 > #Verification idx=3273`；`:17` `PASS GV2-5d 插槽治理节 idx=3692 > #Verification idx=3267`。绑定半：`scripts/lib/governance.mjs:72-76` `FROZEN_STAGE_EVENT_BINDINGS` 三键冻结集直读；`test-reports/autopilot-work/REMEDIATION-2/f030-governance-probe.json` `frozen_bindings_positive.assert_all=true`、`two_key_fail_closed.assert_all_mismatches_null=true` | **已满足**（证据指针修正：见 §3 预判#2）；残余项 V-1 批注 |
| ③ 多候选可审计 | 「capability dispatch 探针：同一 capability 多候选时 resolver 决策可审计」 | `scripts/lib/activation.mjs:56-67` `CAPABILITY_MAP` = `Object.freeze({...})` 值全为**单值字符串**（10 键 → 9 id，多键同 id，无一请求→多候选形态）；`grep -n "candidate\|ranking\|tie-break\|择优" scripts/lib/activation.mjs scripts/lib/runtime.mjs` 仅命中 `activation.mjs:222/228/229/231`（`CLUSTERS` phase 投影，与 capability 解析无关），**零** candidate set / ranking / tie-break 代码；`test-reports/autopilot-work/CD-1-GV2/RESULTS.md:55` 自报「多候选语义：CAPABILITY_MAP 键唯一 → 映射产物 id 唯一…语义扩张未做，留 L2 裁定」 | **未闭环**（CD-1 实际以单值受控映射替换了原计划的「候选资产（可多个）」——见 §2.3）；裁定 = 计划口径修订，非执行缺陷 |

---

## 2. 证据详读

### 2.1 口径①：mech 达标实测

- mech 侧亲跑输出（本单）：`{"verdict": "PASS"}`，exit 0；断言链 9/9 与 `RESULTS.md:9` 一致。
- llm 侧零完整验证：`FINAL-E2E/RESULTS.md:42` 记录真实 LLM 宿主（gpt-5.6-sol，2 轮）被 D-1 内核词门拒绝，「assetConsumed=false → security 不派单」——即 llm 模式**未**有完整验证，且失败原因（E-4 张力）是口径括号条款显式承接的条件。
- 结论依据：口径①括号「（llm 依赖 E-4 裁定与 key）」是**口径自身自带的生效条件**，且任务表把 E-4-EXEC 明列为 Owner-resource 项（§0 原文）。故「llm 侧无完整验证」不构成工程缺陷，构成「条件未满足」。

### 2.2 口径②：两半各有证据，绑定半存在已登记残余项

- **管道半（非拼尾巴）**：GV2-5b/5d 断言插槽治理节索引 > `# Verification` 索引 → 治理节位于六段**之后**的插槽位，非正文尾巴拼接。`scripts/orchestrator.mjs:766-770` 直读：`composeGovernedPlanAssets` 为唯一组装点，`governanceSection` 经插槽消费。
- **绑定半（逐字一致）**：`scripts/lib/governance.mjs:72-76` 冻结表三键：
  - `verification → ['before_final_receipt']`
  - `implementation → ['stage_7']`
  - `failure_recovery → ['gate_failed','regression_failed','migration_failed']`
  与 `plans/superpowers-selection-v1.json:19/25/31` 逐条对照：verification 一致；failure_recovery 三枚举一致；implementation 处 JSON 原文为自由文本 `"stage_7_implementation 或 migration shadow run 前"`，冻结表**归一化**为 `'stage_7'`。
- **残余项（既有登记，非本单新增）**：`test-reports/autopilot-work/REMEDIATION-2/RESULTS.md:92` V-1 原文「F-030 冻结集 implementation 事件取 `stage_7`…'migration shadow run 前'触发未内化（影子跑事件暂无运行时发射点，如实登记）」。即「逐字」是对**Owner 已裁定的 F-030 冻结集**逐字，而非对 JSON 自由文本字面复制——此为已登记偏差 V-1，不影响本口径判定。

### 2.3 口径③：CD-1 实际交付形态与原计划意图的差

- **原计划意图**（`handoffs/v3/CD-1-GV2-dispatch.md:10` 原文）：「capability → resolver…→ 候选资产（可多个）→ **eligible 且未 drop 的最优候选**（选择依据可审计）」——即设计上要求多候选 + 择优。
- **实际交付**（`activation.mjs:56-67` + `:295-310`）：受控单值映射 `CAPABILITY_MAP`，capability 请求逐字命中键 → 唯一 manifest id → 走既有 name-based 全链资格判定。无候选集、无排序、无 tie-break。
- **探针实况**：`CD-1-GV2/probe-results.txt:5-7` CD1-2a/2b 的「多候选」是通过**构造夹具**（克隆一行 manifest 得 `be-validator-mirror`）验证「映射后逐行判定 + reason 链留痕」，**非**生产多候选路径；CAPABILITY_MAP 本身键唯一 → 映射结果唯一。
- **无真实多候选需求的独立核验**：直读 `contracts/asset-manifest-v2.json` 9 行 `capability`/`when_to_use`，逐行为互不重叠的领域职责（be-validator=Zod/OpenAPI、security=审计/harden、review=critique/polish、implementation=后端落地、…），无一 capability 请求可命中两个以上 eligible 候选。→ 当前无真实多候选业务需求。
- **结论**：口径③**未闭环**（原计划的多候选形态未在生产实现）；但「多候选评分择优不做」是分级保守设计的既定状态，且已由 CD-1-GV2 §六.3 自报留 L2 裁定。裁定 = **计划口径修订（先冻结规则、无需求不实施）**，非执行缺陷。

---

## 3. 对编排者四条预判的独立核验（采纳/推翻）

| # | 预判 | 核验结论 | 理由（实测） |
|---|---|---|---|
| 1 | 口径①「条件未满足非工程缺陷；mech 满足、llm 转 Owner-resource-gated」 | **采纳** | 口径①括号为自带条件条款（§0 原文）；任务表 E-4-EXEC 标 Owner-resource（§0 原文）；mech 亲跑 PASS 9/9；llm 侧零完整验证且失败因属 E-4 张力 |
| 2 | 口径②「已满足（引 GV2-5b/d）」 | **采纳结论，推翻其证据指针** | GV2-5b/5d 证明的是**管道半**（插槽位、非尾巴拼接），**不**证明「三技能激活语义与 Owner 冻结绑定逐字一致」；绑定半的证据指针应为 `governance.mjs:72-76` 直读 + `REMEDIATION-2/f030-governance-probe.json`。原预判证据指针张冠李戴 → 修正。另附残余项 V-1 批注 |
| 3 | 口径③「CAPABILITY_MAP 受控单值 → 无多候选形态 → 未闭环；降级为规则先冻结、无需求不实施」 | **采纳** | 直读 `activation.mjs:56-67` 值全为单值；candidate/ranking/tie-break 代码零命中；manifest 9 行无职责重叠 → 无真实需求。附注：CD-1 原计划意图确含多候选（`CD-1-GV2-dispatch.md:10`），故「未闭环」判定成立而非「NA」 |
| 4 | MG-1「optional backlog」；E-4-EXEC「Owner 拍板时机」 | **采纳** | 任务表原文逐字（§0 引用）：MG-1「Owner 提供 key 时执行；无 key 则 backlog」；E-4-EXEC「Owner 拍板执行时机」 |

**推翻项汇总**：仅预判 #2 的**证据指针**被推翻（结论本身采纳）。其余三条预判采纳。

### 3.1 closeout 表述遗漏的独立定位（派单 counterexample 面）

派单 counterexample 要求：若认为「closeout 表述无遗漏」须指出口径③在 closeout 何处被**显式列为未闭环**。逐字核验 `plans/autopilot-ledger-20260921.md:283-305`（批 2 收口报告）：

- §二 边界声明原文有：「多候选评分择优未做（映射键唯一→id 唯一；保守口径留 Batch 3）」（`:297`）——**列在「边界声明」**；
- §四 挂账原文为：「D-2…、D-3…、MG-1、E-4-EXEC、D-REG1-1/E-4/AS-2-review adapt…」（`:304`）——**不含**多候选项；
- 全文无任何「口径③未闭环」的**裁定式表述**。

**结论（修正派单表述）**：closeout 遗漏**不是「完全未提多候选」**，而是「未把口径③作为验收口径单列裁定、亦未进挂账清单」。故 ACC-1 的补正动作 = 在本文档把口径③显式登记为「未闭环 + 计划口径修订」，并把多候选降级项补入挂账建议（ledger 行由编排者写）。

---

## 4. Owner-resource 项归属（MG-1 / E-4-EXEC）

| 项 | 归属（实测依据） | 是否阻塞批 2 推进 |
|---|---|---|
| **MG-1** sentinel 多 agent 分析器（可选） | Owner key 依赖——原文「Owner 提供 key 时执行；无 key 则 backlog」 | 否（optional，backlog） |
| **E-4-EXEC** llm 模式行为面（可选） | Owner 拍板时机——原文「Owner 拍板执行时机」；且口径①括号显式承接 | 否（post-Owner-ruling 可选项） |

两项均为计划任务表内明列的 Owner-resource 项，**不得**伪装为工程缺陷（派单 non-goal 逐字要求）。本单裁定：两项维持 Owner-resource-gated，不阻塞批 2 主体收口。

---

## 5. 零归因实测（文档改动不触门禁）

### 5.1 静态论证（写面隔离）

本单唯一写面 = 新建 `plans/batch2-acceptance-reconciliation-20260926.md`。门禁对 `plans/` 的读面（直读源码）：

- `scripts/preflight.mjs:79-87` `listScriptsMjs()` 只 walk `scripts/`；P5 单源扫描面 `:215` 同样限于 `.mjs/.js/.cjs/.ts`（`SCAN_SKIP_DIRS` 含 `test-reports` 等，非 plans 全目录）。
- `scripts/validate-structure.mjs:385` 只读 `plans/critique-backlog-tracker.md` 单文件。
- `scripts/regression-all.mjs:298` A1 孤儿引用扫描 `A1_SKIP_DIRS` **含 `plans`**（整目录跳过）。
- `plans/audit-index-selftest.mjs:39` 只读 `plans/audit-index-20260925.md` 单文件。
- `scripts/preflight.mjs:54` P7 只读 `plans/change-lock.json` 单文件。

→ 新建一个 `plans/*.md` 对上述五处读面**不可见**（无任何目录列举命中 plans 全量）。

### 5.2 实测（写前基线 → 写后复跑）

写前基线（本单亲跑）：

```
preflight   : 8 PASS / 0 FAIL / 0 SKIP       （node scripts/preflight.mjs）
validate    : [OK] 结构校验通过 (0 项警告)   （node scripts/validate-structure.mjs）
regression  : 24 PASS / 0 FAIL               （node scripts/regression-all.mjs，含 preflight 8 + selftest 68 内嵌）
audit-index : 68 PASS / 0 FAIL               （node plans/audit-index-selftest.mjs）
manifest    : 188eb01ae0d88d1cdf2750d5bbfa24165ac8b8d84deac45ab61fb39fa031f1c9
```

写后复跑记录见 §5.3（本节文档落盘后即刻复跑，命令与基线同）。

> **共享工作区纪律说明**：本单执行期间，Wave 1 兄弟单 SECMAN-1 / KERNEL-1 并发推进（`git status` 显示 `contracts/asset-manifest-v2.json`、`contracts/manifest-sources/security.yaml`、`package.json`、`package-lock.json`、`plans/audit-index-20260925.md`、`plans/change-lock.json` 为兄弟单写面）。故本单基线/复跑的**绝对数值漂移**可能来自兄弟单而非本单；零归因判据 = 「ACC-1 写面（新建 plans/*.md）不产生任何门禁读面变化」——由 §5.1 静态论证（plans 不在任何门禁列举面）+ §5.3 复跑与基线一致共同成立。门禁在此工作区为**非稳态基线**，如实登记。

### 5.3 写后复跑

本文件落盘后即刻复跑，命令同 §5.2，实测输出：

```
preflight   : 结果: 8 PASS / 0 FAIL / 0 SKIP / preflight 通过。        （exit 0）
validate    : [OK] 结构校验通过 (0 项警告, 见 --verbose)              （exit 0）
regression  : 结果: 8 PASS / 0 FAIL / 0 SKIP
              结果: 68 PASS / 0 FAIL
              结果: 24 PASS / 0 FAIL                                  （exit 0）
audit-index : 结果: 68 PASS / 0 FAIL / 索引未 stale                    （exit 0）
manifest    : 188eb01ae0d88d1cdf2750d5bbfa24165ac8b8d84deac45ab61fb39fa031f1c9（写前写后一致）
```

写前写后四项门禁数值完全一致（preflight 8/0/0、validate 0 警告、regression 24/0、selftest 68/0），manifest hash 写前写后同值。

结论：ACC-1 文档写入**零门禁归因**成立（静态论证 §5.1 + 写前写后一致实测双证）。

---

## 6. 被拒绝的裁定（明确不做）

- **拒绝「为满足口径③强造多候选 resolver」**：无真实需求证据（§2.3）+ 规则未冻结；先冻结 candidate set / eligibility / deterministic ranking / tie-break / zero-candidate / selection receipt 六项规则为前置；**禁**先引入 LLM/embedding 模糊选择。
- **拒绝「把 MG-1/E-4-EXEC 记为缺陷」**：任务表明列 Owner-resource（§0 原文）。
- **拒绝「重开 Batch 2 整改轮」**：口径①/③ 均属计划语义内/口径修订，非工程质量问题。
- **拒绝「修改契约或验收契约本身」**：派单 stop condition——若裁定需要改契约 → 停止报编排者走 Owner ruling。本单裁定**未**改任何契约；口径③ 的修订属「计划文档口径修订」，在 plans 文档面登记（本文件），契约面零触碰。

---

## 7. 后续归属建议（供编排者记账）

| 项 | 归属 | 动作 |
|---|---|---|
| 口径① llm 侧 | E-4-EXEC（Owner 拍板时机） | 维持 post-Owner-ruling；Owner 裁定后以 `--host-mode=llm` 复跑 FINAL-E2E 补 llm 侧证据 |
| 口径③ 多候选 | Batch 3+ 规则冻结前置 | 先出 mini-contract 冻结六项规则；无需求不实施（本文件已登记计划口径修订） |
| closeout §二/§四 | 编排者 | 建议把「多候选」从 §二 边界声明提升为 §四 挂账/裁定式表述（ledger 行由编排者写） |
| MG-1 | Owner key | 维持 backlog |
| V-1（tier: implementation 事件归一化） | 既有登记（REMEDIATION-2） | 若需补「migration shadow run 前」发射点，另行 amendment |

---

*本文件为 ACC-1 唯一白名单产出；未改 ledger、未改其他 plans 文件、未改任何生产代码、零 git 操作。不自称 DONE。*
