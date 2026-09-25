# Asset Migration Playbook v1 — replace 资产迁移操作手册（证据要求 + 操作指南）

> 版本：`asset-migration-playbook@1.0.0`（2026-09-25，PLAYBOOK-1 蒸馏）
> 蒸馏来源：首个 replace 实例 `test-reports/autopilot-work/AS-2-first/`（be-validator portman→spectral，2026-09-24，PRIMARY）全门栈实证 + plans/execution-plan-v3-20260923.md §v3.1-v3.6 各审计裁定。
> **定位（v3.5/v3.6 裁定，最高优先）**：本文档 = 机读对象头 + 逐状态证据要求表 + 操作指南。**不另立状态机**——状态机唯一权威是 `contracts/asset-migration.md`（asset-migration@1.0.0，ACTIVE→SHADOW→MIGRATING→PRIMARY→DEPRECATED→REMOVED，五条合法转移 + 非法流转表）。本文全部状态/证据要求映射到契约，冲突时以契约为准。
> **适用范围（v3.3 门栈摊销）**：全量门栈只压首个 replace（已完成 = AS-2-first）；其余三个 replace 复制同一机器，证据负担机械化为 §六 wizard 式清单（逐项勾选 + 产物引用，不再逐项重新论证）。禁四路并行 replace。
> **后续三个 replace 的执行者**：只读本文档 + contracts/asset-migration.md 即可开工；AS-2-first 原始证据仅在需要看实例样例时回查（路径随文给出）。
> 本文档不自称 DONE；每次使用后的偏差与修订按 §七回写。

---

## 一、Migration Object（机读 YAML 头，每个 replace 一份，落在该 replace 的 migration-record.json 顶部或伴随文件）

```yaml
# 模板 —— <asset> 的迁移对象头。status 取值 = 契约六态，迁移期间由执行者随证据落盘逐态更新。
migration_object:
  change_dispatch: handoffs/v3/<replace-dispatch>.md   # 派单引用（授权依据）
  contract: contracts/asset-migration.md               # 状态机唯一权威，固定引用
  old_asset:
    vendor_path: vendor/<id>/                          # 迁移前快照见 Gate-0 baseline 行
    adapter: scripts/lib/adapters/<old-adapter>.mjs    # 现态 adapter 文件
    adapter_refs: []        # Gate-0 baseline + 注册表全部引用点（ADAPTERS 两键/regression 段/S8 链）
    engine: "<旧引擎名@版本>"
  new_asset:
    vendor_path: vendor/<id>/...                       # 或 npm 包名（--no-save，不入库）
    introduction: npm|clone|host-skill                 # 引入方式
    license_check: "<AS-0 结论引用：LICENSES.md#节>"
    provider_identity:                                 # 三件套缺一 = NO INSTALL（Failure Rule 3）
      official_source: "github:<org>/<repo>"
      install_channel: "npm install <pkg> --no-save"
      runtime_test: "<cli> --version → 期望 <version>"
  owner: "<编排者派发任务 id；Owner 签收位见 promotion_receipt>"
  status: ACTIVE          # ACTIVE|SHADOW|MIGRATING|PRIMARY|DEPRECATED|REMOVED（契约 §一）
  required_evidence:      # 逐项对应 §二 证据要求表；每项落盘后回填路径
    baseline_snapshot: test-reports/asset-eval-20260923/asset-baseline-before.json#<资产行>
    diff_table_finalized: <path>/expected-findings.json
    rollback_path_verified: <path>/old-engine-record.json
    shadow_result: <path>/shadow-20260924/shadow-result.json
    rollback_drill: <path>/shadow-20260924/rollback-drill.json
    post_promotion_probes: <path>/shadow-20260924/post-promotion-probes.json
    promotion_receipt: apr-<ts>-<slug>-promotion
    runtime_binding: { consumed_hash: <sha256>, build_hash: <sha256> }
    regression_three: { regression_all: <n> PASS/0 FAIL, preflight: <n> PASS, validate_structure: 0 警告 }
```

