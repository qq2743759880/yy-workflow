# Asset Migration Playbook v1.1 — replace 资产迁移操作手册（证据要求 + 操作指南）

> 版本：`asset-migration-playbook@1.1.0`（2026-09-25，PLAYBOOK-1 蒸馏 + PB-WRITEBACK 三单实战回写）
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
      name_collision_check: "<install 前必查：registry 包名 == 官方项目名？不同名时先核对官方 repo 声明的真实包名，再安装（Failure Rule 3 增补 a，AS-2-sentinel D-2 实例）>"
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
| 3a | **夹具归档入库（标准动作，v1.1）** | 含危险模式文本的夹具（漏洞样本/prompt 注入/凭据伪造等）禁止明文入库——Mimosa 仓库扫描会将其当真实漏洞强制拦截 commit（AS-2-security D-7：散装 .py 拦截 5 high/1 low，恰证明引擎检测力但属测试数据误报）。标准动作：**tar.gz 归档入库（字节级证据 + sha256 落账）+ README 记录解包重放命令**（AS-2-security：`tar xzf fixture-*.tar.gz && semgrep --config <ruleset> --lang python <member>`；AS-2-sentinel 复制先例：双夹具 tar 归档 + README 记 `skill-scanner scan <目录> --format json`）。sha256 指针用结构化 schema `{archive, member, sha256}`（REMEDIATION-1 F-017 口径），全部证据 JSON 与人类文档指向同一 schema |
| 3b | **影子跑夹具升为双夹具（恶意 + 良性对照，v1.1）** | 安全类引擎替换的标准夹具形态 = 恶意 canonical 夹具（验检出力）+ 良性对照夹具（验误报控制）各一（AS-2-sentinel 双夹具实战；单夹具只测检出不测误报，良性包误报是 forbidden 四类之外的高频失败类目）。差异表（#4）同步增列 **benign_false_positive forbidden 类**（良性输入威胁检出 > 0 = FAIL）与 nondeterminism_asymmetry accepted 类（按 AS-2-security 先例：旧侧多次运行取并集记波动、新侧加确定性断言） |
| 4 | **差异表定稿（先于影子跑）** | `expected-findings.json`：expected_rule_ids / min_findings / expected_severity_dist / expected_exit_code + accepted_difference 表（rule_name_changed / severity_mapping_changed / message_changed / new_findings）+ **forbidden_difference 表**（missing_detection / crash / invalid_exit_code，v3.6 增补，无论新旧引擎一律判失败；安全类替换增列 benign_false_positive——#3b）。`finalized_before_shadow_run: true` 必须显式落盘（§五.1）；影子跑前 smoke 修订留痕 amendments 字段非静默（AS-2-first D-2 / AS-2-security D-4 / AS-2-sentinel D-6 三单先例） |

### SHADOW → MIGRATING（影子跑通过 + receipt 签发）

