# AS-2-security RESULTS — security(prompt-backend)→security(semgrep) 迁移（Playbook §六 首个复制单）

> 执行：autopilot L1（AS-2-security-dispatch，严格照 plans/asset-migration-playbook.md §六 wizard）｜日期：2026-09-25
> 契约权威：contracts/asset-migration.md（asset-migration@1.0.0）｜状态：**PRIMARY**（receipt Owner 签收位 PENDING，见偏差 D-3）
> 本文档不自称 DONE——L2/Owner 复核后方可关账。

## 一、Playbook §六 wizard 逐项勾选

- [x] **Step 0 锁**：change-lock acquire × 4 写面（security-semgrep.mjs / index.mjs / vendor/security/rulesets / manifest-sources/security.yaml）exit 0，list 确认 ACTIVE；收口后 release × 4 OK（产物：plans/change-lock.json 锁记录）
- [x] **Step 1 baseline 行核对 + preflight**：asset-baseline-before.json#security 四面核对（adapter=prompt / routes T2_BACKEND,T4_FRONTEND,T5_OPS / consumption S8链内,BW零现 / vendor vendor/security，snapshot 2026-09-24T08:45:39Z）；preflight 晋升前 **8 PASS / 0 FAIL / 0 SKIP**（输出留档于本文 §四）
- [x] **Step 2 安装 + --version 三件套**：`pip install semgrep` 成功 → `semgrep --version` = **1.175.0**（PASS，NO INSTALL 门**未触发**）；provider identity 三件套：official_source=github:semgrep/semgrep / install_channel=pip（npm semgrep ISC 假包禁用——AS-0 教训沿用）/ runtime_test=semgrep --version 实测；许可补核（AS-0 未覆盖项强制补齐）：**LGPL-2.1-or-later**（pip License-Expression + sdist LICENSE 全文实测），CLI spawn 形态使用无链接；ruleset **自研 6 规则**零 registry 依赖、零许可风险（官方 registry ruleset 未使用，无需其许可核查）
- [x] **Step 3 旧引擎实测 + rollback_path_verified_before_shadow**：PROMPT_ADAPTER 3 次真实 run()（临时 harness 在 os.tmpdir，跑完即删）ok=true exit 0，brief sha256 三次全同（45d3ade4…）——`shadow-20260925/old-engine-record.json` verified=true（**影子跑前**）
- [x] **Step 4 差异表定稿**：`fixtures/expected-findings.json` finalized_before_shadow_run=true（05:30:00Z 早于官方影子跑）；含本单特有的 **nondeterminism_asymmetry** accepted 差异类（LLM 非确定性 vs semgrep 确定性的结构性适配：旧侧多次运行取并集记录波动、新侧加确定性断言）+ forbidden 三类（missing_detection/crash/invalid_exit_code，exit 语义按 semgrep 实测口径重写非硬搬 spectral）；两条影子跑前 smoke 修订留痕 amendments（D-4）
- [x] **Step 5 影子跑零 forbidden**：`shadow-20260925/shadow-result.json`——6/6 expected_rule_ids 全报、severity {error:3,warning:3}==expected、exit 0==expected、确定性断言成立（两次独立运行 findings 集合逐条相同）、零 forbidden_difference
- [x] **Step 6 回滚三场景 + 现场还原**：`shadow-20260925/rollback-drill.json` 三场景 PASS；PATH 注入形态零文件改动，注入后 semgrep --version=1.175.0 复验（现场还原=true）
- [x] **Step 7 adapter ≤150 行 + ruleset 固化 + sidecar verification + manifest-build 新 hash**：security-semgrep.mjs **91 行**；index.mjs 仅 security 注册行（ADAPTERS.set('security', securitySemgrep)）；vendor/security/rulesets/security-local-rules.yaml（semgrep --validate 0 错误 6 规则，body 与影子跑定稿版逐行一致）；security.yaml verification 更新（三件套）；manifest-build exit 0 → 新 hash **89584585cbbf64d9edc08cdcd2f3499c325ab6da56a11d5a013ccb098385d68f**
- [x] **Step 8 eligible=true + Gate-2 日志 hash 相等 + 四探针**：eligible.mjs --asset security → eligible=true；真实 dispatch 日志 `[tt] Gate-2 manifest_sha256=89584585…` == build hash == python 现场重算 sha256（三方机验，期望值动态重算）；`shadow-20260925/post-promotion-probes.json` p1 正常路径 ✓ / p2 无旗标拒绝（Gate-1）✓ / p3 EXPLICIT_COMPAT_MODE env 形态回滚可用+留痕 ✓ / p4 现场还原 ✓
- [**DEVIATED (D-5)**] **Step 9 回归三件 + 五元组 + deviations**：见 §四（**晋升前快照缺失 D-5——第十一审计 F-016 纠正：原 [x] 勾选作废，DEVIATED≠PASS**）；migration-record.json 五元组齐备 + 6 条 deviations；change.record 已按派单第 9 条创建（Owner PENDING）
- [x] **交 L2 复核**：本 RESULTS.md + migration-record.json + cr-20260925T063000Z-as2sec-promotion.json（Owner 签收位待回填）