实例化样例（AS-2-first 实测值，供复制者对照格式）：见 `test-reports/autopilot-work/AS-2-first/migration-record.json`（其 `old_asset/new_asset/shadow_result/promotion_receipt/runtime_binding/five_tuple` 字段即本模板的落盘形态）。

---

## 二、Per-state Evidence Requirements（按契约五条合法转移逐态列证据；进入下一态前本表必须全部落盘并可回查）

### ACTIVE → SHADOW（开工与影子跑夹具就位）

| # | evidence_required | 说明与实例出处 |
|---|---|---|
| 1 | Gate-0 基线快照行 | `asset-baseline-before.json#<资产行>`：adapter/routes/consumption/manifest_hash 四面。首个 replace 由 B1-GATE0 单独产出（16 资产全量）；复制 replace 只需核对本资产行存在且未失效 |
| 2 | 写面声明核对 + change-lock 加锁 | 改动文件 ∈ 派单白名单 + 写面声明表；`change-lock.mjs --acquire` 成功（F-003 教训，见 §五.5） |
| 3 | 影子跑夹具就位 | 缺陷 fixture（canonical，喂新引擎）+ 旧路径孪生 fixture（旧 adapter 文件型契约门可能只认特定后缀——AS-2-first 实测旧 portman 只认 .json，YAML 需 .json 孪生：`fixtures/bad-openapi.yaml` + `bad-openapi.json`）。夹具作为迁移证据落盘于 replace 单目录；临时 harness/临时接线代码必须 os.tmpdir 跑完即删（契约 §五.2：Migration Adapter 不得为永久制品） |
| 4 | **差异表定稿（先于影子跑）** | `expected-findings.json`：expected_rule_ids / min_findings / expected_severity_dist / expected_exit_code + accepted_difference 表（rule_name_changed / severity_mapping_changed / message_changed / new_findings）+ **forbidden_difference 表**（missing_detection / crash / invalid_exit_code，v3.6 增补，无论新旧引擎一律判失败）。`finalized_before_shadow_run: true` 必须显式落盘（§五.1） |

### SHADOW → MIGRATING（影子跑通过 + receipt 签发）

| # | evidence_required | 说明与实例出处 |
|---|---|---|
| 5 | 影子跑 diff 消费证据 | `shadow-result.json`：同 fixture 喂新旧引擎各一次真实执行；实测 finding 数/severity 分布/exit code/规则名对照差异表逐条分类 accepted\|forbidden。**PASS 判据 = 零 forbidden_difference + expected 断言全部满足**。命中 forbidden → NO PROMOTION（Failure Rule 1） |
| 6 | Design consumption: CONFIRMED | 差异表被影子跑逐条真实消费（非事后补写）——AS-2-first：expected-findings 8/8 规则全部报出 |
| 7 | Runtime consumption 证据 | 新旧引擎真实 spawn/执行记录留痕（shadow-result.json DEBUG 与 evidence 字段），v3.2 词汇 |
| 8 | 回滚路径前置验证（影子跑**前**，故列于此段门前） | `rollback_path_verified_before_shadow`：旧引擎真实 exec 一次证明工具在场可回滚（`old-engine-record.json`，portman 1.35.0 pass=true exit 0）——含旧引擎对 YAML 输入降级行为的实测（pass=null，old-engine-record-yaml.json）（§五.2） |
| 9 | promotion receipt 签发 | `apr-*` 格式，gate=影子跑 PASS+回滚演练 PASS+零 forbidden。**approvedBy 为 Owner 签收位：L1 不得代签，可记 PENDING 待 Owner 回填（决策权纪律，AS-2-first D-3 先例）；contracts/discrepancies/ 的 CONTRACT 类 change 单归 L2/编排者补立** |

### MIGRATING → PRIMARY（三硬门 + runtime binding）

