# PB-WRITEBACK 交叉核对矩阵 — 三单 RESULTS 关键教训 ↔ Playbook v1.1 增补落位

> 任务：PB-WRITEBACK-dispatch（Playbook §七 使用后回写，v1 → v1.1）｜日期：2026-09-25
> 执行：autopilot L1。核对方法：逐条读三单 RESULTS.md + migration-record.json 原文，与 Playbook 增补后正文逐节对照；每条注明单据出处与 Playbook 落位节。
> 本文档不自称 DONE——交 L2 复核。

## 一、四条经验落位矩阵（派单四条 ↔ 单据出处 ↔ Playbook 落位）

| # | 经验（派单原文摘要） | 单据出处（实测原文） | Playbook v1.1 落位 | 核对结论 |
|---|---|---|---|---|
| 1 | **同名撞车检查**：PyPI `skill-scanner`(0.3.3 MIT) ≠ 官方 cisco-ai-skill-scanner；npm semgrep 假包的 pip 版实例；三件套增补"包名 ≠ 官方项目名时必查官方 repo 的 install 通道" | AS-2-sentinel RESULTS §一 Step 2「★ D-2 同名撞车陷阱：PyPI skill-scanner（0.3.3, MIT, thedevappsecguy）为另一项目——官方包名 = cisco-ai-skill-scanner」+ §二「npm 假包同款教训的 pip 版实例，登记为管线级教训」+ migration-record deviations D-2 | §一 YAML 头 `name_collision_check` 字段；§三 Step 2.0 前置检查（安装前必做，含反例原文）；§三 Step 2 FAIL 判据增「包名撞车/撞名」；§四 Rule 3 增补同句；§五教训 6（前置到 install 之前，非装后核对） | ✅ 四处落位，出处已注 |
| 2 | **NO INSTALL 分支产出物清单**：①NO INSTALL 裁定记录 ②状态保持 ACTIVE（不得 SHADOW——无夹具无影子对象）③adapt 裁定材料（选项+再评估触发器）④零生产写面——写进 §四 Failure Rules NO INSTALL 条目扩充 | AS-2-review RESULTS §一「迁移停在 SHADOW 之前（state 保持 ACTIVE……结构性不满足）；零生产写面……合法产出 = adapt 裁定材料」+ §二 Step 3-9 BLOCKED_NO_INSTALL「全部不产出、不假造」+ §三 选项 1/2/3 + migration-record no_install_verdict 字段（verdict 原文含"零生产写面，禁自研 wrapper 假装接入"） | §四 Rule 3 NO INSTALL 条目内增补**四件合法产出物清单**（①裁定记录 ②ACTIVE 保持/不得置 SHADOW ③adapt 裁定材料 ④零生产写面+禁自研 wrapper，Step 3-9 BLOCKED_NO_INSTALL 不产出不假造）；§六 新增 **§六-B NO INSTALL 分支 wizard 清单**（6 勾选项含 manifest hash 零漂移机证）；§六 Step 0 行补锁面收窄先例 | ✅ 派单要求"写进 §四"已满足，另增 §六-B wizard 形态便于复制 |
| 3 | **漏洞夹具归档标准动作**：tar 归档入库 + README 记 --lang python 重放 | AS-2-security fixtures/README.md「tar 归档入库的原因：Mimosa 仓库扫描把 .py 夹具当真实漏洞强制拦截 commit……解包重放：tar xzf … && semgrep --config … --lang python vulnerable_app.py」+ sha256=1177efe8… + §六产物索引 tar.gz 文件在库实证；ledger D-7 原始教训条目（"playbook 可增补'夹具归档入库'标准动作"）；AS-2-sentinel fixtures/README.md「按 AS-2-security D-7 先例」复制实证 | §二 新增 **#3a 夹具归档入库标准动作**（危险文本夹具禁明文入库 + tar.gz + sha256 结构化指针 `{archive, member, sha256}` F-017 口径 + README 重放命令，--lang python 实例原文）+ §五教训 8 | ✅ 标准动作成文，含复制先例与结构化 schema 口径 |
| 4 | **benign_false_positive**：良性包误报是 forbidden 第四类之外的高频类目；双夹具影子跑（恶意+良性）升为标准动作 | AS-2-sentinel RESULTS §一 Step 4「双夹具口径（恶意 canonical + 良性对照）+ 本单特有 benign_false_positive forbidden 类（误报会阻塞正常工作流）」+ §三对照表「良性夹具威胁 0 条、is_safe=true……benign_false_positive 未命中 → PASS（本单关键判据）」+ fixtures/README 双夹具 sha256 表 | §二 新增 **#3b 双夹具标准形态**（安全类引擎替换：恶意 canonical + 良性对照）；#4 差异表增列 benign_false_positive forbidden 类 + nondeterminism_asymmetry accepted 类（AS-2-security 先例口径）；#5 影子跑判据增"逐夹具出检出断言与确定性断言"；§三 Step 5.1/5.2 双夹具操作 + PASS 判据重写（含 AS-2-sentinel 实测值）；§四 Rule 1 forbidden 清单增列；§五教训 7 | ✅ 升为标准动作（不限"本单特有"，按派单"升标准"口径泛化到安全类替换） |