| # | evidence_required | 说明与实例出处 |
|---|---|---|
| 5 | 影子跑 diff 消费证据 | `shadow-result.json`：同 fixture 喂新旧引擎各一次真实执行；实测 finding 数/severity 分布/exit code/规则名对照差异表逐条分类 accepted\|forbidden。**PASS 判据 = 零 forbidden_difference + expected 断言全部满足**。安全类替换按双夹具口径（#3b）逐夹具出检出断言与确定性断言。命中 forbidden → NO PROMOTION（Failure Rule 1） |
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
# 2.0 同名撞车检查（安装前必做，v1.1）：registry 包名 == 官方项目名？
#     不同名（或存疑）时，先到 official_source（github:<org>/<repo>）核对官方声明的真实包名再装。
#     反例（AS-2-sentinel D-2）：PyPI `skill-scanner`（0.3.3, MIT, thedevappsecguy）≠ 官方
#     cisco-ai-skill-scanner（Apache-2.0, github:cisco-ai-defense/skill-scanner）——装错包 = 假接入。
npm install --no-save @stoplight/spectral-cli
spectral --version
```
- **PASS**：--version 输出与期望版本一致（AS-2-first：6.16.3）；装的是 official_source 官方声明的包名。npm 假包教训：**装完必核**，package name ≠ capability。
- **FAIL**：版本不符/命令不存在/来源非 official source（github:<org>/<repo> 对应的 npm 包）/ **registry 包名与官方项目名撞车或撞名**（PyPI skill-scanner 实例：npm semgrep 假包教训的 pip 版同型）→ **NO INSTALL**，换 official source + install 通道 + runtime_test 全链重验，禁用来历不明包。package.json/package-lock 零改动（--no-save）。

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
# 5.1 影子 ruleset/检测配置（extends 官方默认或官方 policy 预设，零自造规则；AS-2-first: rulesets/spectral-oas-shadow.yaml；
#     AS-2-sentinel: skill-scanner 默认 policy 预设 balanced——detection_config 替代 ruleset 时同样零自造，指纹落差异表）
# 5.2 同 fixture 分别喂旧 adapter 与新引擎（临时 harness 在 os.tmpdir，跑完即删）；安全类替换按双夹具口径（#3b）：
#     恶意 canonical + 良性对照各跑新旧两侧
spectral lint fixtures/bad-openapi.yaml --ruleset rulesets/spectral-oas-shadow.yaml --format json > spectral-shadow-stdout.json
# 5.3 产物对照差异表逐条分类 → 落 shadow-<date>/shadow-result.json（含 DEBUG/spawn 记录、
#     comparison.diffClassification 逐条 accepted|forbidden、forbidden_verdict；原始产物以
#     artifacts 字段互链：spectral-shadow-stdout.json / old-engine-record.json）
```
- **PASS**：零 forbidden_difference（missing_detection/crash/invalid_exit_code 均未命中；安全类替换加 benign_false_positive 未命中——AS-2-sentinel 实测：恶意夹具 3/3 rule id + severity 分布==expected + 良性夹具威胁 0 条 is_safe=true）+ 实测 exit_code==expected_exit_code + expected_rule_ids 全部报出 + finding_count ≥ min_findings + severity 分布符合预期 + 双夹具各自两次运行确定性断言成立。accepted 差异（含 new_findings 全量）登记留痕。
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
| 1 | 影子跑 FAIL（含任一 forbidden_difference 命中：missing_detection/crash/invalid_exit_code；安全类替换含 benign_false_positive） | **NO PROMOTION**。FAIL 也是有效迁移证据，如实落盘后回滚即可；禁止修 fixture/降断言凑 PASS | v3.5 影子跑 Evidence Contract + v3.6 forbidden_difference；AS-2-first expected-findings.json forbidden_difference 段 |
| 2 | 回滚演练 FAIL（旧路径无法恢复可用） | **NO DROP**。回滚不了就不许删旧资产；drop（DEPRECATED→REMOVED）前置证据 18 不成立 | 契约 §一 DEPRECATED→REMOVED + Gate-5 rollback proof（v3.3 采纳）；AS-2-first rollback-drill.json s2 |
| 3 | Provider identity 三件套（official source / install 通道 / runtime_test）缺一 | **NO INSTALL**。package name ≠ capability（npm semgrep 假包教训；pip 版同型撞车：PyPI `skill-scanner` 0.3.3 MIT ≠ 官方 cisco-ai-skill-scanner——**包名 ≠ 官方项目名时必查官方 repo 的 install 通道**，AS-2-sentinel D-2）；装后必跑 --version 核实。**NO INSTALL 分支合法产出物清单（四件，AS-2-review 实战定型）**：①NO INSTALL 裁定记录（逐候选探测证据 + 三件套缺项具名）；②状态保持 **ACTIVE**（迁移停在 SHADOW 前——无新引擎即无影子对象，ACTIVE→SHADOW 转移条件结构性不满足；**不得置 SHADOW**，无夹具无影子对象即无证据可挂）；③adapt 裁定材料（保留/绑定/再评估触发器等选项 + 触发条件，交编排者/Owner 裁定）；④**零生产写面**（不创建 adapter/不动 index.mjs/manifest/verification，未装配引擎时创建接线即假接入；**禁自研 wrapper 顶替**）——Step 3-9 按结构性不适用 BLOCKED_NO_INSTALL，不产出、不假造 | v3.4 第 1 条 + v3.5 第 2 条（provider YAML schema 并入契约）；AS-2-first RESULTS §一 2b；同名撞车 AS-2-sentinel D-2；分支产出物 AS-2-review RESULTS §一/§二 |
| 4 | 旧路径共存 | **EXPLICIT_COMPAT_MODE**：旧路径每次调用必须显式旗标（options 或 env）+ 留痕（compat/compat_via/rollback_adapter），禁静默并存；迁移期共存 ≠ 无限共存，Phase 2 一律删除旧 loader | 契约 §三 Gate-1 + v3.2 adopt；AS-2-first post-promotion-probes.json p2/p3 |