| # | evidence_required | 说明与实例出处 |
|---|---|---|
| 10 | Gate-1：旧路径拒绝 + EXPLICIT_COMPAT_MODE 门 | 无旗标调用旧路径 → 拒绝（legacy blocked）；显式旗标（options 或 env）→ 回滚旧路径可用且 contract 内留痕 compat/compat_via/rollback_adapter。实例：post-promotion-probes.json p2/p3 |
| 11 | Gate-2：consumed_hash == build_hash | `manifest-build.mjs` 重跑打印新 sha256（晋升必然改变 hash）；`eligible.mjs --asset <name>` → eligible=true；真实 dispatch 日志 `Gate-2 manifest_sha256=<hash>` 与 build hash 相等。**期望值动态重算，禁硬编码旧 hash**（§五.3） |
| 12 | Gate-3：五元组齐备 | 契约 §二 schema 五字段（old_asset/new_asset/shadow_result/promotion_receipt/runtime_binding），任一缺失 = change 单不成立。落盘形态见 migration-record.json five_tuple |
| 13 | Traffic Switch | CLUSTERS candidates 切换 = 路由面移交。**允许 no-op 但必须记录理由**：AS-2-first 实测簇归属不变（be-validator 仍 T1/T2/T3/T5），切换实质 = 同一 assets 键位的 adapter 引擎替换（migration-record.json MIGRATING→PRIMARY sourceEvidence 第三条） |
| 14 | 新增检出登记 | new_findings 逐条登记（migration-record.json new_findings_registry），随五元组交 L2/Owner 复核——能力提升不是失败，但不得静默（v3.5） |

### PRIMARY → DEPRECATED（被动触发，无本资产动作）

本资产无独立动作：新一轮 replace 宣布其弃用、新 SHADOW 启动即转移（契约 §一）。执行者只需在 change 单登记状态与时间。

### DEPRECATED → REMOVED（drop，AS-1 口径，非 replace 执行者日常）

| # | evidence_required | 说明 |
|---|---|---|
| 15 | drop 三条件全过 | candidate（在 CLUSTERS/manifest）+ runtime invocation（连续两轮盲行零调用才触发评审；有真实消费记录不可 drop）+ quality（质量评审结论），v3.2 |
| 16 | drop_allowed=true 显式置位 | drop_pending（意图）≠ drop_allowed（放行），两个字段；fail-closed：缺失按未放行处理。preflight P6 + 回归断言双卡点 |
| 17 | 6 处联动改清单就绪 + 收口核查 | PHASE2 表/CLUSTERS/matrix/validate 断言资产数/kickoff 清单/manifest 行数；S14 不变量段（import 零命中/旧 adapter 不可达/manifest 路由断言） |
| 18 | 回滚演练记录在案 | 回滚不了就不许删旧资产：drop 前置条件含回滚路径可还原（git revert 可回滚的 tombstone 单）；回滚演练 FAIL → NO DROP（Failure Rule 2） |

非法流转不在此表——契约 §一非法流转表穷举，逐条遵守（特别是：ACTIVE→MIGRATING/PRIMARY 直接跳态 = "文件换了所以完成"自欺，明令禁止；回退走 receipt 作废 + supersede-not-delete，不隐式回退）。

---

## 三、Operator Guide（How-to）——照着敲的命令序列

命令形态以 AS-2-first（2026-09-24）实际执行与产物引用为核心；个别门面命令（Step 0 change-lock，该单报告中无 acquire 留痕，见修订记录 R1）形态取自脚本 CLI 头注与契约 §六 要求。`<占位>` 按本资产替换。每步给出 PASS 判据与 FAIL 处置。

### Step 0 前置：写面声明 + 加锁（F-003 防并行双写）

```bash
# 0.1 核对派单白名单与写面声明表（handoffs/v3/write-faces-batch1.md 或后续批对应表）——人工核对，无命令
# 0.2 加建议性锁（逐个本单将改的文件；--owner=本任务 id）
node scripts/change-lock.mjs --acquire scripts/lib/adapters/portman.mjs --owner AS-2-first --reason "be-validator engine replace" --ttl 120
node scripts/change-lock.mjs --list
```
- **PASS**：每条 acquire exit 0；--list 显示本任务持锁、字段含 expires。
- **FAIL**（exit 1，他方 active 锁在场）：**不得开工**。回编排者裁决（派发拒发是锁的真强制力）；过期锁可被 acquire 直接夺取属正常自愈。

### Step 1 Gate-0 基线核对 + Preflight

