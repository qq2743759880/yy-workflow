# PLAYBOOK-1 Step③ 回溯自测矩阵（把 Playbook 当"重来一次 be-validator→Spectral"的手册，逐条对照 AS-2-first 真实证据）

基准证据：`test-reports/autopilot-work/AS-2-first/`（RESULTS.md、migration-record.json、fixtures/ 3 件、rulesets/ 1 件、shadow-20260924/ 8 件）。
判读口径：**A 向** = Playbook 写了但 AS-2-first 实际没做/证据不支持 → 删或改；**B 向** = AS-2-first 做了但 Playbook 漏写 → 补。逐条给出证据对应物路径。

## 逐条对照（Playbook 要求 → 真实证据对应物）

| Playbook 条目 | AS-2-first 证据对应物 | 判定 |
|---|---|---|
| §二.1 Gate-0 baseline 行 | asset-baseline-before.json#be-validator（migration-record old_asset.baseline_ref，snapshot 08:45:39Z） | ✓ 对应 |
| §二.2 写面声明+change-lock | **A向发现 R1**：AS-2-first 全部报告/记录中无 change-lock acquire 留痕；plans/change-lock.json locks=[]。锁要求本身成立（契约 §六 + F-003 纪律），但 Playbook 不得谎称"该单实际执行过" | 改（R1） |
| §二.3 夹具（canonical+孪生+tmpdir 纪律） | fixtures/bad-openapi.yaml + bad-openapi.json（expected-findings.json twin_reason：旧 adapter 契约门只认 .json）；migration-record rollback_drill.candidate_writing = os.tmpdir as2root 镜像布局跑完即删（契约 §五.2） | ✓ 对应 |
| §二.4 差异表先定稿 | fixtures/expected-findings.json：finalized_before_shadow_run=true、finalized_at 09:41:30Z < 影子跑 09:58:00Z；accepted 四类 + forbidden 三类齐全 | ✓ 对应 |
| §二.5-7 影子跑证据三件（diff/runtime invocation/baseline 对照） | shadow-result.json：comparison（finding_count 0→9、severity_dist、exit_code、rule_ids、forbidden_checks、forbidden_verdict、diffClassification）+ DEBUG spawn 记录 + baseline_comparison 字段 | ✓ 对应 |
| §二.8 回滚路径前置验证 | migration-record.rollback_path_verified_before_shadow（verified:true，at 09:40:55Z，evidence=old-engine-record.json portman 1.35.0 real exec） | ✓ 对应 |
| §二.9 receipt（Owner 签收位） | promotion_receipt apr-20260924T103500Z-as2first-promotion，approvedBy=PENDING（D-3，决策权纪律）；CONTRACT 类 change 单归 L2 | ✓ 对应 |
| §二.10 Gate-1 | post-promotion-probes.json p2_legacy_blocked（无旗标拒绝）+ p3_compat_env（env 旗标回滚可用，compat/compat_via/rollback_adapter 留痕）；rollback-drill s2a/s2b | ✓ 对应 |
| §二.11 Gate-2 | runtime_binding.consumed_hash==build_hash==84e2c7ab…；eligible.mjs --asset be-validator → true；dispatch 日志 Gate-2 manifest_sha256 相等；旧 hash f770140c→新 hash（AV-3 RESULTS §4 C1 动态重算形态） | ✓ 对应 |
| §二.12 五元组 | migration-record.five_tuple 五字段齐备 | ✓ 对应 |
| §二.13 Traffic Switch 允许 no-op | migration-record MIGRATING→PRIMARY sourceEvidence 第三条：CLUSTERS candidates 无需切换（簇归属不变），切换=adapter 引擎替换 | ✓ 对应（Playbook 初稿即按此写实，未照抄契约"完成切换"字面） |
| §二.14 new_findings 登记 | migration-record.new_findings_registry 8 规则 9 条逐条登记 | ✓ 对应 |
| §二.15-18 drop 面 | 契约 §四/P6/6 处联动；AS-2-first 未到 drop 阶段（be-validator 未 DEPRECATED）——Playbook 该四条按契约转写，无实例对应，如实标注为契约转写非实例蒸馏 | ✓ 契约转写（标注） |
| Step 2 安装+--version | RESULTS §一 2b：npm install --no-save @stoplight/spectral-cli → 6.16.3；package.json/package-lock 零改动 | ✓ 对应 |
| Step 3 旧引擎实测含 YAML 降级 | old-engine-record.json（.json：0 findings pass=true）+ old-engine-record-yaml.json（.yaml：pass=null degraded=true） | ✓ 对应 |
| Step 4 smoke 修订留痕 | **B向补写 R5（起草时已吸收，登记备考）**：D-2——expected_rule_ids 依 Step 2b smoke 修订（openapi-tags recommended:false 移除、operation-tags 补入），amendments 留痕非静默改门 | 补（起草时） |
| Step 5 产物互链 | **B向补写 R4**：shadow-result.json artifacts 字段互链 spectral-shadow-stdout.json / old-engine-record.json；comparison.diffClassification / forbidden_verdict 字段名实测在案 | 补（R4） |
| Step 6 三场景 + 现场还原 | rollback-drill.json results：s1_yaml/s1_json/s2a_no_flag/s2b_explicit_compat/s3_output_anomaly/checks；migration-record injection_cleanup spectral_restored=true | ✓ 对应 |
| Step 7 promotion 动作链 | RESULTS §一 2e：adapter 112 行 ≤150、旧逻辑 EXPLICIT_COMPAT_MODE 后、ruleset 固化 vendor/be-validator/rulesets/、sidecar verification 更新、manifest 重跑 | ✓ 对应 |
| Step 7 接口面扩张登记 | **B向补写 R3**：D-4——.json 契约面扩到 .json/.yaml/.yml 登记为能力提升面偏差；初稿漏此条 | 补（R3） |
| Step 8 四探针 | post-promotion-probes.json p1/p2/p3 + spectral 现场还原 | ✓ 对应 |
| Step 9 回归三件 + S8 判定 | RESULTS §五：晋升前后 regression-all 14 PASS、preflight 7 PASS、validate 0 警告；S8 --backend prompt 不经专用 adapter 实测裁定 | ✓ 对应 |
| Step 9 转移时间戳形态 | **B向补写 R2**：migration-record state_machine.transitions 每条含 at + sourceEvidence[]；初稿只写 sourceEvidence | 补（R2） |
| §四 Failure Rules 四条 | 1→shadow-result forbidden_checks/expected-findings forbidden_difference；2→rollback-drill s2 + 契约 Gate-5；3→RESULTS 2b npm 假包教训；4→p2/p3 + 契约 Gate-1 | ✓ 四条全有实证或契约出处 |
| §五 教训五条出处 | 1→expected-findings 时间戳+双 record；2→rollback_path_verified_before_shadow；3→AV-3 RESULTS §4 C1/C3 + f770140c→84e2c7ab；4→v3.3 编排者补充+契约 §三声明；5→F-003+execution-plan 写面纪律 | ✓ 出处可回查 |