## 二、三单 RESULTS 关键教训逐条对照（防遗漏）

### AS-2-sentinel（RESULTS §六 偏差 7 条 + wizard 勾选）

| 单据教训 | 是否回写 | 落位/不回写理由 |
|---|---|---|
| D-2 同名撞车 | ✅ | 经验 1（见矩阵） |
| 双夹具 + benign_false_positive + nondeterminism_asymmetry | ✅ | 经验 4（#3b/#4/§三 Step 5） |
| detection_config 替代 ruleset（默认 policy 预设 balanced，零自造规则） | ✅ | §三 Step 5.1 注释补"detection_config 替代 ruleset 时同样零自造，指纹落差异表" |
| D-3/D-1 夹具落单目录 vs 契约 tmpdir 口径冲突；晋升 HOLD/SHADOW-HOLD 归一 | ➖ 不回写 | 属单据级偏差与编排者 HOLD 指令（F-001/F-020），非 Playbook 通用规则缺失；#3a 归档口径已按派单优先实践成文 |
| D-4 LLM 分析器未参与（API key）/ D-5 旧引擎发现层不可机验 | ➖ 不回写 | 单据级如实登记；差异表适配口径已由 nondeterminism_asymmetry accepted 类覆盖 |
| D-6 smoke 修订留痕 | ✅ | §二 #4 增补"amendments 留痕非静默（三单先例：AS-2-first D-2 / AS-2-security D-4 / AS-2-sentinel D-6）" |
| D-7 receipt PENDING | ➖ 不回写 | §二 #9 已有同款规则（L1 不代签），无新增 |

### AS-2-security（RESULTS §五 偏差 6 条 + REMEDIATION-1 增补）

| 单据教训 | 是否回写 | 落位/不回写理由 |
|---|---|---|
| D-7（ledger 编号）夹具被扫描拦截 → tar 归档 | ✅ | 经验 3（§二 #3a + §五教训 8） |
| F-017 结构化指针 schema {archive, member, sha256} | ✅ | 并入 §二 #3a（"全部证据 JSON 与人类文档指向同一 schema"） |
| nondeterminism_asymmetry accepted 类首创 | ✅ | §二 #3b/#4（标注 AS-2-security 先例口径） |
| D-5 晋升前快照缺失 | ➖ 不回写 | 已由 §六 2026-09-25 增补块②（第十审计 F-004/F-003/F-005）覆盖在案，非本次范围 |
| D-6 登录墙字段 / D-2 LLM 层不可机验 / D-1 tmpdir 冲突 / D-3 D-4 receipt 与 amendments | ➖ 不回写 | D-4 同款已在 §二 #4 amendments 句覆盖；其余为单据级备查/偏差 |
| F-014 capability narrowed 三件套 | ➖ 不回写 | 已由 §六 增补块③覆盖在案 |

### AS-2-review（RESULTS §五 偏差 6 条 + NO INSTALL 分支）

| 单据教训 | 是否回写 | 落位/不回写理由 |
|---|---|---|
| D-1 NO INSTALL 分支执行形态（ACTIVE 保持/零生产写面/adapt 材料） | ✅ | 经验 2（§四 Rule 3 四件清单 + §六-B） |
| 候选 A 宿主技能"非进程结构性不可 spawn"、候选 B registry E404 + SaaS auth 门 | ✅ | §六-B 首项"逐候选探测证据落盘 + 三件套缺项具名"承载（探测细节属单据证据，Playbook 收方法论不收个例数据） |
| D-2 锁面收窄（零生产写面仅锁证据 record） | ✅ | §六 Step 0 行补注（AS-2-review D-2 先例） |
| D-3 无夹具故归档先例未触发 | ➖ 不回写 | 单据级事实；§六-B 已含"Step 3-9 BLOCKED 不产出" |
| D-4 change.record 未创建（"若晋升"分支未触发） | ✅ | §六-B "Step 3-9 显式 BLOCKED_NO_INSTALL 登记（不产出、不假造）"覆盖 |
| D-5 绑定文档化草案需 Owner 授权 / D-6 GBK mojibake | ➖ 不回写 | 单据级待裁定/装饰性备查 |

## 三、防超时与写面纪律自证

- 三步各 ≤10 分钟落盘：①Playbook 头部+§一§二§三 增补 ②§四§五§六§七 增补 ③本矩阵+回归留档，均独立落盘完成。
- 写面：仅 `plans/asset-migration-playbook.md`（白名单内）+ 本目录（白名单内）。未触碰 contracts/、scripts/、webview/、SKILL.md、commands/、governance-skills/、其他 plans/ 文件、HARDEN-1 写面（audit-index/FINAL-E2E/regression-all/S16）。禁 git 遵守。
- 不新增状态机：全部增补映射契约既有六态与五条合法转移（NO INSTALL 分支显式停在 ACTIVE→SHADOW 转移条件不满足，属契约既定语义）。