```bash
node scripts/preflight.mjs
```
- **PASS**：exit 0，7 项检查 PASS/SKIP（P6 在 manifest 产物缺席时 SKIP 属正常）；baseline 中本资产行存在（`asset-baseline-before.json#<资产>`）。
- **FAIL**（exit 1，具名 P1-P7）：先修预检项再动工。P5 命中 = 有人绕过 manifest-build 单源写面，立即停并上报。

### Step 2 新引擎安装 + provider identity 三件套（Failure Rule 3 前置）

```bash
npm install --no-save @stoplight/spectral-cli
spectral --version
```
- **PASS**：--version 输出与期望版本一致（AS-2-first：6.16.3）。npm 假包教训：**装完必核**，package name ≠ capability。
- **FAIL**：版本不符/命令不存在/来源非 official source（github:<org>/<repo> 对应的 npm 包）→ **NO INSTALL**，换 official source + install 通道 + runtime_test 全链重验，禁用来历不明包。package.json/package-lock 零改动（--no-save）。

### Step 3 旧引擎行为实测 = 回滚路径前置验证（§五.2）

```bash
# 3.1 用现 adapter（旧引擎）对孪生 fixture 真实执行一次（AS-2-first 经 shadow harness 落 old-engine-record.json）
# 3.2 顺带记录旧引擎对 canonical 后缀输入的降级行为（old-engine-record-yaml.json：pass=null degraded=true）
```
- **PASS**：旧引擎产物记录落盘（无论检出多少——0 检出也是有效基线证据，portman 对缺陷密集文档实测 0 findings pass=true exit 0），证明工具在场、可回滚。
- **FAIL**：旧引擎已不可执行 = 无回滚路径 → 停，先修复旧路径或上报，禁止继续。

### Step 4 差异表定稿（先于影子跑，§五.1）

人工产出 `expected-findings.json`（fixtures/ 同目录）：canonical fixture、孪生 fixture 及理由、old_engine 实测行为（引用 Step 3 产物）、new_engine_expected（expected_rule_ids/min_findings/expected_severity_dist/expected_exit_code + exit 语义）、accepted_difference 四类、forbidden_difference 三类。顶部 `"finalized_before_shadow_run": true` + finalized_at 时间戳。

```bash
# 4.1 Smoke（官方影子跑前允许依 smoke 修订 expected_rule_ids，但修订必须留痕于文件内 amendments 字段——AS-2-first D-2 先例，非静默改门）
spectral lint <fixture> --ruleset <ruleset> --format json > spectral-probe.json 2> spectral-probe.err
```
- **PASS**：smoke 规则集与预期一致；差异表定稿落盘。
- **FAIL**：规则不触发（如 openapi-tags 在 spectral:oas 为 recommended:false）→ 修订 expected_rule_ids 并留痕 amendments，再定稿。

### Step 5 Shadow Run（Failure Rule 1 前置）

```bash
# 5.1 影子 ruleset（extends 官方默认，零自造规则；AS-2-first: rulesets/spectral-oas-shadow.yaml）
# 5.2 同 fixture 分别喂旧 adapter 与 spectral（临时 harness 在 os.tmpdir，跑完即删）
spectral lint fixtures/bad-openapi.yaml --ruleset rulesets/spectral-oas-shadow.yaml --format json > spectral-shadow-stdout.json
# 5.3 产物对照差异表逐条分类 → 落 shadow-<date>/shadow-result.json（含 DEBUG/spawn 记录、
#     comparison.diffClassification 逐条 accepted|forbidden、forbidden_verdict；原始产物以
#     artifacts 字段互链：spectral-shadow-stdout.json / old-engine-record.json）
```
- **PASS**：零 forbidden_difference（missing_detection/crash/invalid_exit_code 均未命中）+ 实测 exit_code==expected_exit_code + expected_rule_ids 全部报出 + finding_count ≥ min_findings + severity 分布符合预期。accepted 差异（含 new_findings 全量）登记留痕。
- **FAIL**：任何 forbidden 命中或断言不满足 → **NO PROMOTION**。FAIL 也是有效迁移证据（如实落盘 shadow-result.json），回滚即可；不修 fixture 凑 PASS、不静默降级断言。超差 new_findings 阻断晋升交 L2/Owner 评审（v3.5）。

