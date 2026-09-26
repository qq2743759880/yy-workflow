# 审计索引 — 第十三轮 UNVERIFIED/未读取 项证据指针表（2026-09-25，HARDEN-1 H3）

> 目的：外部受限审计者按本索引**直读**证据，不再 NOT FOUND（F-022 教训：审计者 MCP 未找到≠文件不存在，但披露方须给出可直读指针——file-tree-proof.txt 先例）。
> 用法：路径均为**仓库相对路径**（根 = `yy/`）；"复验命令"在仓库根目录 Git Bash 下逐行执行；`git log` 类命令由审计者执行（L1 禁 git，git 收口归编排者）。
> 生成：autopilot L1（HARDEN-1 派单 H3 授权，全新上下文）。本索引只新增文件，不改 plans/ 既有文件。

## 一、第十三轮审计补证项（ledger「第十三轮审计补证处置」登记）

| # | finding | 证据文件路径 | 复验命令一行 |
|---|---|---|---|
| A-1 | F-022：`f014-manifest-build.log` 被报 NOT FOUND（实为 1605B 在场+内容 hash 双一致 3c0e7df0）→ 已补文件树证据，NOT YET VERIFIED → 已补证 | `test-reports/autopilot-work/REMEDIATION-1/file-tree-proof.txt`（内含目录树：`f014-manifest-build.log  1605` 行）；`test-reports/autopilot-work/REMEDIATION-1/f014-manifest-build.log` | `ls -l test-reports/autopilot-work/REMEDIATION-1/f014-manifest-build.log && sha256sum test-reports/autopilot-work/REMEDIATION-1/f014-manifest-build.log && cat test-reports/autopilot-work/REMEDIATION-1/file-tree-proof.txt \| grep f014` |
| A-2 | F-025：签收后第一项动作 = FINAL-E2E 真实主链验收入口（区别于 planner-shaped probe）——已落盘并已执行 9/9 | `test-reports/autopilot-work/FINAL-E2E/ACCEPTANCE-ENTRY.md`；`test-reports/autopilot-work/FINAL-E2E/RESULTS.md`；逐断言 JSON：`test-reports/autopilot-work/FINAL-E2E/e2e-assert-auto.json`（verdict=PASS，host_mode=mech，assertions 9） | `node -e "const j=require('./test-reports/autopilot-work/FINAL-E2E/e2e-assert-auto.json');console.log(j.verdict,j.host_mode,j.assertions.map(a=>a.pass).join(','))"` |
| A-3 | F-021 措辞修正：receipt `approval_effect=authorize_transition_request`（授权转移请求≠当前状态已变更；receipt 存在≠transition 完成） | `contracts/discrepancies/cr-20260925T150000Z-as2sent-promotion.json`（`approval_effect` 字段 + 修正注记） | `grep -o "approval_effect[^,]*" contracts/discrepancies/cr-20260925T150000Z-as2sent-promotion.json` |
| A-4 | F-023：gate probe 曾 vacuous all_pass（断言子对象未填）→ run-stamped artifact 再生，含 `assertions` 子对象有语义值 | `test-reports/autopilot-work/REMEDIATION-1/run-2026-09-25T08-19-37-403Z-gate-probe-result.json`（run-stamp 命名，rerun 不覆盖已提交证据） | `node -e "const j=require('./test-reports/autopilot-work/REMEDIATION-1/run-2026-09-25T08-19-37-403Z-gate-probe-result.json');console.log(JSON.stringify(j.probes.js_file_rejected.assertions))"`（REMEDIATION-2 F-032 修正：artifact 实测结构为 `{probes:{js_file_rejected:{assertions:…}}}`，原命令 `j.assertions` 顶层不存在 → undefined 恒空） |

## 二、第十三轮账面行（ledger 执行表）对应证据