---

## 五、关键教训八条（逐条注明出处）

1. **差异表先于影子跑定稿**。accepted_difference/forbidden_difference 表在影子跑前定稿并留 finalized_before_shadow_run 标记；"新工具发现更多问题"是能力提升不是失败（旧 portman 对缺陷密集文档 0 检出 vs Spectral 9 findings，old-engine-record.json vs shadow-result.json 实证）。出处：v3.5 第 5 条 Evidence Contract；AS-2-first fixtures/expected-findings.json（finalized_at 09:41:30Z 早于影子跑 09:58:00Z）。
2. **回滚路径影子跑前验证存在**。migration-record.json `rollback_path_verified_before_shadow` 模式（verified:true + at + evidence 指向旧引擎真实 exec 产物）：先证明"工具在场可回滚"，再谈替换。出处：v3.4 第 3 条；AS-2-first migration-record.json + old-engine-record.json。
3. **hash 期望值动态化**。硬编码 hash 随合法晋升腐坏（AS-2-first 晋升使 manifest hash 从 f770140c… 变 84e2c7ab…）——任何 Gate-2 探针/断言的期望 hash 必须现场重算 sha256 再比对，禁硬编码常量（AV-3 探针 C1/C2 假 FAIL 教训：若其断言写死 hash，一次合法晋升即全部假 FAIL）。出处：AV-3 RESULTS.md §4（C1-C3 动态重算形态）+ AS-2-first RESULTS §五。
4. **门栈摊销**。全量门栈只压首个 replace；复制的三个走同一机器，证据负担机械化为 wizard 式清单（勾选+产物引用），禁四路并行 replace——否则"门的自嗨"。出处：v3.3 编排者补充声明；契约 §三门栈适用范围声明。
5. **写面声明表 + change-lock 先于动工**。同文件双写禁令（F-003 并行双写教训：EX-1/ON-1 双写 executor-setup.mjs 致游离 if 块）；锁是建议性的，真强制力=派发拒发+收口 diff 归属核查，但 acquire/list 机检面必须先走。出处：execution-plan §并行写面纪律 + v3.1 change-lock adopt 降级；preflight.mjs P7。
6. **（v1.1）registry 包名 ≠ 官方项目名时必查官方 repo 的 install 通道**。同名撞车是 npm 假包教训的跨生态同型缺陷：PyPI `skill-scanner`（0.3.3, MIT, 第三方）与官方 cisco-ai-skill-scanner（Apache-2.0, github:cisco-ai-defense/skill-scanner）并存，`pip install skill-scanner` 会静默装到错误项目并"通过" --version 核验（版本号语义完全不同）——provider identity 三件套的官方包名核对必须**前置到 install 命令之前**，而非装后核对版本。出处：AS-2-sentinel RESULTS §一 Step 2 / §二 D-2；plans/autopilot-ledger-20260921.md D-7 同源教训（安全夹具被扫描器拦截属另一 D-7 编号，勿混淆）。
7. **（v1.1）安全扫描器替换的误报面与检出面同等重要——双夹具影子跑**。单恶意夹具只能证明"该报的报了"，不能证明"不该报的没报"；良性包误报（benign_false_positive）会阻塞正常工作流，是 missing_detection/crash/invalid_exit_code 之外的高频失败类目。标准动作：恶意 canonical + 良性对照双夹具，差异表显式增列 benign_false_positive forbidden 类 + nondeterminism_asymmetry accepted 类（旧侧 LLM 非确定性取并集记波动、新侧确定性断言）。出处：AS-2-sentinel RESULTS §三（良性夹具威胁 0 条 is_safe=true 为本单关键判据）+ §一 Step 4/5。
8. **（v1.1）危险文本夹具 tar 归档入库 + 重放命令落 README**。漏洞/注入类夹具的明文入库会被仓库扫描器当真实漏洞强制拦截（结构性冲突，非执行失误）；标准动作 = tar.gz 归档（字节级证据 + sha256 落账，结构化指针 `{archive, member, sha256}`）+ README 记录解包重放命令（如 `--lang python` 重放）。出处：AS-2-security D-7（vulnerable_app.py 拦截 5 high/1 low 后归档）+ fixtures/README.md；AS-2-sentinel fixtures/README.md 复制先例；REMEDIATION-1 F-017 结构化 schema 口径。