### Step 6 Rollback Drill 三场景（Failure Rule 2 前置；v3.6 三场景定型）

对候选新接线（临时镜像布局，os.tmpdir）：

1. **正常路径**：candidate 对 fixture 真实 lint → 报出 expected-findings 内全部问题。
2. **binary missing（Failure Injection）**：临时令新引擎不可达（AS-2-first 实测：改名 `node_modules/.bin/spectral.cmd`）→ adapter 检测（SPECTRAL_NOT_AVAILABLE）→ **无旗标：拒绝（legacy blocked，Gate-1）**；**显式 EXPLICIT_COMPAT_MODE（options.explicitCompatMode 或 env EXPLICIT_COMPAT_MODE=1）：回滚旧 adapter 可用**，contract 内留痕 compat/compat_via/rollback_adapter。注入后**必须还原现场**并复验（spectral_restored=true）。
3. **输出格式异常**：喂假引擎（垃圾输出+exit 0）→ adapter 诚实报错（SPECTRAL_OUTPUT_INVALID，receipt failure 路径），不静默吞。

产物：`shadow-<date>/rollback-drill.json`（results.s1_*/s2a_no_flag/s2b_explicit_compat/s3_output_anomaly）。
- **PASS**：三场景全过。
- **FAIL**：场景 2 回滚不可用 → **NO DROP**（回滚不了就不许删旧资产）且不得晋升；场景 3 静默吞输出 = 证据通道坏，必须修 adapter 后重跑。

### Step 7 Promotion（双 PASS 后）

```bash
# 7.1 改造 adapter 为新引擎驱动（≤150 行胶水纪律；契约冻结外壳不动；旧逻辑保留在 EXPLICIT_COMPAT_MODE 显式旗标后，禁静默并存）
# 7.2 正式 ruleset 固化 vendor/<asset>/rulesets/
# 7.3 更新 sidecar verification 字段（provider identity verification 三件套：command + expected.exit_code）
# 7.4 重跑 manifest 构建（唯一构建器）
node scripts/manifest-build.mjs
```
- **PASS**：manifest-build exit 0 并打印新 sha256；preflight P5 仍单源；sidecar 更新且 vendor 文件一字未改（构建器纪律）。
- **FAIL**：CANDIDATE_INVALID 具名 → 按具名修 sidecar/vendor 头，产物不落盘（fail-closed，拒绝半成品）。

### Step 8 Runtime binding 验证 + post-promotion probes（Gate-1/Gate-2 机验）

```bash
node scripts/eligible.mjs --asset be-validator
# 真实 dispatch 一次，抓日志：
node scripts/orchestrator.mjs --backend prompt --task "backend login module"   # 日志须含 Gate-2 manifest_sha256=<新hash>
```
post-promotion probes（`shadow-<date>/post-promotion-probes.json`）：p1 正常路径（真 ruleset + 真 adapter）✓ / p2 旧路径无旗标拒绝 ✓ / p3 EXPLICIT_COMPAT_MODE env 形态可用 + rollback_adapter 留痕 ✓ / 引擎现场还原 ✓。
- **PASS**：eligible=true；dispatch 日志 manifest_sha256 == manifest-build 打印的新 hash（Gate-2）；四探针全过。**hash 期望值动态重算**——重算 sha256 与日志比对，禁引用历史记录里的旧 hash 常量（§五.3）。
- **FAIL**：hash 不等 = runtime 绕过单源（走旧 buildManifest）→ 停，排查写面；p2 不拒绝 = EXPLICIT_COMPAT_MODE 门失效 → 停，修旗标门后重跑（静默并存 = Gate-1 FAIL）。

### Step 9 回归三件 + 五元组落账（晋升前后各一轮）