| # | finding | 证据文件路径 | 复验命令一行 |
|---|---|---|---|
| B-1 | AS-1 关账行：drop 7 + S15 六断言全绿（正式报告） | `test-reports/autopilot-work/AS-1/RESULTS.md`；回归终态 `test-reports/autopilot-work/AS-1/regression-final.log`（20 PASS/0 FAIL）；`test-reports/autopilot-work/AS-1/preflight-final.log`（8 PASS）；drop 单 `contracts/discrepancies/cr-20260925T102900Z-as1-drop7.json` | `grep -E "^(PASS|FAIL|结果)" test-reports/autopilot-work/AS-1/regression-final.log \| tail -5` |
| B-2 | 三注入点探针（AS-1 自测 3：INJ-1 孤儿引用 / INJ-2 引擎缺席 / INJ-3 孤儿 sidecar / INJ-4 drop 复活 / INJ-5 记录篡改——5 注入全 FAIL 具名 + 现场还原） | `test-reports/autopilot-work/AS-1/s15-injection-test.mjs`（驱动）；`test-reports/autopilot-work/AS-1/s15-injection-result.log`（逐条 PASS 具名输出） | `grep "^PASS INJ" test-reports/autopilot-work/AS-1/s15-injection-result.log` |
| B-3 | 七 vendor 删除的 git 记录（ledger L2 核对"7 vendor 目录删除已全部入版本库 ✓"；git 收口归编排者，L1 禁 git） | 文件系统现状证据：`test-reports/autopilot-work/AS-1/RESULTS.md` §二 表（7 资产 vendor/sidecar 双删）+ 每 drop preflight 8 PASS；版本库记录由审计者按下命令直查 | `git log --oneline --diff-filter=D --name-status -- vendor/be-architect vendor/be-resilience vendor/be-provider vendor/colorize vendor/frontend-visual-validation vendor/agent-vision-toolkit vendor/agent-research && ls vendor/` |
| B-4 | governance 探针（GW-1 三技能接线实证：stage7 注 TDD / stage8 注 verification / 失败路径 GOVERNANCE 指路 / 截断护栏 / governance-skills 缺席容错） | `test-reports/autopilot-work/GW-1/probe-unit-results.txt`（binding/fail-closed/stageForAsset 全 PASS）；`test-reports/autopilot-work/GW-1/probe12-brief-checks.txt`（tdd/verify 注入布尔值）；`test-reports/autopilot-work/GW-1/probe12-orchestrator-run.log`；`test-reports/autopilot-work/GW-1/probe-rename-results.txt`（governance-skills 改名缺席→RESTORED 容错）；驱动 `test-reports/autopilot-work/GW-1/probe-unit.mjs` | `grep -c "^PASS" test-reports/autopilot-work/GW-1/probe-unit-results.txt && head -8 test-reports/autopilot-work/GW-1/probe12-brief-checks.txt` |
| B-5 | governance-skills 本体 sha256 零变化（接线不触本体） | `test-reports/autopilot-work/GW-1/governance-skills-hashes-before.txt` vs `governance-skills-hashes-after.txt` | `diff test-reports/autopilot-work/GW-1/governance-skills-hashes-before.txt test-reports/autopilot-work/GW-1/governance-skills-hashes-after.txt && echo ZERO_DELTA` |
| B-6 | GW-1 manifest hash 归因：接线本身零增量；before/after 两份 capture（d9f0d738→c30fee6b）跨越了其后 AS-1 drop 的登记变化（c30fee6b = AS-1 RESULTS §四登记现值）——归因链见 AS-1 报告 | `test-reports/autopilot-work/GW-1/manifest-hash-before.txt`；`test-reports/autopilot-work/GW-1/manifest-hash-after.txt`；现值登记 `test-reports/autopilot-work/AS-1/RESULTS.md` §四 | `sha256sum contracts/asset-manifest-v2.json`（期望 c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1） |
| B-7 | GW-1 回归三件（接线后全绿） | `test-reports/autopilot-work/GW-1/final-regression.txt` / `final-regression-2.txt`；`final-preflight.txt`；`final-validate.txt` | `tail -2 test-reports/autopilot-work/GW-1/final-regression-2.txt && tail -2 test-reports/autopilot-work/GW-1/final-preflight.txt` |
| B-8 | AS-2-review 裁定（review 保留 prompt-backend，NO INSTALL 门拦截假接入） | `test-reports/autopilot-work/AS-2-review/adaptation-adjudication.md`；`test-reports/autopilot-work/AS-2-review/step2-no-install-record.md` | `head -20 test-reports/autopilot-work/AS-2-review/adaptation-adjudication.md` |
| B-9 | FINAL-E2E 真实主链 9/9（真实 buildPlan→orchestrator→resolver→capabilities→adapter→receipt；semgrep 真扫 6 findings + UNCOVERED_LANGUAGES fail-closed） | `test-reports/autopilot-work/FINAL-E2E/e2e-assert-auto.json`；orchestrator 全输出 `e2e-orchestrator-auto.log`；驱动可复现 `final-e2e-assert.mjs`（`--backend auto`，默认 `--host-mode=mech`） | `node test-reports/autopilot-work/FINAL-E2E/final-e2e-assert.mjs --backend auto 2>&1 \| tail -20` |

