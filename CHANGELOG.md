## 2.9.1 · 2026-09-05 · 独立验收 3 缺陷修复（VERIFY-2.9.0 → FIX-2.9.0）
- **#1** contract-reverse Flask 路径转换器 <int:item_id> 归一化修复 → {item_id}（剥尖括号残留）。
- **#2** prefixesDetected 虚报修复：前缀提取跳过 @ 装饰器行（Express app.use 前缀仍检出）。
- **#3** be-validator adapter 认 draft:true/brownfieldDraft → 棕地草案降级不跑真校验（原仅标记层生效，portman 会误跑）。真 OpenAPI 无 draft 仍真校验（不回归）。
- 独立复测全过；回归 8/8、validate 0、ci PASS。报告 docs/history/specs/FIX-2.9.0-report.md。## 2.9.0 · 2026-09-05 · 自动断点 + 棕地契约 + 多宿主探测（子 agent + 编排者降级实现，独立验收）
- **自动断点（IMP1）**：orchestrator 收尾新增 state-summary.json（机器可读：summary/blockedSubtasks/contractFrozen/critiqueBacklog/files，schema tt/state-summary@1）；scripts/summary-read.mjs --workspace/--latest/--all 恢复断点。实测 blockedSubtasks 7、critiqueBacklog 从 tracker 读 C-10/11/12。
- **棕地契约（IMP2）**：contract-reverse.mjs（代码反推 OpenAPI 草案 draft:true，修复 express 组索引 bug）；orchestrator --contract-draft（与 --contract 互斥、be-validator 不跑真校验、前端凭草案开工、freezeContract 记 contractSource）；contract-discrepancy.mjs（前端差异→handoffs/contract-change-<planId>.md 变更单）；SKILL §5.4 棕地说明。
- **多宿主探测（IMP3）**：exec-host-probe.mjs 只读探测 7 CLI（opencode/claude/codex/cursor/trae/openclaw/a6api 全 available）；exec-host-generic.mjs 通用非交互宿主（brief stdin 喂入 + spawn 接管防挂起）；README 红线：绝不写宿主配置。
- **C-01 降级登记**：子 agent 通道持续 TLS 断开/平台繁忙 → 编排者接续实现 IMP2 B2/B3 + IMP3 文档 + 独立验收。
- handoffs/ gitignore。回归 8/8、validate 0、ci PASS。## 2.8.0 · 2026-09-02 · 批判对标真实化 + SKILL 去冗余 + 前置条件替换 describe（子 agent 实现 + 编排者接续验收）
- **OPT1 批判竞品对标真实化**（review-gate.mjs --verify-urls）：URL 真验三态（可达 PASS/404 FAIL/断网 SKIPPED，临时 HTTP server 自测通过）；critique-backlog-next.mjs 输出待优化执行项清单（按 --task 命中 C-xx 承接）；kickoff/completion-report/critique 模板更新；真实仓库 14 行 tracker 实测 C-10/11/12 承接命中正确。
- **OPT2 SKILL 去冗余（减幻觉）**：342→300 行，清除失效引用（schemas.py/error_codes.py/collaboration-protocol/§6.7/§5d/v2.2），版本 2.8，章节骨架全保留 validate 0。
- **OPT2 前置条件替换 describe（提调用率）**：matrix 5 cluster 加 preconditions；planner/prompt/runtime 注入；runtime DEP_PRECONDITION skip（上游未 done/未 consumed → 下游诚实跳过）；实测 T2 无宿主时 7 子任务 skipped，brief 含「前置条件（硬约束）」段。
- 回归 8/8、validate 0、ci PASS。
## 2.7.1 · 2026-09-02 · SkillOps 自进化体检接入（vendor 资产图诊断 + 报告）
- **tt-skillops.py（skillops 技能新增适配脚本，落 TT）**：把 16 个 vendor 资产映射为 SkillOps 五元组（precondition/operation/artifact/validator/failure_modes），建 HSEG 边（redundancy/alternative/dependency），跑 MaintenanceEngine.sweep + GraphOfGraphsPlanner 规划测试，输出自进化体检报告。只读不修改资产。
- **体检结论**：16 资产全部 ≥1 validator（含兜底 artifact_anchor_and_kernel_token）；无 redundancy（无重复实现）；16 条 alternative 边（同域并行路径，健康）；sweep merged=0。
- **发现**：域归类启发式把 be-architect 归 frontend/be-resilience 归 frontend 等不精确（按 desc 关键词）；规划 domain_neighbor 命中非最贴合资产 → 需资产名/任务族标注增强（下期：vendor 资产 metadata 显式标 domain_type）。
- 报告：docs/history/specs/T16-SKILLOPS-report.md。
- 运行：cd skillops 技能目录 → python tt-skillops.py --vendor <tt>/vendor。
## 2.7.0 · 2026-09-02 · 资产调用硬约束 + 前端质变 M2/M3 + FR-7 设计感增强
- **资产调用硬约束（用户反馈子 agent 调用率低）**：SKILL §5.2 加「资产调用硬约束 + 完工前自检（critique 三视角）」；completion-report 模板加「资产消费证据」「完工前自检」必填段；kickoff-prompt 硬性守则加自检 + 资产消费证据要求。登记 tracker C-13（M3 降级）/C-14（调用率优化）。
- **资产调用率实测（编排者）**：prompt 后端无宿主 → T4 资产调用率 0%（brief-only 无产物，设计使然）；a6api 宿主单 brief → plan.md 含锚点+内核词 → assetConsumed=true。根因=无宿主不产出，硬约束已注入。
- **M2 前后端联调**：integration-e2e.mjs（newman 真实请求 PASS + Playwright 交互 + 诚实降级）、contract-change-detect.mjs（契约 hash 变更检测）、FR-3 契约硬前置。
- **M3 视觉回归**：visual-regression.mjs（L0 像素 diff + L1 VLM 抽样，Chrome executablePath 定位）。实测：基线 5 视口 PASS → 改页 4 FAIL → --update-baseline 恢复。
- **FR-7 设计感增强**：design-enhancer.mjs（组合 taste-blocks + shadcn 规范 + design-data 色板/字体 → 设计规范文档，含资产消费证据）。
- 回归 8/8、validate 0。test-reports 保持 gitignore。
## 前端设计质变 PRD v1.0 · 2026-09-01 · 前端质量门 + 原型一致性 + 前后端联调 + 视觉回归（需求挖掘 gate 完成，概念版用户确认）
- **四目标全选**：反 AI-slop（taste-skill 50+ Pre-Flight）/ 产品级 UI（shadcn）/ 高水准设计感（Awwwards）/ 视觉回归自动化（Playwright+VLM）。
- **核心痛点**：前端产出后编排者没及时与后端接口适配——接口未就绪/契约变更无检测/无联调环节/无自动联调测试，交互跳转 bug 滞后暴露。
- **范围**：三块全做（质量门/联调/视觉回归），优先级 联调>质量门>视觉回归>设计感；原型→实现一致性门；工作流内嵌；跟随项目栈。
- **FR-1~7**（GWT）：质量门强制化 / 原型一致性 / 前端按契约实现 / 契约变更检测 / 前后端联调 e2e / 视觉回归自动化 / 设计感增强。
- **批判 4 条含 URL**：不用 Percy/Chromatic（本地自包含）、契约先行需消费深度、联调 mock vs 真实后端边界、Playwright 走执行层依赖。
- 里程碑 M1 质量门 / M2 联调 / M3 视觉回归。PRD：docs/TT-FRONTEND-PRD.md。
## 2.6.0 · 2026-09-01 · 下期三块：失败自动恢复 + 批判反哺自动化 + 监控驱动自动优化（独立子 agent 实现 + 独立验收 + 2 轮 P2 缺陷修复）
- **P1 失败自动恢复**：resilience.mjs 新增 resolveHosts/retryAcrossHosts（--hosts/config executor.hosts → 逐宿主逐模型尝试，记录 recovery 链 stage=host-switch/model-switch）；runtime dispatch 换宿主重试 + subtask.recovery/attempts；全部失败诚实降级（requireExec 保持强制）。实测：首宿主失败→备选成功 recovery 记录、全失败 degraded+warning、无 --hosts 行为不变。
- **P2 批判反哺自动化**：review-gate.mjs 新增 --auto-register（批判解析 → 自动登记 tracker C-xx + 生成 docs/history/tasks/critique-*-task.md，幂等）。**两轮缺陷修复**：①门槛解析统一 parseCritiqueEntries（块式 ## C{n} 也能过 ≥3 硬门槛，原只认表格）；②fieldOf 跳过 markdown 标题行（### 优化方案 → 取内容非 ###）。
- **P3 监控驱动自动优化**：asset-call-rate.mjs 阈值触发三级（自动标记 auto-actions.json / 建议降级 escalated / --apply 登记 tracker），幂等；不改 state 本体。
- 独立验收：P1 recovery 链实测、P2 块式+表格双格式 e2e + 幂等、P3 三级动作 + 幂等；tracker 无测试污染；回归 8/8、validate 0、ci PASS。
- 报告：docs/history/specs/P1/P2/P2FIX/P2FIX2/P3-report.md。
## 2.5.0 · 2026-09-01 · M2 TUI 实时 DAG 视图（TT 优化 PRD FR-4~5 落地，独立子 agent 实现 + 独立验收）
- **M2-1 runtime onStatus 事件钩子**：runGroup.runOne + dispatch 注入 opts.onStatus(subtask, phaseInfo)（running/done/skipped/failed + 耗时 + mode + degraded）；dry-run 不上报、回调异常吞掉、running 瞬时态不落盘。无 --tui 行为与 2.4.0 一致。
- **M2-2 ANSI TUI 渲染器 scripts/lib/tui.mjs**：状态色（待执行 dim/执行中 cyan+spinner/完成 green/失败 red/跳过 yellow/降级警示）+ 关键路径/等待阻塞 \x1b[1;7m 反色 (CRITICAL)/(BLOCKING) + \x1b[H 整帧覆写 + 非 TTY 静态降级 + 退出复位。参考 turbo-ui 手绘任务树，零依赖。
- **M2-3 触发**：orchestrator --tui（只叠加渲染不改语义）+ 独立 scripts/tt-tui.mjs（轮询 state.json 复盘，--poll 默认 500ms）。
- **M2-4 关键路径/阻塞计算**：running 沿 dependsOn 回溯 = 关键路径；idle/pending + 依赖未完成 = BLOCKING。
- **逃生舱**：TT_TUI=off / --no-tui 零渲染。README 补 --tui/tt-tui 用法。
- 独立验收：tt-tui.mjs 复盘已完成 state（DAG 树 + 依赖箭头 + 汇总 done=8/8 degraded=8 blocked=0）；computeAnalysis 关键路径含 running、阻塞含下游；TT_TUI=off 零输出；回归 8/8、validate 0。
- 报告：docs/history/specs/M2-report.md（fake-TTY 37/37 断言）。
## 2.4.0 · 2026-09-01 · M1 自动拆解 + 终端审批（TT 优化 PRD FR-1~3 落地，独立子 agent 实现 + 独立验收）
- **FR-1 拆解引擎 scripts/lib/deconstruct.mjs**：大任务 → 三层拆解 prompt（spec_driven_develop phase/task/lane + S.U.P.E.R + 估算 S/M/L）→ 草案 JSON → schema + 资产白名单 + 无环 + 并行判据硬校验 → 归一化 plan。校验失败拒绝进入审批（exit 6，报具体错误），绝不静默修正。
- **FR-2 终端审批 scripts/lib/approve.mjs**：首屏摘要 + 逐 task y/n/e/a（编辑/拒绝回拆解/剩余全批）+ 非 TTY 降级 + TT_APPROVE_FORCE_TTY=1 脚本化验证。批准 → approvedAt + 逐 task approved → 冻结进编排；中止 exit 6 不落盘。
- **FR-3 plan 兼容**：planner 新增可空 desc/estimate/lane/approved 字段；--plan 产物走既有 freezeContract；--plan --dry-run 零写入；resume 兼容。回归 8/8、validate 0。
- **orchestrator --plan/--draft**：--plan 与 --resume 互斥；--exec 宿主拆解 / --draft 文件 / stdin 手动三路径。
- **dev-planner 自动拆解模式**：新增 Auto-Decompose Mode 章节（frontmatter 未动，S3 不破）。
- 独立验收：y+y+a 分支 3 task 冻结（approved=true/desc/estimate/lane/approvedAt 实证）；n 拒绝回拆解 exit 6 无 contracts；非法草案（白名单外资产+环）拒绝报错。
- 报告：docs/history/specs/M1-report.md。
## 2.3.0 · 2026-09-01 · opencode run 非交互 + OpenAPI 契约源 + 回归隔离 + 仓库归档 + 开源方案（TT 工作流派单，独立子 agent 实现 + 独立验收）
- **T6 opencode adapter 改 opencode run**：裸 opencode <msg> 进 TUI 挂起 → 改 opencode run <msg>（非交互），支持 subtask.model/options.model 插 --model，默认超时 180s；修复后回归 S4/S5/S8 暴露真实依赖（auto 后端真调模型）→ 回归显式 --backend prompt 隔离外部 CLI/模型（机制测试零外部依赖，8/8 恢复）。
- **T7 portman OpenAPI 契约源**：orchestrator 新增 --contract <openapi.json>，be-validator 子任务契约指向 OpenAPI 文件 → portman 1.35.0 真跑 --local lint/collection（pass=true 实测），冻结文件记 contractSource；缺/无效/不存在路径诚实处理。样例 docs/examples/openapi-login.sample.json。
- **T8 CHANGELOG 去重**：43→23 个唯一标题，丢弃 20 个逐字一致重复块，最新条目完整。
- **T9 三机制审查**：可移植性（validate 0 泄露）/ 自进化（CHANGELOG↔version 2.2.9 同步 + F1-F4 内核）/ 批判（tracker 12 条 + review-gate self-test PASS）均健康。
- **T10 仓库归档**：根目录开发日志（ACCEPTANCE×3/CRITICAL/HANDOFF/TEST/PRD/ITERATION/OPTIMIZATION/RELEASE/COMPETITOR-DEPLOYMENT）→ docs/history/；.claude/specs/tasks 56 开发文档 → docs/history/tasks/ + specs/；.claude 整体移除。根目录仅剩开源必需文件。
- **T11 开源方案**：新增 docs/OPENSOURCE-PLAN.md（定位/5 用户场景/渠道方案/7 差异化卖点/边界/3 阶段演进/贡献指南）；README 补目标用户 + 开源协作节 + 版本修正 2.2.9。
- 回归 8/8、validate 0。
## 2.2.9 · 2026-09-01 · 已装库真调脚本接线（be-provider/be-resilience/colorize 从声明→真调用）
- **scripts/di-container.mjs（be-provider → tsyringe+inversify）**：CJS(tsyringe, reflect-metadata) + ESM(inversify) 双容器真实 resolve LLM Provider 图并调方法（anthropic/openai/route/healthCheck/estimateTokens），exit 0。
- **scripts/resilience-check.mjs（be-resilience → cockatiel+polly-js）**：cockatiel 指数退避重试成功 + ConsecutiveBreaker 熔断触发（BrokenCircuitError 未触达上游）；polly-js waitAndRetry 成功。实测 exit 0。
- **scripts/color-mix.mjs（colorize → chroma-js）**：暗亮/色相偏移/mix/对比度(WCAG)/scale 色板，实测 exit 0。
- **内核接线**：三资产 Execution kernel Invocation 行补真实脚本路径（段标题/Kernel/Degradation 逐字未动，S3 漂移门 marker+probe 保留）；COMPETITOR-DEPLOYMENT.md「已装未接」→「真调」。
- 回归 8/8、validate 0、S3 三目标 [kernel 段][probe][marker OK]。
- 报告：.claude/specs/tasks/reports/T5-report.md。
## 2.2.8 · 2026-09-01 · 竞品直用策略 + 前端设计可执行化 + venv 打通（TT 工作流派单，独立子 agent 实现 + 独立验收）
- **竞品直用策略（Competitor-first，SKILL.md §1 + §4 + README）**：允许编排者/执行 agent 直接调用已部署竞品（CLI/库/venv），TT 16 资产保留为方法论兜底；判断一句"竞品可用 → 直用竞品；竞品不可用或 TT 资产有明确差异化优势 → 用 TT 资产"（T4 子 agent 实现）。
- **竞品部署与整合报告**：新增 COMPETITOR-DEPLOYMENT.md（本机实测：opencode 1.18.25 / portman 1.35.0 / semgrep 1.175 / gitleaks go / claude / codex / openclaw + thirdparty 库 + 3 venv + muse-autoskill，16 资产逐条整合矩阵）。
- **前端设计可执行化（frontend-design/SKILL.md 34→52 行）**：显式融入 taste-skill（Design Read → 三 dials → Pre-Flight Check 50+ 项 → 9 个 taste-blocks）+ ui-ux-pro-max（search.py 真实数据检索），解决"前端设计水平差"根因=薄入口无调用路径（T3 子 agent 实现）。
- **venv 打通（C-11 闭环，T1 子 agent 实现）**：gpt-researcher 0.12.3（py3.10 + langchain<1.0 0.3.30）、crewai 1.15.18（py3.11 新 venv）import OK；metagpt 现代版确认不可装（lancedb==0.4.0 未发布，PyPI 硬伤），诚实降级保留 0.1 老版，规划类由 crewai 承担。
- 回归 8/8、validate 0。
# TT skill 鍙樻洿鏃ュ織

> 鐗堟湰鍞竴浜嬪疄婧愩€傛瘡娆℃墽琛?杩唬鍚庤拷鍔狅紱淇敼 SKILL.md 蹇呴』 bump version 骞跺湪姝よ褰曘€?
## Third-party 实际部署记录 · 2026-08-31 · 竞品部署 + A 级替换（非空壳）
- **已部署**：opencode 1.18.25 / portman 1.35.0 / semgrep 1.175 / gitleaks(go) CLI + tsyringe/inversify/cockatiel/polly-js/culori/chroma-js/poline 库（\/thirdparty）。
- **A 级替换**：security-scan.mjs（semgrep+gitleaks 真实扫描，TT 仓库扫出 2 假密钥 + 2 SAST 发现）、color-palette.mjs（culori 实际调色 + WCAG 对比度）；security/colorize 资产接真实命令。
- **不可部署**（诚实标注）：bolt.new 闭源、SkillSpector 未发布、OmniParser/UI-TARS 需 GPU、pr-agent 需 Docker、continue 扩展、cline 官方 CLI 未成熟（clite 0.0.13）、gpt-researcher/metagpt/crewai pip 依赖冲突（待独立 venv）。
- 替换方案：.claude/specs/thirdparty-replacement-plan.md。

## 多宿主实跑验证记录 · 2026-08-31 · A/B 级竞品（claude/codex/openclaw 独立宿主派单）
- **A1 claude 宿主 PASS**：portman 1.35 真实契约校验（通过+失败 diff 双证）；发现 adapter 未真调 CLI（C-08）。
- **A2 openclaw 宿主有条件通过**：opencode 1.18 实跑闭环打通（implementation mode=exec + result.txt）；发现 adapter 无 assetConsumed（C-09）。
- **codex 宿主**：exec 挂起（stdin/代理），不可作 --exec 宿主（C-10）。
- **B 级**：gpt-researcher venv 装成功 import 依赖冲突（C-11）；metagpt venv 装失败（volcengine OSError）。
- 报告：.claude/specs/tasks/reports/（A1/A2/B1/B2）。

## F1/F3 自进化融合 · 2026-08-31 · MUSE 模式落地（资产调用率监控 + memory 自动化）
- **F1 asset-call-rate.mjs**：跑任务后读 state.json 统计每资产路由/正文/消费率，低于 50% 消费率标记需审查（MUSE SkillRefiner 模式）。实测 T2 无 --exec：路由 100%/正文 62.5%/消费 12.5%→7 资产需审查。
- **F3 orchestrator 尾部 memory-snapshot.md**：执行后自动写经验摘要（modes/warnings/调用率/memory_write 提示，MUSE MemoryManager 模式）。
- 回归 8/8、validate 0。

## P0-P2 全面修复 · 2026-09-01 · exec-host 本地代理 + opencode 空输出校验 + 资产调用幻觉根治
- **P0 修复**：exec-host-a6api.mjs 直连 a6api 401 → 改走本地代理 127.0.0.1:15724 + PROXY_MANAGED（与 claude 一致），实测 6 exec 真实产出 plan.md（2.5-7.6KB）。
- **P1 opencode 空输出校验**：opencode.mjs 成功路径读 result.txt，'completed' 占位/空 → 不记 assetConsumed（对齐 prompt D-1 口径）。
- **P1 tracker C-08/C-09 回填 ✅**。
- **P2 skill-sentinel 诚实标注**（自带工具未部署）。
- **P2 degrade 文案区分** all-skipped vs requireExec。
- **P2 CHANGELOG 去重**（待做）。
- **资产调用幻觉根治**（SKILL.md §4 硬约束）：其他平台调用 TT 必须用 TT 随包 vendor 资产、不得用平台自有同名 skill 替代；独立子 agent 派单硬约束（编排者不得自写自验 C-01）。
- **S8 回归修复**：正向只查 prompt adapter consumed（implementation 走 opencode 独立路径不计）。
- 回归 8/8、validate 0、ci CI PASS。

## C-08/C-09 修复记录 · 2026-08-31 · portman 真调 CLI + opencode assetConsumed（host 派单实现 + 独立验收 PASS_WITH_ISSUES）
- **C-08 portman 真调**（openclaw host 实现，独立验收 PASS）：portman.mjs 真调 \portman --local <oas>\（可 --runNewman），pass=真实退出码、成功 mode=exec、描述/非 OpenAPI 诚实降级、Windows .cmd shim 处理。
- **C-09 opencode assetConsumed**（子 agent 实现）：成功路径置 assetConsumed=true。
- **P1 共享 shim**（网络阻断下编排者完成）：resolveCommandShim 抽到 util.mjs，opencode/bmad 复用 → opencode 本机可达（probe ok），assetConsumed 生效。
- 独立验收发现 P2：portman 探测依赖 ws 目录、契约路径含空格误判、orchestrator 冻结契约非 OpenAPI（真调仅在 OpenAPI 契约源）。
- 回归 8/8、validate 0。

## 2.2.7 · 2026-08-31 · 资产表加竞品整合内核列（README + SKILL §1c）
- **README 资产表加「竞品整合内核」列**：16 资产逐一标注 Execution kernel（shadcn/bolt、gpt-researcher、semgrep/gitleaks、SkillSpector、MetaGPT/crewAI、tsyringe、cockatiel/Polly、OmniParser/UI-TARS、culori 等）。
- **SKILL.md §1c 补竞品整合内核说明**：资产名保留原名（方法论身份 + AIHUB_ROOT 替换），竞品以执行内核整合，S3 漂移门机验。
- 回归 8/8、validate 0。

## 2.2.6 · 2026-08-31 · 宿主认证备忘（claude 免登录修复教训入工作流）
- **claude CLI 修复**：删误加 modelOverrides 还原 cc-switch 配置 + 用户级 ANTHROPIC_AUTH_TOKEN=PROXY_MANAGED → claude -p 与 TUI 免 /login。
- **README 宿主认证备忘**：claude/codex/openclaw/a6api 免登录机制 + 教训（改用户代理配置前备份、只经 env/CLI 接入不写宿主配置）。
- **SKILL.md §5.4 宿主 CLI 认证教训**。
- 回归 8/8、validate 0。

## Outside Voice 记录 · 2026-08-31 · a6api --model 透传（跨模型第二意见）
- **exec-host-a6api.mjs --model 透传**：默认 DeepSeek-V4-Flash-0731，可切 gpt-5.6-luna（a6api 验证 HTTP 200）——与 deepseek 跨模型，Outside Voice 成立；显式非法 --model 报错 exit 1；fail 加 await tick 修 Windows 崩溃码。
- **orchestrator --exec 透传**：未知 --flag 原样投喂宿主（KNOWN 集终止）；S5/S8 回归不破。
- **openclaw --model 被 agent 绑定限制**（a6api/gpt-5.6-luna not allowed）——跨模型走 a6api 宿主即可。
- 回归 8/8、validate 0。

## 2.2.5 · 2026-08-31 · openclaw 真机宿主（搁置项闭环）
- **exec-host-openclaw.mjs**：openclaw agent --message-file 非交互宿主（子 agent 实现 + 独立验收 PASS：T2 5 exec assetConsumed=true、调用链真实、无假成功、无 key）。
- 实测：openclaw(deepseek-v4-flash) 与 a6api(同模型) 同源，仅并发宿主；claude/codex 待 cc-switch 侧 /login + proxy 调试（已记录 tracker）。
- 回归 8/8、validate 0。

## 2.2.4 · 2026-08-31 · Phase C 编排内核深化 + D-1 证据强化（派单纪律：3 子 agent 实现 + 独立验收）
- **C-1 dependsOn 级契约验收解锁**：契约缺失 CONTRACT_NOT_FROZEN → 下游 cascade skip（DEP_CONTRACT_NOT_FROZEN）+ plan failed exit 5。
- **C-2 ci.mjs 一键卡点**：validate + review-gate + plan-review --check + regression-all 8 段，任一 fail exit 1。
- **C-3 SKILL.md 系统卡点章节**：契约 cascade / ci.mjs / D-1 强化入 §5.4。
- **D-1 资产消费证据强化**：kernel 资产产物须锚点 AND ≥1 内核词（ASCII 工具 token + 虚词过滤，兼容中文 Kernel 行）；S8 正负向断言。
- 独立验收 PASS_WITH_ISSUES → 修 P1 中文行回落/P1 虚词稀释/P2 S8 负向/P2 注释。
- 回归 8/8、validate 0、ci.mjs exit 0。

## Phase B 记录 · 2026-08-31 · 真机宿主闭环 + 派单纪律（SKILL.md 未改，不 bump）
- **a6api 参考 --exec 宿主**：scripts/exec-host-a6api.mjs（key 走 A6API_KEY env 禁写死；content 空回落剥离 CoT 标记）；config.example/README 固化可复制命令。
- **真机资产调用链**（独立测试 agent PASS）：T2 + --exec 宿主 → 5 exec assetConsumed=true、brief 含方法论全文、产物真实任务相关、无 key 泄露/无宿主绕过。
- **派单纪律（C-01~05 全闭环）**：task01 子 agent 实现、task02/03 独立测试 agent 验收、编排者 0 改动核心；memory_write 完成。
- 回归 8/8、validate 0、无 key 泄露。

## 2.2.3 · 2026-08-31 · 视觉分层 + colorize 计算内核 + gstack 对比
- **frontend-visual-validation 分层**：全量截图+VLM → L0 像素 diff 全量（toHaveScreenshot 零 token）+ L1 VLM 语义抽样（diff 驱动）；新增 scripts/visual-diff-pages.mjs。
- **colorize Execution kernel**：culori / chroma-js / poline 计算内核（前端配色方向纠正，非图像上色）；S3 PHASE2 13 项。
- gstack 规划对比结论入档（TT 保留 GWT+契约+机器 gate，去平台耦合）。
- 回归 8/8、validate 0。

## 2.2.3 · 2026-08-31 · TT 自举优化（契约先行代码化 + vision 内核 + 方法论反哺）
- **task01 契约先行代码化**：freeze 时 subtask 带 contractMode:'frozen'；runtime 调度前校验冻结契约存在，缺失 → CONTRACT_NOT_FROZEN skip + 计划 failed（exit 5，机器可读诚实上报，防跳过契约/静默 describe）。
- **task02 agent-vision-toolkit VLM 内核**：OmniParser v2 + UI-TARS（Execution kernel + probe + 降级）；S3 PHASE2 14 项。
- **task03 SKILL.md 反哺**：§5.1 契约先行已代码化；系统卡点口径。
- **task04 独立批判验收**：PASS_WITH_ISSUES → 修 P1 诚实性（契约缺失不再伪装成功）+ P2 显式标记防绕过。
- 回归 8/8、validate 0、S3 14 项。

## 2.2.2 · 2026-08-31 · dev-planner P2（一键评审 + design-doc 检索 + 防蒙混加固）
- **plan-review.mjs（FR-204）**：autoplan 式一键串评审编排器（CEO→Eng→Design 顺序强制 + 提示词组装 + 报告骨架 + --check 机验：顺序/Eng confidence+引用行/空话/占位全拦）。
- **dev-planner Step 0 design-doc 检索（FR-303）**：grep docs/designs/*.md + build-on/start-fresh + Supersedes 修订链。
- **review-gate --plan 加固**：规划自审分视角校验（### CEO/Eng/Design 子段 各 finding+处置、Eng 含 confidence、裸关键词拦截）。
- **接线**：plan-review 入 SKILL.md §3；口径统一 CEO→Eng→Design（Design 收尾）；version 2.2.2。
- 最终回归审查：回归 8/8、validate 0、FFFD 0、端到端无断链。

## 2.2.1 · 2026-08-31 · dev-planner 优化（gstack 对标，P0+P1）
- **dev-planner Step 0 前提挑战**：拆任务前产 premise 表（≤6 条）+ 4 问结论，逐条确认，任一推翻回需求澄清；escape hatch 二次拒绝只留 2 问仍跑 Premise。GWT 保留。
- **dev-plan.md 三区块**：需求前提挑战 / 设计文档前置链 / 规划自审（CEO→Eng→Design 各 ≥1 finding + 处置）。
- **新模板 ×3**：forcing-questions.md / plan-review-perspectives.md / design-doc.md。
- **review-gate --plan 模式**：校验两区块已填（残留 ___/三视角不全/空/缺均 exit 1）。
- **SKILL.md §3 接线** + 二轮批判验收修复（占位校验 / 输出对齐 / S7 断言）。
- 回归 8/8、validate 0 错误。

## 2.2.0 鈥?2026-08-29 鈥?鍚庣璧勪骇琛ュ叏锛圫killOps 3rd-iteration锛?- **鏍瑰洜**锛歵t 鏄粠 `tgent`锛堝叏鏍堝疄鎴樼増锛塮ork 鐨勫紑婧愬弬鏁板寲鐗堬紝寮€婧愬寲鏃跺彧鎶婂墠绔?璁捐/绉戠爺閾撅紙16 璧勪骇锛夊啓杩?搂1c 骞舵墦鍖咃紝**鍚庣鍗婅竟浠庢湭琚噸鏂板０鏄?*鈥斺€攖t 鐨?SKILL.md 铏芥弿杩?T1-T5 鍏ㄦ爤缂栨帓锛屼絾 backend agent/skill 鏄緷璧栧浘閲岀殑銆屽鍎裤€嶏紝鏁呮鍓嶆湭鎵撳寘銆?- **琛ュ叏 10 涓悗绔祫浜?*锛坴endor/ 鎬绘暟 16 鈫?26锛夛細
  - 8 涓悗绔?agent锛堜粠 `D:\.ai-hub\agents\` 鎼叆锛夛細`be-architect`銆乣be-implementer`銆乣be-provider`銆乣be-resilience`銆乣be-security`銆乣be-tester`銆乣be-validator`銆乣dev-backend` 鈫?`vendor/<name>/<name>.md`銆?  - 2 涓悗绔?skill锛歚sdlc`锛圫DLC 澶嶅悎锛屽惈 plan/develop/review/summarize 瀛愭妧鑳?+ 6 涓瓙 agent锛夈€乣harden` 鈫?`vendor/<name>/SKILL.md`銆?- **琛ラ綈 tt 缂哄け鐨?2 涓悗绔紪鎺掓ā鏉?*锛堝叏 `D:\.ai-hub` 鍘熸湰閮戒笉瀛樺湪锛屾柊寤猴級锛歚templates/task-agent-matrix.md`锛圱1 鏁版嵁搴?T2 鍚庣/T3 AI-RAG-MCP/T4 鍓嶇/T5 杩愮淮 浜旂被浠诲姟璋冨害閾撅紝寮曠敤 be-* + sdlc/harden锛夈€乣templates/orchestration-frontend-backend.md`锛堟墽琛屾帓搴忔€昏〃 + 濂戠害鍐荤粨 鈶爚鈶?鏈哄埗锛夈€?- **鍘荤‖缂栫爜**锛歚sdlc` 鍐?`sdlc/.claude-plugin/marketplace.json` 鍚?`C:\Users\Administrator\.claude\plugins\sdlc` 纭紪鐮侊紙Claude 鎻掍欢涓撳睘鎻忚堪锛屼笌 tt 鏃犲叧锛夛紝宸蹭粠鍖呭唴绉婚櫎锛沗be-*` 涓?`dev-backend` 缁忔壂鎻忔棤鏈満璺緞娉勯湶銆?- **鎺ュ彛涓€鑷存€?*锛歚harden` 琛?`version: 1.0.0`锛沗sdlc` 琛ョ储寮?`SKILL.md`锛坄agent-research` 鍚岀被澶勭悊锛屽惈 name/description/version锛夈€?- **鏍￠獙鍣ㄥ崌绾?*锛歚validate-structure.mjs` 鎷嗗垎 `SKILL_ENTRIES`锛堟湁 SKILL.md锛岄渶 name/description/version锛変笌 `AGENT_ENTRIES`锛堟湁 `<name>.md` 鎻愮ず璇嶏紝鏃?frontmatter锛夛紱`dev-planner` 涓?8 涓悗绔?agent 褰掍负 agent 鍨嬶紱鍙Щ妞嶆€ф壂鎻忚鐩栦袱绫绘潯鐩€?- **SkillOps 3rd-iteration 缁撹**锛氬悗绔祫浜т笌鏃㈡湁 16 璧勪骇涓?*浜掕ˉ渚濊禆**锛坆e-* 鈫?sdlc/harden 鈫?鍓嶇閾撅級锛岄潪鍐椾綑锛沺lanner 鐜板彲璺敱 T2 鍚庣/T5 杩愮淮 浠诲姟閾俱€?
## 2.1.1 鈥?2026-08-28 鈥?鎺ュ彛涓€鑷存€?+ 鍙Щ妞嶆€ф敹灏撅紙SkillOps 2nd-iteration锛?- **鎺ュ彛婕傜Щ淇**: 姝ゅ墠 16 涓殢鍖呰祫浜т粎鏈?`name`/`description`銆佺己 `version` 瀛楁锛堜笌 tt 涓嶄竴鑷达級銆傛湰杞负 14 涓爣鍑?`SKILL.md` 璧勪骇琛?`version: 1.0.0`锛屽苟涓?`agent-research`锛堢鐮斿瓙鎶€鑳?hub锛屽師鏃犻《灞?SKILL.md锛夋柊澧炵储寮?`SKILL.md`锛堝惈 version锛夛紝娑堥櫎鎺ュ彛婕傜Щ銆?- **鍙Щ妞嶆€ф敹灏?*: `skill-sentinel` 涓殑鍝佺墝纭紪鐮?"Tgent 鎻掍欢甯傚満" 娉涘寲涓?"鎻掍欢甯傚満"锛岀‘淇濆閮ㄧ敤鎴风洿鎺ュ彲鐢ㄣ€?- **鏍￠獙鍣ㄥ寮?*: `validate-structure.mjs` 鏂板 **鈶?vendor 璧勪骇 frontmatter 鎺ュ彛涓€鑷存€?*锛坄name`/`description`/`version` 蹇呭惈锛? **鈶?vendor 璧勪骇鍙Щ妞嶆€?* 涓ら」妫€鏌ワ紝灏?SkillOps `add_validator(frontmatter_version_present)` 鍔ㄤ綔钀藉疄涓烘満鍣ㄥ彲鎵ц鐨勮剼鏈牎楠屻€?- **SkillOps 2nd-iteration 缁撹**: 寤烘ā 17 鑺傜偣搴撻噸璺?`MaintenanceEngine.sweep()`鈥斺€?*0 鍐椾綑绨?*锛堣祫浜т簰琛ラ潪閲嶅锛夛紱纭 2 涓閫夌皣 `requirements_elicitation`(prd-writer鈫攙ibe-coding-prd) 涓?`design_review`(audit鈫攃ritique) 涓哄閫夊叧绯讳繚鐣欙紱琛?16 鏉?`frontmatter_version_present` 鏍￠獙鍣?+ 1 鏉?`frontend-design鈫抐rontend-visual-validation` 閫傞厤杈癸紙娓叉煋鈫掓埅鍥撅級锛? 涓牱渚嬩换鍔¤鍒掑櫒璺敱鍏ㄩ儴姝ｇ‘銆?
## 2.1.0 鈥?2026-08-28 鈥?鑷寘鍚寲 + SkillOps 浼樺寲锛堟湰娆★級
- **鑷寘鍚墦鍖?*: 16 涓祫浜ч殢鍖呭唴缃?`vendor/`锛坉ev-planner + 7 澧炲己 ui-ux-pro-max/taste-skill/prd-writer/vibe-coding-prd/agent-research/agent-vision-toolkit/skill-sentinel + 鍓嶇閾?8 涓級銆備换浣曠敤鎴锋嬁鍒?skill 鍗冲彲绂荤嚎浣跨敤锛屼笉鍐嶄緷璧栧閮?AI-Hub銆?- **鏂板 `$SKILL_DIR` 鍙橀噺**: 浣滀负璧勪骇鏍癸紝鎵€鏈夊紩鐢ㄦ敼璧?`$SKILL_DIR/vendor/<name>/SKILL.md`锛沗$AIHUB_ROOT` 闄嶇骇涓哄彲閫夊閮ㄨ鐩栵紙璁句簡鎵嶄紭鍏堢敤澶栭儴鍚屽悕 skill锛夈€?- **鍘荤‖缂栫爜锛堝彲绉绘鎬э級**: vendor/agent-research 鍐?`/Users/lingzhi/...` 鐢ㄦ埛璺緞鏀逛负涓€у崰浣?`<USER_HOME>`锛泃t 鑷韩 SKILL.md + 鑴氭湰缁?`validate-structure.mjs` 鈶?鍙Щ妞嶆€ф牎楠岋紝闆舵硠闇层€?- **SkillOps 缁存姢鍔ㄤ綔**: 寤烘ā 17 鑺傜偣鎶€鑳藉浘锛堣祫浜р啋tt 娑堣垂涓績锛?2 渚濊禆杈?/ 25 澶囬€夎竟锛夛紝瑙勫垝鍣ㄨ矾鐢遍獙璇侀€氳繃锛涚淮鎶ゆ壂鎻忚瘑鍒?prd-writer鈫攙ibe-coding-prd 涓?*澶囬€?alternatives)**鑰岄潪鍐椾綑锛屼繚鐣欎袱鑰咃紱瀵?tt 濂戠害鏂藉姞 `portability` 鏍￠獙鍣ㄥ苟钀藉疄涓鸿剼鏈?鈶ゃ€?- **鑴氭湰鐙珛鍖?*: `sync.mjs` / `detect-platforms.mjs` 鍦ㄧ己 `$AIHUB_ROOT` 鏃朵粠鑴氭湰鑷韩浣嶇疆瑙ｆ瀽 `$SKILL_DIR`锛岀绾挎ā寮忎笉瑕佹眰澶栭儴 AI-Hub 瀛樺湪銆?
## 2.0.0 鈥?2026-08-26 鈥?寮€婧愰€氱敤鍖栵紙浠?tgent v1.23 鏇村悕 tt锛?- **鏇村悕**: tgent 鈫?tt锛圱ogether Agent锛夛紝frontmatter name 鏇存柊锛岃Е鍙戣瘝鏀舵暃銆?- **璺緞鍙傛暟鍖?*: 鍏ㄩ儴纭紪鐮佽矾寰勬敼涓?`$AIHUB_ROOT` / `$PROJECT_ROOT` / `$MEMORY_ROOT`锛堥檮 A 鍙橀噺娓呭崟锛夛紝绉婚櫎 Windows-only `powershell sync.ps1` 渚濊禆锛堟彁渚?`scripts/sync.mjs`锛夈€?- **骞冲彴鑷€傚簲**: 鍥哄畾骞冲彴瑙掕壊 鈫?`scripts/detect-platforms.mjs` 鎺㈡祴 + 瑙掕壊鍒嗛厤绠楁硶锛圢鈮? 澶氬钩鍙?/ N=1 鍗曞钩鍙伴€€鍖栵級銆?- **璧勪骇鍒嗙骇**: 鏍稿績(闅忓寘 assets/ + templates/) / 澧炲己(鍙€夛紝缂哄け闄嶇骇) / 澶栭儴(TTHP 鍗忚鍖呭紩鐢?銆?- **浜х墿璺緞椤圭洰鍖?*: `.opencode\plans\` 绛?鈫?`$PROJECT_ROOT/.ai-hub/{plans,handoffs,test-reports}`銆?- **涓婁笅鏂囧墺绂?*: 杩唬鏃ュ織鈫扖HANGELOG + docs/examples锛涚敤鎴疯瀹?妯″瀷閰嶇疆鈫抎ocs/锛坘ey 鑴辨晱锛夛紱姝ｆ枃浠呯暀鍙縼绉诲師鍒欍€?- **宸ョ▼鍖?*: 鏂板 LICENSE(MIT)銆丱NBOARDING.md銆乿alidate-structure.mjs銆乧onfig.example.json銆乼emplates/脳6銆?
## 1.23 鈥?2026-08-22 鈥?鎵瑰垽鏂瑰悜 prompt锛堝墠韬?tgent锛屽綊妗ｄ簬 archive/skills-tgent-v1.23-backup-20260826锛?- 搂7.2 鎵瑰垽鑰呬汉璁?姣掕垖鏋舵瀯闈㈣瘯瀹?锛涙壒鍒や骇鍑洪┍鍔ㄧ敓浜х骇鏀归€犳柟妗堛€?
锛堟洿鏃?v1.0~v1.22 璇﹁褰掓。澶囦唤 SKILL.md 搂10 杩唬鏃ュ織锛?
## 2.2.4 · 2026-08-31 · 前端静态页对接后端模式沉淀（EduAgent 实战）
- **场景**：fe-html 糖果色静态效果图页需对接真实后端（用户裁定"保持静态页、改后端接口对接"）
- **落地模式**：①`public/edu-api.js` 共享客户端（JWT localStorage + 响应壳解包 + 401 跳登录）②每页 `</body>` 前注入 `<script src="/edu-api.js">` + IIFE 数据加载（`if(!window.EAPI||!getToken())return` 静默降级）③登录按 `data.user.role` 跳转 admin/student 分端 ④chat SSE 解析 `event: token`+`data:` 行 ⑤管理端无独立登录页→用户端导航加角色可见入口
- **关键坑（§5 验收纪律补充）**：改 page.tsx 根路由跳转/静态页后必须**重启 next dev + 清 .next**，dev server 不热重载入口跳转——曾致"页面不可用"假象（dev server 运行 11h 缓存旧编译）
- **沉淀位置**：tgent-project-memory.md（3 条新条目）+ trae-projects/EduAgent/project_memory.md（前端对接专题）+ 本 CHANGELOG