```bash
node scripts/regression-all.mjs          # PASS = 14 PASS / 0 FAIL
node scripts/preflight.mjs               # PASS = 7 PASS / 0 FAIL / 0 SKIP（P6 按当时态）
node scripts/validate-structure.mjs      # PASS = 0 警告
```
- **PASS**：晋升前一轮全绿（确认基线干净）+ 晋升后一轮全绿；S8 资产消费段结论留痕（AS-2-first 实测 S8 走 --backend prompt 不经专用 adapter，引擎切换零影响——复制时按资产实际链路判定，不照抄结论）。
- **FAIL**：定位到本单改动面的段 → 修后重跑；非本单面的 FAIL → 登记偏差上报，不扩大修面。

落账：migration-record.json（schema 见 migration-record.json 实例）：**state_machine 逐转移含 `at` 时间戳 + sourceEvidence 逐条引用（R2）** + five_tuple + rollback_drill + regression + deviations（逐条登记；**接口面扩张如文件型契约 .json→.json/.yaml/.yml 属能力提升面，须登记 deviations 交复核——D-4 先例（R3）**；L1 不自称 DONE，交 L2 复核）。

---

## 四、Failure Rules（四条，全收）

| # | 触发 | 裁定 | 出处 |
|---|---|---|---|
| 1 | 影子跑 FAIL（含任一 forbidden_difference 命中：missing_detection/crash/invalid_exit_code） | **NO PROMOTION**。FAIL 也是有效迁移证据，如实落盘后回滚即可；禁止修 fixture/降断言凑 PASS | v3.5 影子跑 Evidence Contract + v3.6 forbidden_difference；AS-2-first expected-findings.json forbidden_difference 段 |
| 2 | 回滚演练 FAIL（旧路径无法恢复可用） | **NO DROP**。回滚不了就不许删旧资产；drop（DEPRECATED→REMOVED）前置证据 18 不成立 | 契约 §一 DEPRECATED→REMOVED + Gate-5 rollback proof（v3.3 采纳）；AS-2-first rollback-drill.json s2 |
| 3 | Provider identity 三件套（official source / install 通道 / runtime_test）缺一 | **NO INSTALL**。package name ≠ capability（npm semgrep 假包教训）；装后必跑 --version 核实 | v3.4 第 1 条 + v3.5 第 2 条（provider YAML schema 并入契约）；AS-2-first RESULTS §一 2b |
| 4 | 旧路径共存 | **EXPLICIT_COMPAT_MODE**：旧路径每次调用必须显式旗标（options 或 env）+ 留痕（compat/compat_via/rollback_adapter），禁静默并存；迁移期共存 ≠ 无限共存，Phase 2 一律删除旧 loader | 契约 §三 Gate-1 + v3.2 adopt；AS-2-first post-promotion-probes.json p2/p3 |

---

## 五、关键教训五条（逐条注明出处）

1. **差异表先于影子跑定稿**。accepted_difference/forbidden_difference 表在影子跑前定稿并留 finalized_before_shadow_run 标记；"新工具发现更多问题"是能力提升不是失败（旧 portman 对缺陷密集文档 0 检出 vs Spectral 9 findings，old-engine-record.json vs shadow-result.json 实证）。出处：v3.5 第 5 条 Evidence Contract；AS-2-first fixtures/expected-findings.json（finalized_at 09:41:30Z 早于影子跑 09:58:00Z）。
2. **回滚路径影子跑前验证存在**。migration-record.json `rollback_path_verified_before_shadow` 模式（verified:true + at + evidence 指向旧引擎真实 exec 产物）：先证明"工具在场可回滚"，再谈替换。出处：v3.4 第 3 条；AS-2-first migration-record.json + old-engine-record.json。
3. **hash 期望值动态化**。硬编码 hash 随合法晋升腐坏（AS-2-first 晋升使 manifest hash 从 f770140c… 变 84e2c7ab…）——任何 Gate-2 探针/断言的期望 hash 必须现场重算 sha256 再比对，禁硬编码常量（AV-3 探针 C1/C2 假 FAIL 教训：若其断言写死 hash，一次合法晋升即全部假 FAIL）。出处：AV-3 RESULTS.md §4（C1-C3 动态重算形态）+ AS-2-first RESULTS §五。
4. **门栈摊销**。全量门栈只压首个 replace；复制的三个走同一机器，证据负担机械化为 wizard 式清单（勾选+产物引用），禁四路并行 replace——否则"门的自嗨"。出处：v3.3 编排者补充声明；契约 §三门栈适用范围声明。
5. **写面声明表 + change-lock 先于动工**。同文件双写禁令（F-003 并行双写教训：EX-1/ON-1 双写 executor-setup.mjs 致游离 if 块）；锁是建议性的，真强制力=派发拒发+收口 diff 归属核查，但 acquire/list 机检面必须先走。出处：execution-plan §并行写面纪律 + v3.1 change-lock adopt 降级；preflight.mjs P7。

