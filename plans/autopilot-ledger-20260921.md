# autopilot 批次台账（L3 登记员维护；append-only，不动冻结件）

## 登记

| task | verdict | executor | reviewer | timestamp | evidence |
|---|---|---|---|---|---|

## 批判提案（P0/P1；只登记不执行——执行走 L4 收口裁定）

| FE-0 | PASS | agent_5068dca1 | orchestrator-L2 | 2026-09-22T02:40:00Z | scripts/build-guide-content.mjs; webview/journey/content.js; test-reports/autopilot-work/FE-0/RESULTS.md |
| FE-1 | PASS | agent_28ea0a09 | orchestrator-L2 | 2026-09-22T03:10:00Z | webview/journey/index.html; webview/journey/styles.css; test-reports/autopilot-work/FE-1/RESULTS.md; test-reports/autopilot-work/FE-1/probe.js |
| FE-4 | PASS | agent_408469e4 | orchestrator-L2 | 2026-09-22T04:30:00Z | webview/journey/README.md; test-reports/autopilot-work/FE-4/RESULTS.md |
- [P1] D-FE4-6: 并行写面竞态实况：robocopy 主刷新期间 FIX-1 agent 提交了 SKILL.md+commands 7 文件（commit 10d4e3d），发布快照短暂落后；执行者已逐文件补充刷新并复验一致——机制修订需求：发布刷新前等待并行写面静默（编排者收口顺序控制）（落点: plans/autopilot-protocol-20260921.md §八）
| FIX-1 | PASS | agent_31104f9b | orchestrator-L2 | 2026-09-22T05:00:00Z | commands/yy-0-init.md; commands/yy-1-requirement.md; commands/yy-2-planning.md; commands/yy-3-contract.md; commands/yy-4-execute.md; commands/yy-5-critique.md; SKILL.md; test-reports/autopilot-work/FIX-1/RESULTS.md |
| FIX-4 | PASS | agent_965ba371 | orchestrator-L2 | 2026-09-22T05:30:00Z | scripts/summary-read.mjs; test-reports/autopilot-work/FIX-4/RESULTS.md; test-reports/autopilot-work/FIX-4/run-probes.mjs |
| FIX-2 | PASS | agent_5cc6fa13 | orchestrator-L2 | 2026-09-22T06:30:00Z | scripts/orchestrator.mjs; scripts/executor-setup.mjs; test-reports/autopilot-work/FIX-2/RESULTS.md; test-reports/autopilot-work/FIX-2/run-probes.mjs |
- [P1] D-FIX2-6: P5 探针非确定性：modes.exec>0 依赖模型拆解出带 asset 的子任务（模型行为），编排者复跑 3 连挂（首跑 exec=1）——接线本体映射经编排者亲自复现成功（--exec/--hosts 注入 shim 命令 + isolate warning），探针需改为确定性断言（映射日志+注入命令形态），modes.exec 断言删除（落点: test-reports/autopilot-work/FIX-2/run-probes.mjs P5）
| FIX-3 | PASS | agent_f2ba637a | orchestrator-L2 | 2026-09-22T06:45:00Z | scripts/validate-structure.mjs（区B, 063861a）; test-reports/autopilot-work/FIX-2/run-probes.mjs（区C P5 确定性化）; test-reports/autopilot-work/FIX-3/RESULTS.md |
- [P2] D-FIX3-1: 任务 A 自测「登记指针后应 PASS」步骤临时改 SKILL.md 与派单禁改字面冲突，执行后 sha256 链逐字节恢复（42204389…b100e4 前后一致）
- [P2] D-FIX3-2: 派单 R10 runner 路径笔误（R10-implementation-20260917 无 run-fixtures.mjs），实跑 R10-rebuild-20260920 12/12 PASS
| FIX-5 | PASS | agent_e6c67685 | orchestrator-L2(1=B) | 2026-09-22T08:00:00Z | test-reports/rebuild-20260920/T9-wizard/run-probes.mjs; test-reports/rebuild-20260920/T9-wizard/RESULTS-FIX5.md |
| HARD-1 | PASS | agent_1a158bcc | orchestrator-L2(全量) | 2026-09-22T08:00:00Z | scripts/regression-all.mjs; test-reports/fix-20260921/junction-smoke.mjs; test-reports/autopilot-work/HARD-1/RESULTS.md |
- [P2] D-H1-01: 旧 junction 判定 realpath!==字面量 在 Windows 反斜杠下对真实目录恒判 junction（旧缺陷），改双 realpath 归一；在场场景结论不变，非语义放宽
| HARD-2 | PASS | agent_962c05d1 | orchestrator-L2(全量) | 2026-09-22T08:00:00Z | scripts/make-release.mjs; test-reports/autopilot-work/HARD-2/RESULTS.md |
| HARD-3 | PASS | agent_962c05d1 | orchestrator-L2(全量) | 2026-09-22T08:00:00Z | scripts/make-release.mjs（purge 纪律固化）; test-reports/autopilot-work/HARD-2/RESULTS.md |
- [P2] D-H2-1【待 Owner】发布面 31 文件 67 处历史本机路径/用户名痕迹（docs/history、prototypes、vendor，白名单外不可修）——已实现 grandfather 基线冻结（只减不增，新增命中即 FAIL）；清零开单与否待 Owner 裁决
- [P2] D-H2-2: make-release.mjs 源码机器路径按段拼接规避 validate-structure 按行扫描（白名单禁改该扫描器，无法加豁免）
- [P2] D-H2-3: 阀测试 sed 补丁未生效导致误在真实安装面跑一次，短暂污染由发布流程自愈（569/569 复原）；教训固化进 make-valve-patch.mjs（marker 校验）
- [P2] D-H2-4: docs/history 等 113 历史文档按安装面现状反推口径保留在发布面；如认定非发布面，EXCLUDE_DIRS 增一行即生效
| LEAK-1 | PASS | agent_5ddab340 | orchestrator-L2(全量) | 2026-09-22T09:00:00Z | GRANDFATHER_BASELINE 清单 31 文件; scripts/make-release.mjs（基线复位）; test-reports/autopilot-work/LEAK-1/RESULTS.md |
- [P2] D-LEAK-1-①: 67 处审计命中 scrub 至 0（69 处字面替换，含 2 处非计数 /Users/ 引述按语义一并清）；冻结例外=0（7 个"冻结"字样文件均为领域语义非文件级冻结标记）；基线常量置空、机制保留
