# PLAYBOOK-1 RESULTS — Asset Migration Playbook v1 蒸馏（批 1 第二波 Step 6）

> 执行：autopilot L1（handoffs/v3/PLAYBOOK-1-dispatch.md）｜日期：2026-09-25
> 本文档不自称 DONE——L2 复核后方可关账进入复制阶段。

## 一、白名单产出

| 产出 | 路径 | 状态 |
|---|---|---|
| Playbook v1（唯一白名单正文产出，新建） | `plans/asset-migration-playbook.md` | 落盘，含回溯自测双向修订（R1-R4 内嵌） |
| 自测证据（本目录，新建） | `test-reports/autopilot-work/PLAYBOOK-1/`：00-outline.md（Step① 提纲）、01-selftest-matrix.md（Step③ 逐条对照矩阵）、03-revisions.md（Step④ 修订登记）、本 RESULTS | 落盘 |

白名单外零改动（contracts/、scripts/、webview/、SKILL.md、commands/、其他 plans/ 文件、test-reports 既有文件均未触碰）；未使用 git。

## 二、Playbook 结构摘要（v3.6 三部分缺一不可）

1. **§一 Migration Object**：机读 YAML 头模板（change_dispatch/contract/old_asset/new_asset 含 provider_identity 三件套/owner/status 映射契约六态/required_evidence 清单）+ AS-2-first 实例化指引（指向 migration-record.json 落盘形态）。
2. **§二 Per-state Evidence Requirements**：按契约五条合法转移逐态列证据（ACTIVE→SHADOW 4 条 / SHADOW→MIGRATING 5 条 / MIGRATING→PRIMARY 5 条 / PRIMARY→DEPRECATED 被动 / DEPRECATED→REMOVED 4 条），每条注明实例出处路径；非法流转只引用契约 §一不复制（防第二事实源）。Traffic Switch 按实证写实：允许 no-op 但必须记录理由。
3. **§三 Operator Guide**：Step 0-9 照着敲的命令序列（change-lock acquire/preflight/npm install+--version/旧引擎实测/差异表定稿+smoke/spectral lint --ruleset 影子跑/回滚演练三场景/promotion 动作链+manifest-build/eligible+Gate-2 日志+四探针/回归三件+五元组落账），每步含 PASS 判据与 FAIL 处置。
4. 附：§四 Failure Rules 四条全收（NO PROMOTION/NO DROP/NO INSTALL/EXPLICIT_COMPAT_MODE，逐条注明出处）；§五 关键教训五条（差异表先定稿/回滚路径前置验证/hash 动态化/门栈摊销/写面声明，出处含 AV-3 RESULTS §4 与 F-003）；§六 复制阶段 wizard 式清单（v3.3 摊销）；§七 使用后回写+修订记录。
5. 状态机唯一权威 = contracts/asset-migration.md，Playbook 全文按"进入某状态需要哪些证据"组织，未另立状态机（v3.5 拦截项/v3.6 定型遵从）。

## 三、回溯自测（本单核心自测）结果

方法：把 Playbook 当"重来一次 be-validator→Spectral"的手册，逐条对照 AS-2-first 真实证据（RESULTS.md/migration-record.json/fixtures 3 件/rulesets 1 件/shadow-20260924 8 件），双向判定。明细：01-selftest-matrix.md。

- **A 向（写了没做）1 条**：R1——change-lock acquire 在 AS-2-first 全部产物中无留痕（plans/change-lock.json 现值 locks=[]）。处置：步骤保留（契约 §六要求），但 Operator Guide 措辞校准为"形态取自脚本 CLI 头注与契约 §六"，不谎称实例执行过；缺口登记备考。
- **B 向（做了没写）4 条**：R2 转移须含 at 时间戳（migration-record state_machine 形态）；R3 接口面扩张须登记 deviations（D-4：.json→.json/.yaml/.yml）；R4 shadow 产物互链形态（artifacts/diffClassification/forbidden_verdict）；R5 smoke+amendments 留痕（D-2）。
- 起草期吸收 5 条留档备考：孪生 fixture+理由（D-1 关联）、post-promotion 四探针、receipt Owner PENDING 纪律（D-3）、tmpdir 临时接线 vs 证据落盘区分（D-1）、new_findings_registry。
- 修订后判定：Playbook 每条要求均可在 AS-2-first 证据或契约中找到对应物；无凭空新增的门。

## 四、偏差登记（1 条，交 L2）

| id | 内容 | 状态 |
|---|---|---|
| D-PB-1 | AS-2-first 的 change-lock acquire 机检面留痕缺失（见 R1）：该单以派单白名单+写面声明表履行了 F-003 实质，但锁 CLI 留痕不在其产物中。本单不代补（改 AS-2-first 产物超出白名单），仅登记；复制三个 replace 时 Step 0 必须实跑并留痕 | 登记待 L2 |

## 五、复制阶段前置核对（承接 AS-2-first RESULTS §七）

后续三个 replace 执行者开工前：① AS-2-first D-3 receipt Owner 关账；② L2 复核 AS-2-first migration-record 与本 Playbook（含本自测）；③ 只读 `plans/asset-migration-playbook.md` + `contracts/asset-migration.md` 开工，按 §六清单逐项勾选留产物。

## 六、防超时纪律执行

五步全部落盘且各步独立可查：①00-outline.md ②Playbook 正文 ③01-selftest-matrix.md ④03-revisions.md+正文内嵌 R1-R4 ⑤本 RESULTS。