前置确认（Playbook §六 头三条）：① AS-2-first D-3 receipt 由 Owner 关账——本单未见关账留痕，按派单放行执行（L1 依派单授权）；② L2 复核 AS-2-first——同上依派单；③ Playbook 反向校验——按 v1.0.0 文面执行。此项留 L2 一并核。

## 二、NO INSTALL 门结果

**PASS（未触发）**：pip install semgrep exit 0；semgrep --version = 1.175.0（exit 0）；来源三件套核实（github:semgrep/semgrep 官方 / pip 通道 / 装后运行时验证）。npm semgrep 假包路径未触碰。

## 三、影子跑对照摘要（不对称适配）

| 维度 | 旧引擎 security(prompt-backend) | 新引擎 security(semgrep 1.175.0) | 分类 |
|---|---|---|---|
| 可机验检出 | brief 层零确定性检出承诺（3 run brief sha256 全同，波动=0；LLM 发现层无宿主不可机验——D-2 如实登记） | 6 findings（六类确定性缺陷全报） | accepted（new_findings，6 条全登记交 L2/Owner） |
| 规则名 | LLM 自由文本无规则名 | 自研 rule id ×6（security.* 命名空间） | accepted（rule_name_changed） |
| severity | 中文定级自由文本 | ERROR 3 / WARNING 3（==expected） | accepted（severity_mapping_changed：有 error 级→pass=false） |
| exit code | adapter ok=true | 0（==expected_exit_code 0，semgrep 默认模式语义） | accepted（message/语义面） |
| 确定性 | 非确定性输出形态（结构性） | 两次独立运行 findings 集合逐条相同 | accepted（nondeterminism_asymmetry，本单特有） |
| missing_detection / crash / invalid_exit_code | — | 均**未命中** | **forbidden 零命中 → PASS** |

## 四、回滚三场景 + hash 绑定 + 回归三件

- **回滚三场景**（rollback-drill.json）：s1 正常路径 6 findings PASS；s2 binary missing（PATH 剥离）→ 无旗标拒绝（Gate-1）/ EXPLICIT_COMPAT_MODE（options+env 双形态）回滚 prompt-backend 可用且 compat/compat_via/rollback_adapter 留痕 PASS；s3 假引擎垃圾输出 → SEMGREP_OUTPUT_INVALID receipt failure 不静默 PASS。
- **新 manifest hash**：sha256(asset-manifest-v2.json) = **89584585cbbf64d9edc08cdcd2f3499c325ab6da56a11d5a013ccb098385d68f**（旧 84e2c7ab…，verification 更新后合法晋升产物）；EX-1/AV-3 零改动（runtime 门控 manifest 现值驱动），Gate-2 绑定三方机验。
- **回归三件**：
  - 晋升前：preflight **8 PASS / 0 FAIL / 0 SKIP**；regression-all 与 validate-structure 晋升前快照**缺失**（执行顺序失误，如实登记 D-5——补偿：change-lock 全程唯一写者无并行改动 + 晋升后全绿）
  - 晋升后：regression-all **14 PASS / 0 FAIL**（S8 PASS：走 --backend prompt 显式面不经专用 adapter，专用 adapter 注册零影响；S14 PASS），preflight **8 PASS / 0 FAIL / 0 SKIP**，validate-structure **0 警告**
- **五元组**（migration-record.json five_tuple）：old_asset / new_asset / shadow_result / promotion_receipt / runtime_binding 五字段齐备，证据可回查。

## 五、偏差登记（6 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| D-1 | 夹具按派单落本单目录（契约 §五 tmpdir 口径冲突，取派单；临时 harness/candidate/ws 均已删） | 登记待 L2 |
| D-2 | 旧引擎 LLM 发现层本机无宿主不可机验——brief 层波动=0 如实登记，差异表按『无确定性检出承诺』口径适配 | 登记待 L2 |
| D-3 | promotion receipt approvedBy=PENDING（Owner 签收不归 L1 代签）；change.record 已按派单创建，签收回填归 Owner | 待 Owner |
| D-4 | expected-findings 两条影子跑前 smoke 修订（semgrep metavariable-regex re.match 语义；expected_exit_code 0），amendments 留痕非静默 | 登记待 L2 |
| D-5 | 回归三件晋升前仅 preflight 捕获；regression/validate 晋升前快照缺失（执行顺序失误，不可复原原态，如实登记；晋升后三件全绿补偿） | 登记待 L2 |
| D-6 | semgrep OSS 未登录态 fingerprint/lines 为登录墙字段——核心检出字段完整，adapter 仅依赖核心字段，备查非阻断 | 备查 |

## 六、产物索引

