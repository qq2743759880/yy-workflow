# EA-1 — 16 资产基线测量（BASELINE）

日期：2026-09-23 · 执行：L1 只读 agent · 派单：`handoffs/v3/EA-1-dispatch.md` · 计划：`plans/execution-plan-v3-20260923.md` §五 EA-1

## 口径（先读）

- **权威清单**：`scripts/lib/matrix.mjs` CLUSTERS 五簇 candidates 去重 = 16 资产（实测复算）。
- **腿①（机验链路消费，机制级）**：S8 断言在 `scripts/regression-all.mjs:178-191`，state.json 产出于临时目录且跑完即删（`:183/:189` 读、`:191` 后 rm）——不可复跑取数，改引归档回归输出。S8 以 `--task "backend login module"` 走 T2 簇全链，`exec=8` 恰等于 T2 candidates 去重后的 8 个资产（8 subtask = 8 资产一一对应，**映射为推断**）。
- **腿②（真实项目取证，BW 四项目）**：BW-1..4 走 N=1 手动模式，**只有 journey.json 无 state.json**，asset-call-rate `--state` 口径不可用；消费判定以工作区残留（dev-plan/brief/task 文档）grep + session-notes 为准，属**署名级**证据（非 vendor 正文调取级）。
- 两级消费不等价：S8 机验消费证明"链路可达、门禁会记账"；BW 取证证明"真实项目是否真用"。AS-1 drop 判据 = **真实项目零调用**（腿②），计划 §三 drop-7 清单与本测量对齐见 D-偏差 5。

## 16 行基线表

| # | 资产 | 簇 | 机验链路消费证据 | BW 取证（消费/提及/零现） | 适配器 | vendor 体积 | 备注 |
|---|------|----|------------------|---------------------------|--------|-------------|------|
| 1 | be-architect | T1,T2 | S8 exec=8 链内（实测）；逐资产实测样本 `AV-1/s8-repro-output.txt`：首子任务 be-architect assetConsumed:true，plan.md 含内核词 csalvato/system-design-template；S3 marker 绿 | 零现（推断：全四工作区 grep 无命中） | prompt | 8.0K | 计划 drop-7 对象 |
| 2 | implementation | T1,T2,T3 | S8 exec=8 链内（实测）；PHASE2 专用 adapter + 内核 opencode（regression-all.mjs:41） | 提及（实测：BW-4 `tasks/task01:14`、`task10:14` 引用 `$SKILL_DIR/vendor/implementation/implementation.md`，注明"派单时"，BW-4 止步 step 3 未派单） | **dedicated(opencode)** | 24K | replace 目标（AS-2） |
| 3 | be-validator | T1,T2,T3,T5 | S8 exec=8 链内（实测）；PHASE2 专用 adapter + 内核 OpenAPI/contract | 零现（推断） | **dedicated(portman)** | 9.0K | replace 目标（AS-2） |
| 4 | be-provider | T1,T2,T3 | S8 exec=8 链内（实测）；S3 marker 绿 | 零现（推断） | prompt | 12K | 计划 drop-7 对象 |
| 5 | sdlc | T1,T2 | S8 exec=8 链内（实测）；PHASE2 专用 adapter + 内核 cline/BMAD | 零现（推断） | **dedicated(bmad)** | 76K | replace 目标（AS-2） |
| 6 | be-resilience | T2,T5 | S8 exec=8 链内（实测）；S3 marker 绿 | 零现（推断） | prompt | 8.0K | 计划 drop-7 对象 |
| 7 | security | T2,T4,T5 | S8 exec=8 链内（实测）；PHASE2 内核 semgrep/gitleaks | 零现（推断） | prompt | 38K | replace 目标（AS-2） |
| 8 | review | T2,T4,T5 | S8 exec=8 链内（实测）；PHASE2 内核 pr-agent/continuedev | 提及（实测：BW-4 `tasks/task10:14` 署名 + `plans/critique-passgen.md:3` "按 vendor/review critique 内核三视角"；BW-1..3 批判走 review-gate 脚本非本资产） | prompt | 38K | replace 目标（AS-2） |
| 9 | agent-research | T3 | 仅 S3 marker（gpt-researcher，结构性）；无机验消费证据 | 零现（实测：四工作区 grep 无命中；BW 竞品核验由编排者 curl/npm registry 直做，BW-1 session-notes:16、BW-3 session-notes:10） | prompt | 916K | 计划 drop-7 对象 |
| 10 | dev-planner | T3 | 无机验消费（S3 PHASE2 表无此项） | **消费（署名级）**：4/4 工作区 dev-plan 均含"## 需求前提挑战（dev-planner Step 0）"（实测）；BW-4 brief `00-init-brief.md:27` 署名核心资产 | prompt | 8.0K | BW 唯一有消费痕迹的资产；正文调取存疑见 D-偏差 3 |
| 11 | frontend-design | T4 | 仅 S3 marker（shadcn/bolt.new）；无机验消费证据 | 零现（推断：四项目全 CLI 无前端） | prompt | **4.1M（16 资产最大）** | replace 目标（AS-2） |
| 12 | frontend-visual-validation | T4 | 无（S3 PHASE2 表亦无此项） | 零现（推断） | prompt | 8.0K | 计划 drop-7 对象 |
| 13 | agent-vision-toolkit | T4 | 仅 S3 marker（OmniParser/UI-TARS）；无机验消费证据 | 零现（推断） | prompt | 976K | 计划 drop-7 对象 |
| 14 | colorize | T4 | 仅 S3 marker（culori/chroma-js/poline）；无机验消费证据 | 零现（推断） | prompt | 13K | 计划 drop-7 对象；计划 §六"colorize 覆辙"典故即此 |
| 15 | planning | T4 | 仅 S3 marker（MetaGPT/crewAI）；无机验消费证据 | 零现（推断：BW 规划由 dev-planner/编排者承担） | prompt | 74K | replace 目标（AS-2） |
| 16 | skill-sentinel | T5 | 仅 S3 marker（SkillSpector/skill_sentinel）；无机验消费证据 | 零现（推断） | prompt | 174K | replace 目标（AS-2） |

