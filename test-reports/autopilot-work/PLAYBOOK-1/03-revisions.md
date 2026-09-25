# PLAYBOOK-1 Step④ 双向修订记录（修订于 plans/asset-migration-playbook.md，本文件为登记）

对照基准：test-reports/autopilot-work/AS-2-first/（证据清单见 01-selftest-matrix.md）。

## A 向修订（Playbook 写了但 AS-2-first 实际没做/证据不支持 → 删或改）

### R1 change-lock 步骤的证据出处校准
- 发现：Playbook 初稿 Step 0 声称"全部命令为 AS-2-first 实际执行过的形态"，并把 change-lock acquire 列为 Step 0；但 AS-2-first 全部产物（RESULTS.md/migration-record.json/shadow-20260924/ 8 件）中无任何 change-lock acquire 留痕，plans/change-lock.json 现值为 {"locks": []}。
- 处置：**保留 Step 0**（契约 §六锁面 + F-003 写面纪律要求，复制 replace 必须走），但 Operator Guide 头部措辞校准为"命令形态以 AS-2-first 实际执行与产物引用为核心；个别门面命令（Step 0 change-lock）形态取自脚本 CLI 头注与契约 §六 要求"——不得谎称实例执行过。
- 性质：措辞校准（防手册虚证），步骤本身不删。
- 遗留：AS-2-first 锁记录缺口登记备考（该单以派单白名单+写面声明表履行了 F-003 实质，机检面留痕缺失）。

## B 向修订（AS-2-first 做了但 Playbook 初稿漏写 → 补）

### R2 状态转移须含 at 时间戳
- 发现：migration-record.json state_machine.transitions 每条含 `at`（ISO 时间）+ sourceEvidence[]；初稿只要求 sourceEvidence。
- 处置：Step 9 落账要求补"逐转移含 at 时间戳"。

### R3 接口面扩张须登记 deviations
- 发现：AS-2-first D-4——新引擎使 adapter 文件型契约面 .json → .json/.yaml/.yml（YAML 由旧降级 pass:null 变真校验），登记为能力提升面偏差交复核；初稿 deviations 要求未覆盖此类。
- 处置：Step 9 落账补"接口面扩张须登记 deviations（D-4 先例）"。

### R4 shadow 产物互链与字段名形态
- 发现：shadow-result.json 实测含 comparison.diffClassification / forbidden_verdict 字段与 artifacts 互链字段（spectral-shadow-stdout.json / old-engine-record.json）；初稿只写"含 DEBUG/spawn 记录"。
- 处置：Step 5.3 补产物结构与互链形态，使复制者产物可对照。

### R5 官方影子跑前 smoke + 修订留痕
- 发现：D-2——expected_rule_ids 依 smoke 修订（openapi-tags 在 spectral:oas 为 recommended:false 不触发→移除；operation-tags 补入），留痕于 expected-findings.json amendments，非静默改门。
- 处置：Step 4 补 smoke 子步与 amendments 留痕要求（起草时已吸收，登记备考）。

## 起草期吸收项（未走独立修订轮，留档备考）
- 孪生 fixture（bad-openapi.json）及 twin_reason（旧 adapter 契约门只认 .json）→ §二.3
- post-promotion 四探针（p1 正常/p2 拒绝/p3 compat env/现场还原）→ Step 8
- receipt approvedBy Owner 签收位 PENDING 纪律（D-3）+ CONTRACT 类 change 单归 L2 → §二.9
- tmpdir 临时接线跑完即删 vs 夹具作为证据落盘的区分（D-1 契约-派单偏差）→ §二.3
- new_findings_registry 逐条登记随五元组交 L2 → §二.14

## 修订后的完整性判定
- A 向 1 条、B 向 4 条已回写 Playbook 正文（R1-R4 内嵌标注）；修订后逐条对照矩阵（01-selftest-matrix.md）无"A 向未处置"项残留。
- Playbook 现满足验收要点：三部分结构齐（§一 Migration Object / §二 Per-state Evidence Requirements / §三 Operator Guide）；Failure Rules 四条全收（§四）；教训五条注明出处（§五）；复制 wizard 清单（§六）；后续 replace 执行者只读本文+契约可开工（§二/§三自足，实例路径随文可回查）。