---

## 六、复制阶段 wizard 式清单（其余三个 replace 用；逐项勾选+产物引用，不再逐项重新论证）

> ⚠️ 2026-09-25 增补（第十审计 F-004/F-003/F-005）：①Step 9 增列"**晋升前**回归/validate 快照"勾选项——晋升后全绿不补偿归因，缺失即记 DEVIATED 不得 [x]（AS-2-security D-5 实证改记）；②改存/归档夹具后必须**重绑定全部持久证据指针**（migration-record/shadow-result/expected-findings 的 fixture 路径 → 新 URI+完整 sha256，AS-2-security 漏改 5 处实证）；③**能力收缩必须显式登记**——旧引擎能力 ⊄ 新引擎时：adapter 拒绝超范围目标（命名错误码）+ manifest when_not_to_use 增列 + deviations 记 capability narrowed（AS-2-security：Python-only ruleset 替代多语言+gitleaks 未登记即假绿风险，adapter 已加 SCOPE_LANGUAGE_UNSUPPORTED 守门）

前置确认：① AS-2-first 的 D-3 receipt 已由 Owner 关账；② L2 已复核 AS-2-first migration-record；③ 本 Playbook 已按复制实例反向校验（v3.4 第 4 条）。

- [ ] Step 0 锁：change-lock acquire × 改动文件，list 确认（产物：锁记录）
- [ ] Step 1 baseline 行核对 + preflight 7 PASS（产物：preflight 输出留档）
- [ ] Step 2 安装 + --version 三件套（产物：版本记录）
- [ ] Step 3 旧引擎实测 + rollback_path_verified_before_shadow（产物：old-engine-record.json）
- [ ] Step 4 差异表定稿 finalized_before_shadow_run=true（产物：expected-findings.json）
- [ ] Step 5 shadow-result.json 零 forbidden（产物 + 断言勾选）
- [ ] Step 6 rollback-drill.json 三场景全过 + 现场还原（产物 + spectral_restored 勾选）
- [ ] Step 7 adapter ≤150 行 + ruleset 固化 + sidecar verification + manifest-build 新 hash（产物：hash 值）
- [ ] Step 8 eligible=true + Gate-2 日志 hash 相等 + 四探针（产物：post-promotion-probes.json）
- [ ] Step 9 回归三件晋升前后双绿（产物：输出留档）+ migration-record.json five_tuple + deviations 登记
- [ ] 交 L2 复核，receipt Owner 签收位回填

## 七、使用后回写

每次用本 Playbook 执行 replace 后：偏差登记入该单 migration-record.json deviations；Playbook 本身的修订（写了没做/做了没写）双向回写本文并在此追加修订记录行。修订记录历史见下节与本单自测目录 `test-reports/autopilot-work/PLAYBOOK-1/`。

### 修订记录

| 日期 | 版本 | 修订 | 依据 |
|---|---|---|---|
| 2026-09-25 | 1.0.0 | 首版蒸馏 + 回溯自测双向修订（A 向 1 条 + B 向 4 条，起草期另吸收 5 条备考；明细见 01-selftest-matrix.md 与 03-revisions.md） | AS-2-first 全证据逐条对照 |
| 2026-09-25 | 1.0.0 | R1 Step 0 措辞校准（change-lock 该单无留痕，出处改为 CLI+契约） / R2 转移 at+sourceEvidence 显式化 / R3 接口面扩张登记（D-4） / R4 shadow 产物互链形态 | 自测 01-selftest-matrix.md |
