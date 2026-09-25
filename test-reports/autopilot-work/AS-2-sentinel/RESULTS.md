# AS-2-sentinel RESULTS — skill-sentinel(prompt-backend)→skill-sentinel(skill-scanner 2.1.0) 迁移（Playbook §六 复制单 #2）

> 执行：autopilot L1（AS-2-sentinel-dispatch，严格照 plans/asset-migration-playbook.md §六 wizard）｜日期：2026-09-25
> 契约权威：contracts/asset-migration.md（asset-migration@1.0.0）｜状态：**SHADOW-HOLD（第十二审计 F-020 状态归一：原 MIGRATING 记录系未授权 transition，已作废）**（第十审计 F-001：contract Owner 签收位 PENDING 不得作为 replace 放行依据；编排者指令 Step 7-9 冻结，待 Owner 签收四张 PENDING receipt 后统一放行）
> 本文档不自称 DONE——L2/Owner 复核 + receipt 签收后方可推进 PRIMARY。

## 〇、晋升 HOLD（编排者 2026-09-25 指令）

- **Step 0-6 证据照常落盘完成**（证据收集不受 HOLD 影响）；**Step 7/8/9 冻结**：adapter 未写入 scripts/lib/adapters/、index.mjs 未动、skill-sentinel.yaml 未动、manifest-build 未重跑、无 Gate-2/四探针/晋升后回归、change.record cr-* 未创建。
- **生产写面零改动**：工作区 == 晋升前基线（4 锁中 3 个目标文件未触碰，仅本单证据目录新建）。
- Owner 签收 receipt 后按契约执行 SHADOW→MIGRATING→PRIMARY（原"MIGRATING→PRIMARY"表述系未授权 transition 残留，已按 F-020 纠正——MIGRATING 未曾合法达成）；本单证据无需重做。

## 一、Playbook §六 wizard 逐项勾选

- [x] **Step 0 锁**：change-lock acquire × 4 写面（scripts/lib/adapters/skill-scanner.mjs / index.mjs / contracts/manifest-sources/skill-sentinel.yaml / 本单 migration-record.json）exit 0，list 确认 ACTIVE（ttl 240min）；收口 release × 4（见 §五）
- [x] **Step 1 baseline 行核对 + preflight**：asset-baseline-before.json#skill-sentinel 四面核对（adapter=prompt / routes T5_OPS / consumption 机制=无,BW零现 / vendor vendor/skill-sentinel，snapshot 2026-09-24T08:45:39Z）；**晋升前三件全捕获**（v3.6 新规，D-5 教训采纳）：preflight **8 PASS / 0 FAIL / 0 SKIP** + regression-all **14 PASS / 0 FAIL** + validate-structure **0 警告**（输出留档 pre-promotion-*.txt）
- [x] **Step 2 安装 + --version 三件套**：`pip install cisco-ai-skill-scanner` exit 0 → `skill-scanner --version` = **2.1.0**（PASS，NO INSTALL 门**未触发**；hatch-vcs git 元数据问题未出现，git clone 预案未需要）；provider identity 三件套：official_source=github:cisco-ai-defense/skill-scanner（2550★）/ install_channel=pip install cisco-ai-skill-scanner / runtime_test=skill-scanner --version 实测 2.1.0；许可核：**Apache-2.0**（GitHub LICENSE 全文 Cisco Systems + pip show License 双源实测，AS-0 口径一致）；requires-python >=3.11,<3.15（本机 3.14.6 满足，AS-0 Windows 可用性推断→本单实测证实）。**★ D-2 同名撞车陷阱**：PyPI `skill-scanner`（0.3.3, MIT, thedevappsecguy）为另一项目——官方包名 = `cisco-ai-skill-scanner`（entry `skill_scanner.cli.cli:main` 与派单一致）
- [x] **Step 3 旧引擎实测 + rollback_path_verified_before_shadow**：PROMPT_ADAPTER 3 次真实 run()（临时 harness 在 os.tmpdir，跑完即删）ok=true exit 0，brief sha256 三次全同（b5000024…）——`shadow-20260925/old-engine-record.json` verified=true（**影子跑前**）
- [x] **Step 4 差异表定稿**：`fixtures/expected-findings.json` finalized_before_shadow_run=true（05:46:00Z 早于官方影子跑 05:55:00Z）；**双夹具口径**（恶意 canonical + 良性对照）+ 本单特有 **benign_false_positive** forbidden 类（派单第 3 条：误报会阻塞正常工作流）+ nondeterminism_asymmetry accepted 类（不对称适配照 AS-2-security 先例：旧侧多次运行取并集记波动，新侧加确定性断言）+ **detection_config 替代 ruleset 步骤**（默认 policy 预设 balanced 指纹 26ada30a…，零自造规则——派单第 5 条）；两条 smoke 修订留痕 amendments（D-6）
- [x] **Step 5 影子跑零 forbidden（双夹具）**：`shadow-20260925/shadow-result.json`——恶意夹具 3/3 expected_rule_ids 全报、威胁 findings 4（≥min 4）、severity {critical:1,high:1,medium:2}==expected、exit 0==expected、is_safe=false；良性夹具威胁 0 条、is_safe=true（INFO 打包提示 accepted 非误报）；双夹具确定性断言成立（各自两次运行 findings 集合逐条相同）；**零 forbidden_difference（含 benign_false_positive）→ PASS**
- [x] **Step 6 回滚三场景 + 现场还原**：`shadow-20260925/rollback-drill.json` 三场景 PASS（s1 双夹具正常路径 / s2 PATH 剥离→s2a 无旗标拒绝 Gate-1 + s2b EXPLICIT_COMPAT_MODE **options/env 双形态**回滚 prompt-backend 留痕 / s3 假引擎垃圾输出→SKILLSCANNER_OUTPUT_INVALID receipt failure 不静默）；注入后 skill-scanner --version=2.1.0 复验（现场还原=true）
- [ ] **Step 7 adapter + ruleset 固化 + sidecar verification + manifest-build 新 hash**：**HOLD**（candidate adapter 58 行已在 tmpdir 实测三场景；正式接线冻结）
- [ ] **Step 8 eligible + Gate-2 + 四探针**：**HOLD**（Gate-2 新 hash 绑定待晋升放行后动态重算——禁引用现值 89584585… 硬编码）
- [ ] **Step 9 晋升后回归三件 + 交 L2 复核**：**HOLD**（晋升前三件已捕获；本单生产写面零改动，工作区 == 晋升前基线，pre 三件即当前态实测；S8 PASS）

