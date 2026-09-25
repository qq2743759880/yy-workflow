# PLAYBOOK-1 Step① 提纲（2026-09-25）

产出目标：`plans/asset-migration-playbook.md`（唯一白名单产出）+ 本目录自测证据。

## 输入已读
- handoffs/v3/PLAYBOOK-1-dispatch.md（本单）
- plans/execution-plan-v3-20260923.md §v3.1-v3.6（Playbook 定位裁定：证据要求表+操作指南，非第二状态机；v3.6 结构定型）
- contracts/asset-migration.md（asset-migration@1.0.0，状态机唯一权威，六态五合法转移+非法流转表+五元组+三硬门+drop_allowed）
- test-reports/autopilot-work/AS-2-first/：RESULTS.md、migration-record.json、fixtures/（bad-openapi.yaml/.json、expected-findings.json）、rulesets/、shadow-20260924/ 8 件（old-engine-record*.json、spectral-probe.*、spectral-shadow-stdout.json、shadow-result.json、rollback-drill.json、post-promotion-probes.json）
- scripts/preflight.mjs / change-lock.mjs / manifest-build.mjs / eligible.mjs 头注（CLI 口径）
- test-reports/asset-eval-20260923/asset-baseline-before.json（Gate-0 产物样例）
- test-reports/autopilot-work/AV-3/RESULTS.md §4（Gate-2 hash 绑定探针 C1-C3，hash 动态化教训出处）

## Playbook 结构（v3.6 三部分，缺一不可）
1. **Migration Object**：机读 YAML 头（old_asset/new_asset/owner/status/required_evidence），status 映射契约状态机；给模板+AS-2-first 实例化样例
2. **Per-state Evidence Requirements**：按契约五条合法转移逐态列 evidence_required（ACTIVE→SHADOW / SHADOW→MIGRATING / MIGRATING→PRIMARY / PRIMARY→DEPRECATED / DEPRECATED→REMOVED）；非法流转只引用契约不复制
3. **Operator Guide**：AS-2-first 实际用过的命令序列写实（change-lock acquire / preflight / npm install+--version / 旧引擎实测 / 差异表定稿 / spectral lint --ruleset / 回滚演练三场景 / manifest-build / eligible / post-promotion probes / 回归三件 regression-all+preflight+validate-structure），每步含 PASS 判据与 FAIL 处置

## 附录部分
- Failure Rules 四条（NO PROMOTION / NO DROP / NO INSTALL / EXPLICIT_COMPAT_MODE）
- 关键教训五条（差异表先定稿 / 回滚路径前置验证 / hash 动态化 / 门栈摊销 / 写面声明）逐条注明出处
- 复制阶段 wizard 式清单（v3.3 摊销裁定）+ AS-2-first 四偏差（D-1..D-4）对复制的传导

## 回溯自测方法（Step③）
以 AS-2-first 真实产物为基准，逐条问：Playbook 每条要求能否在真实证据中找到对应物（写了没做→删/改）；真实证据中每个关键动作是否被 Playbook 覆盖（做了没写→补）。双向修订登记于 03-revisions.md。

## 防超时步骤
①提纲（本文件）→ ②正文落盘 → ③逐条对照自测 → ④双向修订+登记 → ⑤RESULTS.md。