---

## 六、复制阶段 wizard 式清单（其余三个 replace 用；逐项勾选+产物引用，不再逐项重新论证）

> ⚠️ 2026-09-25 增补（第十审计 F-004/F-003/F-005）：①Step 9 增列"**晋升前**回归/validate 快照"勾选项——晋升后全绿不补偿归因，缺失即记 DEVIATED 不得 [x]（AS-2-security D-5 实证改记）；②改存/归档夹具后必须**重绑定全部持久证据指针**（migration-record/shadow-result/expected-findings 的 fixture 路径 → 新 URI+完整 sha256，AS-2-security 漏改 5 处实证）；③**能力收缩必须显式登记**——旧引擎能力 ⊄ 新引擎时：adapter 拒绝超范围目标（命名错误码）+ manifest when_not_to_use 增列 + deviations 记 capability narrowed（AS-2-security：Python-only ruleset 替代多语言+gitleaks 未登记即假绿风险，adapter 已加 SCOPE_LANGUAGE_UNSUPPORTED 守门）

前置确认：① AS-2-first 的 D-3 receipt 已由 Owner 关账；② L2 已复核 AS-2-first migration-record；③ 本 Playbook 已按复制实例反向校验（v3.4 第 4 条）。

- [ ] Step 0 锁：change-lock acquire × 改动文件，list 确认（产物：锁记录；NO INSTALL 分支可收窄为仅锁证据 record——AS-2-review D-2 先例）
- [ ] Step 1 baseline 行核对 + preflight 7 PASS（产物：preflight 输出留档）
- [ ] Step 2 安装 + --version 三件套（产物：版本记录）；**安装前同名撞车检查**（registry 包名 == 官方项目名？不同名先查官方 repo 真实包名——AS-2-sentinel D-2）
- [ ] Step 3 旧引擎实测 + rollback_path_verified_before_shadow（产物：old-engine-record.json）
- [ ] Step 4 差异表定稿 finalized_before_shadow_run=true（产物：expected-findings.json）；**安全类替换用双夹具**（恶意 canonical + 良性对照，#3b）+ benign_false_positive forbidden 类增列
- [ ] Step 5 shadow-result.json 零 forbidden（产物 + 断言勾选；安全类替换逐夹具出检出+误报断言）
- [ ] Step 6 rollback-drill.json 三场景全过 + 现场还原（产物 + spectral_restored 勾选）
- [ ] Step 7 adapter ≤150 行 + ruleset 固化 + sidecar verification + manifest-build 新 hash（产物：hash 值）
- [ ] Step 8 eligible=true + Gate-2 日志 hash 相等 + 四探针（产物：post-promotion-probes.json）
- [ ] Step 9 回归三件晋升前后双绿（产物：输出留档）+ migration-record.json five_tuple + deviations 登记
- [ ] 交 L2 复核，receipt Owner 签收位回填