## 二、NO INSTALL 门结果

**PASS（未触发）**：pip install cisco-ai-skill-scanner exit 0；skill-scanner --version = 2.1.0（exit 0）；--help exit 0（entry skill_scanner.cli.cli:main）；来源三件套核实（github:cisco-ai-defense/skill-scanner 官方 / pip 通道 cisco-ai-skill-scanner / 装后运行时验证）。**同名撞车陷阱识别并避开**（D-2）：pip install skill-scanner 会装到 MIT 的另一项目——npm 假包同款教训的 pip 版实例，登记为管线级教训。

## 三、双夹具影子跑对照摘要（不对称适配）

| 维度 | 旧引擎 skill-sentinel(prompt-backend) | 新引擎 skill-scanner 2.1.0 | 分类 |
|---|---|---|---|
| 可机验检出（恶意夹具） | brief 层零确定性检出承诺（3 run brief sha256 全同，波动=0；LLM 发现层无宿主不可机验——D-5 如实登记） | 威胁 4 findings（prompt 注入 HIGH / 数据外泄 MEDIUM×2 / YARA 命令注入 CRITICAL，3/3 rule id 全报）+ INFO 注记 1 | accepted（new_findings，5 条全登记交 L2/Owner） |
| 良性夹具（误报控制） | 同上（对良性输入同形指令包） | 威胁 0 条、is_safe=true（MANIFEST_MISSING_LICENSE INFO 为打包提示，accepted） | **benign_false_positive 未命中 → PASS**（本单关键判据） |
| 规则名 | LLM 自由文本无规则名 | 内置 rule id（PROMPT_INJECTION_* / DATA_EXFIL_* / YARA_*） | accepted（rule_name_changed） |
| severity | 中文定级自由文本 | CRITICAL/HIGH/MEDIUM/INFO；映射：is_safe==false 或存在 ≥MEDIUM → pass=false | accepted（severity_mapping_changed） |
| exit code | adapter ok=true | 0（==expected_exit_code 0，默认模式语义：有 findings 仍 exit 0） | accepted（message/语义面） |
| 确定性 | 非确定性输出形态（结构性） | 双夹具各自两次独立运行 findings 集合逐条相同 | accepted（nondeterminism_asymmetry） |
| 检测配置 | — | 默认 policy 预设 balanced（指纹 26ada30a…）+ analyzers static/bytecode/pipeline/correlation；--use-llm 未启用（无 API key，D-4 如实登记） | accepted（detection_config 替代 ruleset，派单第 5 条） |
| benign_false_positive / missing_detection / crash / invalid_exit_code | — | 均**未命中** | **forbidden 零命中 → PASS** |

## 四、回滚三场景（candidate adapter，os.tmpdir 跑完即删）