## A 向（写了没做/证据不支持）汇总
- **R1**：change-lock acquire 步骤在 AS-2-first 无留痕（唯一 A 向命中）。处置：保留步骤（契约 §六 要求，属复制必须走之门），但 Operator Guide 措辞改为"形态取自脚本 CLI 头注与契约 §六"，不谎称实例执行过；缺口本身登记备考。

## B 向（做了没写）汇总
- **R2**：状态转移须含 at 时间戳（migration-record state_machine 形态）。
- **R3**：接口面扩张（.json→.json/.yaml/.yml）须登记 deviations（D-4 先例）。
- **R4**：shadow 产物互链形态（artifacts 字段、diffClassification/forbidden_verdict 字段名）。
- **R5**：官方影子跑前 smoke + expected_rule_ids 修订留痕 amendments（D-2 先例）。
- （起草时已吸收、登记备考）孪生 fixture 及理由、post-promotion 四探针、receipt Owner PENDING 纪律、tmpdir 临时接线 vs 证据落盘区分（D-1）、new_findings_registry。

## 结论
A 向 1 条、B 向 4 条修订已回写 Playbook（R1-R4 编号内嵌于正文）；另 5 条起草期吸收项留此备考。Playbook 每条要求均可在 AS-2-first 证据或契约中找到对应物；无凭空新增的门。
