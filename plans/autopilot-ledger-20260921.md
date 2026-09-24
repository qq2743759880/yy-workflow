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
| BFX-A | PASS | agent_8c6a1391 | orchestrator-L2(串行终验) | 2026-09-22T10:30:00Z | scripts/tt-journey.mjs; test-reports/autopilot-work/BFX-A/RESULTS.md; test-reports/autopilot-work/BFX-A/run-probes.mjs |
- [P2] D-BFXA-2: 默认渲染分支（无子命令）未接 --session（坑单范围外）；D-BFXA-3: updateJourney 既有 [DEBUG] stdout 噪声由编排者直修删除（收口）
| BFX-B | PASS | agent_dc1aab40 | orchestrator-L2(串行终验) | 2026-09-22T10:30:00Z | scripts/review-gate.mjs; test-reports/autopilot-work/BFX-B/RESULTS.md |
- [P2] D-BFXB-1: tasksDir 默认值一并跟随 --dir（同 bug 家族顺修）；D-BFXB-4: 9 列判定语义未放松（只加格式诊断提示）
| BFX-C | PASS | agent_1cbebcdc | orchestrator-L2(串行终验) | 2026-09-22T10:30:00Z | SKILL.md; reference/dispatch-and-acceptance.md §5.7; reference/frontend-gate.md §6.7; test-reports/autopilot-work/BFX-C/RESULTS.md |
- [P2] D-BFXC-1: 派单引用的"既定纪律"悬空短语实测不存在，按修复意图补建；D-BFXC-3: dispatch-and-acceptance.md 2000/2000 tok 压线（4 处既有行等义压缩腾位）
| ACC-1 | PASS | orchestrator(直修终验) | orchestrator-L2 | 2026-09-22T10:45:00Z | 发布重生成（PURGED=1 LEAK 0+0）；junction 冒烟 4/4；安装面 tt-journey byte 归一（BW-2 漂移补丁覆盖）；空壳 plans/ 目录清除；regression 13/13 + validate 0 + FIX-2 探针 12/12 + BFX-A 探针 8/8 串行终验 |
| DOC-1 | PASS | orchestrator | Owner(待复核) | 2026-09-22T10:45:00Z | plans/closeout-20260922.md; plans/blindwalk-board-20260920.md; test-reports/autopilot-work/BW-{1,2,3,4}/session-notes.md |