## 三、签收前补证（HARDEN-1 新增面，2026-09-25）

| # | finding | 证据文件路径 | 复验命令一行 |
|---|---|---|---|
| C-1 | H1 failed state cannot promote 行为探针：FINAL-E2E 同款 mech 主链（--backend auto + MECH_HOST）临时 workspace，implementation 因 opencode 未登录自然 failed → promotionReceipt==null + 全仓 migration-record 零引用 + SIGNED receipt 零引用 | `test-reports/autopilot-work/HARDEN-1/s16-behavior-probe.json`（verdict=PASS）；failed state 副本 `s16-state-failed.json`；orchestrator 全输出 `s16-orchestrator.log` | `node -e "const j=require('./test-reports/autopilot-work/HARDEN-1/s16-behavior-probe.json');console.log(j.verdict,JSON.stringify(j.checks))"` |
| C-2 | H1 静态断言 + 注入反例：migration-record + state 副本全扫 failed×SIGNED 零违例；注入 failed+SIGNED 组合被同一扫描器 FAIL 具名（PENDING 对照不误报） | `test-reports/autopilot-work/HARDEN-1/s16-static-scan.json`；整机回归 `test-reports/autopilot-work/HARDEN-1/regression-s16.txt`（S16-1/S16-2 两行） | `grep "S16" test-reports/autopilot-work/HARDEN-1/regression-s16.txt` |
| C-3 | H2 更名三处一致（Runtime Boundary E2E / Host Mode: mechanical acceptance host / 非 LLM 规划质量）+ llm 模式 post-Owner-ruling 可选项声明 | `test-reports/autopilot-work/FINAL-E2E/RESULTS.md`（标题+§三.5）；`test-reports/autopilot-work/FINAL-E2E/ACCEPTANCE-ENTRY.md`（标题+Host Mode 声明）；`plans/autopilot-ledger-20260921.md`「HARDEN-1 更正」段 | `head -3 test-reports/autopilot-work/FINAL-E2E/RESULTS.md && head -5 test-reports/autopilot-work/FINAL-E2E/ACCEPTANCE-ENTRY.md` |
| C-4 | H3 本索引（第十三轮 UNVERIFIED 项证据指针表） | `plans/audit-index-20260925.md`（本文件） | `wc -l plans/audit-index-20260925.md` |

## 四、已知缺口（披露方自报，不掩饰）

| # | 缺口 | 现状 | 指向 |
|---|---|---|---|
| N-1 | GW-1 无 `RESULTS.md` 正式报告（派单 H3 原拟以其为索引材料） | 目录只有探针/回归证据文件 + ledger 执行行（`plans/autopilot-ledger-20260921.md` GW-1 行：agent_bdd804c8 / 接线探针·截断护栏·向后兼容·hash 零变化亲验）；本表 B-4~B-7 即其证据面 | `ls test-reports/autopilot-work/GW-1/` |
| N-2 | F-022 的 sha256 5a1f3203… 断言出处为 ledger 补证① 文字 | 以 A-1 复验命令现算为准（以物证为准，不以转述为准） | A-1 命令 |
| N-3 | `--host-mode=llm` 真实 LLM 宿主路径未达成验收（E-4 张力在案） | post-Owner-ruling 可选项，非缺口掩盖——RESULTS §三.5 显式声明 | `test-reports/autopilot-work/FINAL-E2E/RESULTS.md` §三 |