**证据文件（腿①，多处归档一致）**：`test-reports/autopilot-work/FIX-2/out-regression-after.txt:25`（及 BFX-A、BFX-C、EX-1、FIX-3、ON-1 同位行）：`PASS S8 资产消费证据 exec=8 false(正)=0 false(负)=>1`；S3：`:20` `PASS S3 Phase 2 替换清单（3 个高杠杆目标现状契约完整）`。FIX-2 `out-probe-results.json`（12 PASS/0 FAIL）中 P2/P5/P8 的 exec=1 为 executor 映射链路证据，**不计入 per-asset 消费**。

**证据文件（腿②）**：`test-reports/autopilot-work/BW-1..4/session-notes.md`（已归档）+ `/d/.ai-hub/tmp/project-run-0922{,-bw2,-bw3,-bw4}/workspace/` 残留（docs/yy-dev-plan*.md、00-init-brief.md、tasks/*.md、plans/critique-passgen.md、reports/completion-report.md）。

## 零真实消费清单（AS-1 drop 最硬输入；判据=腿②真实项目零调用）

13 个**零现**：be-architect、be-provider、be-validator、be-resilience、sdlc、security、agent-research、frontend-design、frontend-visual-validation、agent-vision-toolkit、colorize、planning、skill-sentinel
2 个**仅提及未调用**：implementation（BW-4 派单计划引用，未派单）、review（BW-4 批判协议署名，无正文调取证据）
→ **真实项目零调用合计 15/16**；唯一有 BW 消费痕迹的是 dev-planner（署名级，4/4）。

## 高消费清单

- **机验链路级（机制消费，S8 exec=8）**：T2 八资产 = be-architect、implementation、be-provider、be-resilience、security、sdlc、review、be-validator（每资产 1 次机制消费，锚点+内核词双断言绿）。
- **真实项目级（BW）**：dev-planner（4/4 工作区前提挑战署名）。
- 两者交集为空之外的高置信资产：implementation、be-validator、sdlc、review、security 同具"机验消费 + 专用 adapter/marker"双重证据（其中 implementation/be-validator/sdlc 为三专用 adapter 资产）。

## 复算命令（抽查 3 行）

1. 16 资产清单与簇归属（行 1-16 的资产|簇列，已实测复算 =16）：
   `node -e "import('file:///D:/.ai-hub/skills/yy/scripts/lib/matrix.mjs').then(m=>{const s={};m.CLUSTERS.forEach(c=>c.candidates.forEach(a=>{(s[a]??=new Set()).add(c.id)}));console.log('count='+Object.keys(s).length);console.log(Object.entries(s).map(([k,v])=>k+':'+[...v].join(',')).join('\n'))})"`
2. 机验 exec=8 与 S3（表中机验列）：`grep -n "S8 资产消费\|S3 Phase 2" D:/.ai-hub/skills/yy/test-reports/autopilot-work/FIX-2/out-regression-after.txt`
3. vendor 体积与 BW 署名（行体积列、dev-planner 行）：`cd D:/.ai-hub/skills/yy/vendor && du -sh frontend-design dev-planner` ；`grep -rn "dev-planner Step 0" /d/.ai-hub/tmp/project-run-0922*/workspace/docs/yy-dev-plan*.md`

## D-偏差（证据缺失与口径说明）

1. **BW 无 state.json**：四工作区仅 journey.json，asset-call-rate `--state` 精确计数不可用；BW 消费判定降为署名级（文档段落署名 + 全工作区 grep），非 vendor 正文调取级。
2. **S8 state.json 跑完即删**（regression-all.mjs:191 rm）：per-asset exec 分解为推断（exec=8 与 T2 八资产一一对应）；逐资产实测样本仅 be-architect 一枚（`AV-1/s8-repro-output.txt`，含内核词 plan.md 摘录）。
3. **dev-planner 口径冲突**：4/4 署名消费 vs BW-1 `reports/completion-report.md:33` 自报"vendor/dev-planner 等 | 未调用（无外部宿主，规划由编排者按 reference/ 文档执行）"——协议形状被真实使用，正文调取未被证实，评级输入按"署名级消费"记账。
4. **归档输出编码**：FIX-2 probe 输出为 GBK 乱码（内容可辨，12/12 PASS）；不影响结论。
5. **与计划 drop-7 的对齐**：计划 §三 drop-7 = be-architect、be-provider、be-resilience、colorize、frontend-visual-validation、agent-vision-toolkit、agent-research，全部落在本次"零现"13 之内 ✓。差异：frontend-design/planning/skill-sentinel 虽零现但走 replace（AS-2 有外部等价物选型）；be-validator/sdlc/security 零现但保留（专用 adapter/链路支柱）——此为施工决策非测量差异。be-architect/be-provider/be-resilience 属"有机验链路消费、无真实项目消费"组，S8 机制消费不构成 drop 反证。
6. **本测量只读**：零源文件改动、零 git、零写仓库命令；唯一新建物为本目录。