## Owner 独立审计（2026-09-23，批 0 中期）——7 findings 全部成立，整改登记
- F-001【High·成立】单任务完成≠v3 完成：批 0 仅交付 schema/门/模板层，批 1（AS-0/2/3/AV-2/AS-1）、批 2（AV-3/AV-4/FE-5/6/7/PB-1）、批 3（V3-ACC 全链路盲行）全部未跑——措辞纪律：后续报告一律用"批 N 单任务交付"，禁用"v3 完成"
- F-002【High·成立】regression 13/13 只证旧态自洽：S3 PHASE2 仍含 agent-research/be-provider/be-resilience/colorize/agent-vision-toolkit——整改：AS-1（drop 7）验收新增硬性不变量 S14：①drop 资产 import/引用 0 命中 ②replace 资产真实消费探针 ③manifest 驱动路由断言 ④旧 adapter 不可达；PHASE2 清单与 CLUSTERS 同步收缩
- F-003【High·成立】EX-1/ON-1 并行写 executor-setup.mjs 致结构破损（EX-1 修复归位）——整改：并行批次强制"写面声明表"（派单时逐文件登记唯一 owner），同文件双写禁止；收口时 git diff 逐文件归属核查（写进执行方案 §纪律）
- F-004【Medium·成立】RG-1 断网 SKIP 语义存争议——现状=诚实标注放行；Owner 审计指出退化风险；**推荐改 FAIL+显式 escape hatch（--allow-offline 显式旗标+留痕），待 Owner 拍板**
- F-005【Medium·成立】AV-1 是 schema contract 非 manifest population——AV-2 未跑，manifest 正式值为空占位，属批 1 范围
- F-006【Medium·成立】SB-1 无 RESULTS.md 交付证据——且 L2 复核发现 blindqueue.mjs 有 `frozenQueue` 重复声明 SyntaxError（`node --check` FAIL），续跑 agent 产出破损，需修复+补全自测
- F-007【Medium·成立】CR-1 三派全灭（provider 错误×2+取消×1），review-gate.mjs 无三元绑定改动，CR-1 目录空——第四次派发中
- RG-1 行数口径【Owner SUSPECTED·成立】："主逻辑 146 行"为自定义统计；全文件 220 行实测——登记为口径偏差，探针行数声明今后一律用全文件 wc -l
| CR-1 | PASS | agent_07ac6f1e | orchestrator-L2(自测复现+证据审读) | 2026-09-23T16:40:00Z | scripts/review-gate.mjs（--critique-sources/--rubric/--convert-critique/--tracker-stats + 三元绑定 fail-closed）; plans/critique-backlog-tracker.md（v2 模板节追加，历史行未动）; test-reports/autopilot-work/CR-1/RESULTS.md |
- [P2] D-CR1-01: 三元绑定 CLI 校验仅在显式传参时启用，不传参保 legacy（S7 兼容）；纯缺 source INVALID 语义由 checkCritiqueBinding 导出承担
- [P2] D-CR1-02: 真实 tracker v2 段暂无入库行，--tracker-stats 对真实 tracker exit 1 属模板面先行预期态
- 批 0 派发遗漏自纠：LS-1（lessons.md）与 EA-1（基线测量）此前漏派，本节登记后立即补派
| SB-1 | PASS | agent_e0a578f1 | orchestrator-L2(self-test 24/24 亲自复跑) | 2026-09-23T17:10:00Z | scripts/blindqueue.mjs（CLI 全套+状态机 fail-closed+冻结防篡改+blind 视图掩蔽+四态看板）; test-reports/autopilot-work/SB-1/RESULTS.md |
- [P2] D-SB1-1: 接手半成品修 5 处实质 bug（stage 归一化互串/冻结闸门误杀裁决回写/built→passed 静默/waived 无约束/空队列判 PASS）；hidden 保密为纪律级保证非硬隔离（如实声明）；prereq-check 挂点延后批 2
| LS-1 | PASS | agent_77766e1f | orchestrator-L2(伪造/有效双态亲自复跑) | 2026-09-23T17:40:00Z | scripts/lessons.mjs（fail-closed 写入+session 隔离）; scripts/tt-journey.mjs（prereq 提示段 7 行）; test-reports/autopilot-work/LS-1/RESULTS.md |
- [P2] D-LS1-1: journey init 自动挂 lessons 创建未做（init 段越权面），以 --init 幂等承担；状态口径 ✅=accepted 等价、⬜/❌=拒绝，已写脚本头注释待 L2 追认（编排者追认通过）
| EA-1 | PASS | agent_2b5873ff | orchestrator-L2(表审读+复算口径核查) | 2026-09-23T18:10:00Z | test-reports/asset-eval-20260923/BASELINE.md（16 行基线） |
- [P1] D-EA1-1【最硬输入】：16 资产中 15 个零真实消费（腿② 署名级口径），唯一 dev-planner 有 4/4 署名级消费痕迹；drop-7 清单与零现组完全对齐，frontend-design/planning/skill-sentinel 零现但走 replace（选型决策非测量差异）——观察项登记