### §六-B NO INSTALL 分支 wizard 清单（两候选/三件套缺一即走本分支；AS-2-review 实战定型，v1.1）

> Failure Rule 3 命中后的合法动作面（**不得假造后续步骤、不得自研 wrapper 顶替**）；单据：`test-reports/autopilot-work/AS-2-review/RESULTS.md` + migration-record.json no_install_verdict。

- [ ] **逐候选探测证据落盘**：每候选一条探测记录（命令 + 实测输出 + 三件套缺项具名：official_source 缺 / install_channel 缺 / runtime_test 不可行）（产物：step2-probe-*.txt + step2-no-install-record.md）
- [ ] **NO INSTALL 裁定记录**：候选对比表 + Failure Rule 3 命中结论落 migration-record.json no_install_verdict
- [ ] **状态保持 ACTIVE（不得置 SHADOW）**：ACTIVE→SHADOW 转移条件 = 影子跑夹具就位，无新引擎即无影子对象，结构性不满足（migration-record current_state=ACTIVE）
- [ ] **adapt 裁定材料**：推荐选项 + 可叠加选项 + 未来再评估触发器（引擎可安装/CLI 发布等客观条件）+ Owner 应知悉代价，交编排者/Owner（产物：adaptation-adjudication.md）
- [ ] **零生产写面确认**：scripts/lib/adapters/ 零新增零修改、index.mjs/manifest/verification 零触碰、锁面收窄为仅证据 record 并收口 release
- [ ] **Step 3-9 显式 BLOCKED_NO_INSTALL 登记**（不产出、不假造）+ 开工/收口回归三件 + manifest hash 零漂移机证（开工 sha256 == 收口 sha256）

### §六-A drop 阶段 wizard 清单（DEPRECATED→REMOVED，AS-1 批 1 第三波实测回写 2026-09-25）

> 首个 drop 实例（7 资产合并单）按 §二 #15-18 证据要求走通的 wizard 形态；后续 drop 复制本清单。
> 单据：`contracts/discrepancies/cr-20260925T102900Z-as1-drop7.json`（CONTRACT 类，Owner PENDING）；
> 逐处 diff 摘要与偏差登记：`test-reports/autopilot-work/AS-1/RESULTS.md`。

- [x] **drop 三条件核对**（#15）：candidate（CLUSTERS/manifest 16 行在册）+ runtime invocation（连续两轮盲行零调用）+ quality（评审结论=零调用+外部等价物覆盖）——逐资产记录于 change.record dropTriple
- [x] **drop_allowed 放行依据显式落账**（#16）：编排者派单（handoffs/v3/AS-1-dispatch.md）显式列名 7 资产=放行；preflight P6 全程 8 PASS 零违例；旗标位未做中间态置位（行随删除不存续，意图+放行记录于 change.record——口径登记偏差 D-6/单内 dropReceipt.dropAllowed）
- [x] **6 处联动改 + 收口核查**（#17）：①SKILL.md 指针表（实测 0 行可删，偏差 D-4）②CLUSTERS candidates/phases/preconditions（19→9，禁止留空引用）③validate-structure 16→9 ④content.js 重建（9 卡片）⑤config.example.json ⑥adapters/index.mjs 核对（零注册）+ PHASE2 14→8 行 + kickoff 清单同步 + manifest 行数 16→9
- [x] **回滚演练记录在案**（#18）：change.record 即 tombstone（git revert 可回滚；vendor 用文件系统删除、git 收口归编排者）+ Gate-0 基线 7 资产行在册——回滚路径可还原
- [x] **逐资产 drop + 每 drop preflight**：7 轮（vendor 目录+sidecar 同删），每轮 preflight 8 PASS/0 FAIL/0 SKIP
- [x] **S15 迁移不变量段实装 + 六断言全绿**：A1 引用 0 命中（治理活面 169 文件）／A2 三 replace 引擎真实消费探针／A3 manifest 路由断言（Gate-2 三方 hash + eligible 9 true/7 false）／A4 legacy loader 不可达／A5 真实执行≠能力覆盖／A6 correction≠作废
- [x] **S15 注入反例 ×5 全 FAIL 具名 + 现场还原**（孤儿引用/引擎缺席/孤儿 sidecar/drop 资产复活/记录篡改，s15-injection-result.log）
- [x] **回归三件全绿**：regression 20 PASS/0 FAIL（14 段+S15 六断言）+ preflight 8 PASS/0 FAIL/0 SKIP + validate-structure 0 警告（drop 前基线同样全绿留档）
- [ ] **Owner 签收 drop 单**（cr-20260925T102900Z-as1-drop7.json 签收位 PENDING）+ L2 复核偏差 D-1~D-8