- 迁移记录：test-reports/autopilot-work/AS-2-security/migration-record.json
- 夹具+差异表：test-reports/autopilot-work/AS-2-security/fixtures/（fixture-vulnerable_app-evidence.tar.gz!/vulnerable_app.py，sha256=1177efe8b000f69f2decc09ccbc64d4a7b42990a79e8ae1fa729f9df204c49cf——指针重绑定结构化 schema {archive, member, sha256}，见 migration-record.json shadow_result.fixture / security-local-rules.yaml / expected-findings.json）
- 影子证据：test-reports/autopilot-work/AS-2-security/shadow-20260925/（13 件）
- change.record：contracts/discrepancies/cr-20260925T063000Z-as2sec-promotion.json（CONTRACT 类，Owner PENDING）
- 写面：scripts/lib/adapters/security-semgrep.mjs（新建 91 行）、scripts/lib/adapters/index.mjs（security 注册行）、vendor/security/rulesets/security-local-rules.yaml（新建）、contracts/manifest-sources/security.yaml（verification）
- 未动：vendor/security/SKILL.md 等既有 vendor 文件一字未改（旧方法论文档保留，路由换引擎≠删方法论）；禁改面零触碰；禁 git 遵守

## 七、REMEDIATION-1 增补段（第十一审计五项闭环，2026-09-25）

> 本段为 REMEDIATION-1 批（handoffs/v3/REMEDIATION-1-dispatch.md）对本迁移记录的增量修订；§一~§六为晋升时点历史记录不回写。

- **F-011 scanTarget 生产链 + 真实 caller E2E（P0）**：security-semgrep.mjs 现为 **110 行**——解析链尾部默认目标=workspace 本身（options.scanTarget || subtask.scanTarget || 文件型 contract || options.workspace）；语言守门放宽为**文件级**（F-011：显式非 Python 文件目标 → SCOPE_LANGUAGE_UNSUPPORTED 拒绝；目录目标放行，0 findings 属真实扫描结果如实记录）。E2E 探针（真实 dispatch() auto 路径、planner 形态自然语言 contract 无 scanTarget）**all_pass=true**：正向（canonical 夹具 sha256=1177efe8… 实测一致）semgrep 1.175.0 真实执行 6 findings 全命中/pass=false/mode=exec；反向空 workspace 真实扫描 0 findings pass=true + scanned_path=workspace 证据。产物：test-reports/autopilot-work/REMEDIATION-1/（f011-e2e-probe.mjs / f011-e2e-probe-result.json / e2e-pos-security-result.json / e2e-neg-security-result.json / f011-e2e-probe-stdout.log）。runtime.mjs **零改动**（workspace 经 execOpts→dispatch→adapter.run 已透明，无需透传改动；EX-1 能力门控段与 AV-3 资格门段零触碰）。
- **F-014 capability narrowed 三件套（P1）**：①security.yaml when_not_to_use 增列非 Python 目标能力收缩登记；②manifest-build 重跑 exit 0（16 行）→ 新 hash **3c0e7df0305f70c5f0ef38898557b4650ce3674466c46657942c052dbf729903**（旧晋升时点 89584585… 留档不回写，见 migration-record.json manifest_hash_sync_remediation1；构建打印+python 现场重算双一致：f014-manifest-build.log）；③migration-record.json deviations 追加 **D-8**（旧引擎声明多语言+gitleaks → 新引擎 Python-only 显式收缩，扩规列 backlog）。
- **F-015 promotion receipt 重签（P1）**：新单 **cr-20260925T130000Z-as2sec-promotion-r2.json**（SUPERSEDES cr-20260925T063000Z，绑定当前 110 行 adapter + 第十/十一轮全部整改事实 + 当前 hash 3c0e7df0…，deviations D-1..D-8 合并，Owner 签收位 PENDING）；旧单加 `supersededBy` 指向新单（不删，历史留痕）。
- **F-017 证据指针重绑定补全 + 结构化 schema（P1）**：RESULTS.md §六夹具描述与 migration-record.json ACTIVE→SHADOW sourceEvidence 的 vulnerable_app.py 裸指针补全为 tar member 引用；三份 JSON（migration-record.json / expected-findings.json / shadow-result.json）的 `[REBOUND …]` 字符串后缀全部替换为结构化对象 `{archive, member, sha256}`（保留 note 字段）；fixtures/README.md 同步结构化口径。
- **回归三件（REMEDIATION-1 后，产物留档 REMEDIATION-1/）**：regression-all **14 PASS / 0 FAIL**（S8 走 --backend prompt 显式面 PASS；S14 PASS）；preflight **8 PASS / 0 FAIL / 0 SKIP**；validate-structure **0 警告**。E2E 探针复跑对新 manifest hash（Gate-2=3c0e7df0…）仍 all_pass=true。
- 本段不自称 DONE——r2 单 Owner 签收与 L2 复核待关账。