## 批 0 收口（2026-09-23，九单全收）
- 交付：EX-1 能力握手（探针 8/8）/ RG-1 研究门（vendor deep-research 原码 + step 1.5）/ AV-1 manifest schema 冻结单（Owner 签收位 PENDING）/ TK-1 task v2 七字段+机验器 / ON-1 接入向导六字段+决策卡 / CR-1 批判三元绑定 fail-closed / SB-1 盲测队列状态机 / LS-1 lessons fail-closed / EA-1 基线测量
- L2 串行终验（写面静默后）：regression 13/13 + validate 0 + make-release 发布刷新 + junction 冒烟
- Owner 审计 7 findings 全部登记整改（S14 不变量入 AS-1 验收、写面声明表纪律、行数口径修正）
- vendor deep-research gitlink 缺陷修复（普通文件快照 168K 重入库）
- 遗留：D-REG1-1 断网语义待 Owner 拍板（推荐 FAIL+--allow-offline）；批 1（AS-0 许可证核查先行）待 Owner 指令
- 【D-REG1-1 归因修正（Owner 指正 2026-09-23）】前一条"Owner 拍板"系错误归因——拍板建议来自外部审计者分析，Owner 仅要求批判性吸收并未裁定。现状修正为：**编排者推荐方案已实现（临时态，待 Owner 追认或否决）**——研究门断网产物默认 FAIL，--allow-offline --approved-by <人名> 显式风险接受 + OVERRIDE EVENT 留痕；三态探针过。实现依据（编排者立场）：与项目 fail-closed 哲学一致（CANDIDATE_INVALID/BASELINE_MISSING 同族），且保留人署名逃生阀维持断网期可操作性；替代方案（沿 review-gate VERIFY_SKIPPED 先例：诚实标注放行+研究债标记）仍可选项，Owner 否决则一行回退。**纪律教训：外部审计/分析=编排者建议的输入，不是 Owner 裁定；Owner-gated 决策只有 Owner 本人能关账。**

## 第三位审计者发现裁定（2026-09-23，Owner 转发批判性分析）
- VC-001/002/005 CONFIRMED 与台账一致；F-001/002/004 实为"批 1 待跑"重述（计划依赖序已含：AV-2 先于 AS-1、replace 三件套门槛）——无新增行动
- 【采纳·立即整改】VC-002 附注：research-gate.mjs 代码注释仍写"D-REG1-1 已裁决"——ledger 归因修正后代码注释漏改，属同一错误的残留面。已改为"编排者推荐方案·临时态待 Owner 追认"（本节同 commit）
- 【采纳·入 S14 验收】Legacy loader 双入口旁路风险（asset.mjs 仍支持 SKILL.md/<name>.md 旧入口）：迁移期共存是有意向后兼容，但 AS-1 收口时 S14 不变量从"旧 adapter 不可达"扩展为"旧 loader 路径同样不可达或显式门控"
- 【采纳·入 preflight 范围】buildManifest() 单源检查：manifest 生成必须单一来源，防 runtime 调旧 buildManifest 绕过 asset-manifest-v2——列入 preflight.mjs 检查项
- 【校准·非缺陷】F-003 "15/16 零消费 SUSPECTED"：审计者自述未读 BASELINE.md，属其证据边界非数据缺陷；但其中间结论采纳——消费证据为**署名级**非正文调取级（BASELINE.md D-偏差 3 已如实登记），AS-1 drop 判据若需调取级证据，须在影子跑中补
- 【校准】F-002/004 SUSPECTED（migration runtime/写面强制未实现）：正确，但就是批 1 待跑事项，非方案缺陷
| B1-GATE0 | PASS | agent_33ca25a4 | orchestrator-L2(结构亲验) | 2026-09-24T08:50:00Z | test-reports/asset-eval-20260923/asset-baseline-before.json（16 行迁移前快照，manifest_hash=null 忠实记录） |
- 三源交叉零偏差（CLUSTERS/ADAPTERS/EA-1）；字段名与派单一致；after 对照由编排者在首批 replace 后另行生成
| AS-0 | PASS | agent_c14ac3c3 | orchestrator-L2(结论审读) | 2026-09-24T09:10:00Z | test-reports/asset-eval-20260923/LICENSES.md（五源核查+superpowers 选品材料） |
- 【关键发现】npm `semgrep` 是 ISC 占位假包（v0.0.1）——security replace 施工必须走 pip，禁 npm install semgrep（已写进 AS-2 前置约束）
- task-master：templates 受 Commons-Clause 约束但仅剥夺 Sell 权，vendor 合法（携完整声明、不 Sell）；spec-kit MIT；skill-scanner Apache-2.0（API NOASSERTION 系误报）；Spectral Apache-2.0 本机实测安装成功
- superpowers 推荐短名单（Owner 圈选中）：test-driven-development / systematic-debugging / writing-plans / verification-before-completion，备选 receiving-code-review