## 七、使用后回写

每次用本 Playbook 执行 replace 后：偏差登记入该单 migration-record.json deviations；Playbook 本身的修订（写了没做/做了没写）双向回写本文并在此追加修订记录行。修订记录历史见下节与本单自测目录 `test-reports/autopilot-work/PLAYBOOK-1/`（复制单实战回写样例另见 `test-reports/autopilot-work/PB-WRITEBACK/`——v1.1 三单经验沉淀）。

### 修订记录

| 日期 | 版本 | 修订 | 依据 |
|---|---|---|---|
| 2026-09-25 | 1.0.0 | 首版蒸馏 + 回溯自测双向修订（A 向 1 条 + B 向 4 条，起草期另吸收 5 条备考；明细见 01-selftest-matrix.md 与 03-revisions.md） | AS-2-first 全证据逐条对照 |
| 2026-09-25 | 1.0.0 | R1 Step 0 措辞校准（change-lock 该单无留痕，出处改为 CLI+契约） / R2 转移 at+sourceEvidence 显式化 / R3 接口面扩张登记（D-4） / R4 shadow 产物互链形态 | 自测 01-selftest-matrix.md |
| 2026-09-25 | 1.1.0 | **PB-WRITEBACK 三单实战回写（四条经验，§六 2026-09-25 增补块已先行铺底）**：①同名撞车检查——§一 YAML 头 name_collision_check 字段 + §三 Step 2.0 前置检查 + §四 Rule 3 增补 + §五教训 6（AS-2-sentinel D-2：PyPI skill-scanner 0.3.3 MIT ≠ 官方 cisco-ai-skill-scanner，npm 假包 pip 版实例）；②NO INSTALL 分支产出物清单——§四 Rule 3 增补四件合法产出（裁定记录/ACTIVE 保持/adapt 材料/零生产写面）+ 新增 §六-B 分支 wizard 清单（AS-2-review RESULTS §一/§二 + migration-record no_install_verdict）；③漏洞夹具归档标准动作——§二 #3a tar 归档+sha256 结构化指针+README 重放命令（AS-2-security D-7 + fixtures/README --lang python 重放；AS-2-sentinel fixtures/ 复制先例；REMEDIATION-1 F-017 schema 口径）；④双夹具影子跑升标准——§二 #3b/4/5 恶意+良性对照 + benign_false_positive forbidden 类 + nondeterminism_asymmetry accepted 类 + §三 Step 5 双夹具口径 + §五教训 7（AS-2-sentinel §三 双夹具对照表；安全类替换适用）。另：§五增补教训 8（危险文本夹具归档）。不新增状态机——全部条目映射契约既有六态与五条合法转移 | PB-WRITEBACK-dispatch；AS-2-sentinel/AS-2-review/AS-2-security 三单 RESULTS + migration-record 实测交叉核对（矩阵：test-reports/autopilot-work/PB-WRITEBACK/01-crosscheck-matrix.md）；回归三件实测（regression 22 项/preflight 8/validate 0） |