- **s1 正常路径**：恶意 threat=4 pass=false ok=true（3/3 rule id）+ 良性 threat=0 pass=true——PASS
- **s2 binary missing**（PATH 剥离，零文件改动）：candidate 检测 SKILLSCANNER_NOT_AVAILABLE；s2a 无旗标拒绝（Gate-1）PASS；s2b EXPLICIT_COMPAT_MODE 回滚 prompt-backend 可用且 compat/compat_via/rollback_adapter 留痕（**options/env 双形态均实测**）PASS
- **s3 输出格式异常**（fakebin 假引擎垃圾输出+exit 0 注入 PATH 首位）：adapter 诚实报错 SKILLSCANNER_OUTPUT_INVALID（invalid_output:true）receipt failure 不静默——PASS
- **现场还原**：注入后 skill-scanner --version=2.1.0 复验 = true

## 五、五元组 + hash + 回归三件（HOLD 态）

- **五元组**（migration-record.json five_tuple）：old_asset / new_asset / shadow_result / promotion_receipt 四字段齐备；**runtime_binding = PENDING（Gate-2 绑定随晋升放行后补：manifest-build 重跑新 hash + eligible + dispatch 日志三方机验，期望值动态重算禁硬编码现值 89584585…）**
- **promotion_receipt**：apr-20260925T061000Z-as2sent-shadow（gate=影子跑 PASS+回滚演练 PASS+零 forbidden；approvedBy=**PENDING** 待 Owner 回填；change.record cr-* 按 HOLD 指令未创建）
- **新 hash**：未产出（manifest-build 未重跑——晋升冻结；现值 89584585… 为 AS-2-security 晋升后现值）
- **回归三件**：晋升前 **preflight 8/0/0 + regression 14/0 + validate 0 警告** 全捕获（pre-promotion-*.txt 留档）；晋升后 HOLD（工作区零生产写面改动，pre 三件即当前态实测）
- **锁释放**：4 锁 release（收口无越权改动——3 个生产写面文件零触碰）

## 六、偏差登记（7 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| D-1 | ★ 晋升 HOLD（编排者指令，第十审计 F-001）：状态停 SHADOW-HOLD（原误记 MIGRATING，F-020 归一），Step 7/8/9 与 change.record 待 Owner 签收五张 receipt 后统一放行补做 | HOLD |
| D-2 | PyPI skill-scanner (MIT) ≠ cisco-ai-skill-scanner (Apache-2.0)——同名撞车陷阱，官方包名核实后安装；npm 假包教训 pip 版实例，建议沉淀管线级 lesson | 已处置，登记待 L2 |
| D-3 | 夹具按派单落本单目录 + tar 归档（契约 §五 tmpdir 口径冲突，取派单；D-7 先例）；临时 harness/candidate/ws 均已删 | 登记待 L2 |
| D-4 | skill-scanner LLM 多 agent 分析器未参与影子跑（需 API key）——检出断言按默认分析器集口径声明于差异表 detection_config | 登记待 L2 |
| D-5 | 旧引擎 LLM 发现层本机无宿主不可机验——brief 层波动=0 如实登记，差异表按『无确定性检出承诺』口径适配（AS-2-security D-2 同型） | 登记待 L2 |
| D-6 | expected-findings 两条影子跑前 smoke 修订（rule id/exit code 按实测定稿；良性『零检出』适配为『零威胁检出 + INFO 提示 accepted』），amendments 留痕非静默 | 登记待 L2 |
| D-7 | promotion receipt approvedBy=PENDING（Owner 签收不归 L1 代签）；change.record 按 HOLD 暂缓 | 待 Owner / HOLD |

## 七、产物索引

- 迁移记录：test-reports/autopilot-work/AS-2-sentinel/migration-record.json（**current_state=SHADOW-HOLD + transition voided 标注**，F-020 归一）
- 夹具+差异表：test-reports/autopilot-work/AS-2-sentinel/fixtures/（双夹具 tar 归档 + expected-findings.json + smoke-benign/malicious.json + README）
- 影子证据：test-reports/autopilot-work/AS-2-sentinel/shadow-20260925/（13 件：shadow-result / rollback-drill / old-engine-record + briefs×3 / mal+benign shadow run×2 各带 err）
- 晋升前三件留档：test-reports/autopilot-work/AS-2-sentinel/pre-promotion-{preflight,regression-all,validate-structure}.txt
- Step 2 记录：test-reports/autopilot-work/AS-2-sentinel/step2-install-record.md + step2-version.txt + step2-analyzers.txt
- 写面：**零生产写面改动**（scripts/lib/adapters/skill-scanner.mjs 未创建——候选版在 tmpdir 实测后随 HOLD 冻结；index.mjs / skill-sentinel.yaml 零触碰；禁改面零触碰；禁 git 遵守）
