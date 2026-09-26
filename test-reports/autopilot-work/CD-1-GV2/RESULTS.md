# CD-1+GV-2 RESULTS — capability dispatch 完整形态 + 治理迁移 composer 管道（批 2 第二波，2026-09-26）

执行 agent：autopilot L1（派单 `handoffs/v3/CD-1-GV2-dispatch.md`）。**状态：DELIVERED（待编排者 L2 复核，不自称 DONE）。**

## 交付物（白名单内，五文件 + 证据目录）

| 文件 | 变更 |
|---|---|
| `scripts/lib/activation.mjs` | CD-1：新增 `CAPABILITY_MAP` 受控映射表（头注释声明，capability 请求 → manifest id 逐字映射，禁模糊语义匹配——v3.4 裁定）；`resolveAssetEligibility` 扩展 capability 模式（input.capability 在场时映射解析 → asset 主键降为内部解析产物 → 走全部既有资格规则；reason[] 留痕解析链；无映射 → `INELIGIBLE_CAPABILITY_UNKNOWN` fail-closed）。name-based 路径零改动。 |
| `scripts/lib/runtime.mjs` | CD-1：`dispatch` 接受 `{capability}` 输入（subtask.capability 在场 = capability 模式；解析+资格门 fail-closed → INELIGIBLE_* 具名 skip；选择过程 `{capability, selected_asset, eligible, reason[]}` 进 `subtask.eligibility`；asset 绑定后 AV-3 资格门复用解析结果不重解析，EX-1 能力门控照常）；新增失败记忆记录侧 `recordFailureMemory`（真失败/unavailable → `<ws>/.tt-state/debugging-memory.json`，best-effort）。向后兼容零破坏。 |
| `scripts/lib/governance.mjs` | GV-2：新增 debugging 摘要消费单点——`loadFailureMemory`（fail-soft 读记忆）+ `debuggingMemorySection`（冻结事件过滤最近 3 条 → ≤2KB 摘要节，含失败码计数+指路行；无命中/governance-skills 缺失 → null 静默跳过）。常量 `MAX_DEBUGGING_MEMORY_BYTES=2KB` / `DEBUGGING_MEMORY_WINDOW=3`。GW-1 既有导出零改动。 |
| `scripts/lib/prompt-composer.mjs` | GV-2：新增管道单点 `composeGovernedPlanAssets`（governPlanAssets 同构形态：debugging 摘要优先 → brief 事件治理节兜底 → 经 `governanceSection` 插槽与六段合成）；`composeBrief` 启用 GV-2 截断策略（治理节在场时总长预算 12KB：治理节优先保完整、正文段逐段压 1KB 具名 [truncated]、策略登记 `truncateStrategy='governance-first-truncated-sections'`；无治理节零行为）。`composePlanAssets`（PC-1 形态）保留。 |
| `scripts/orchestrator.mjs` | 最小 diff 两处：①import 行 +2 行注释；②brief 组装处 `composePlanAssets` → `composeGovernedPlanAssets`（workspace 传入供记忆消费）。governPlanAssets ×2 尾节注入保持。 |
| `test-reports/autopilot-work/CD-1-GV2/` | 本目录全部证据（探针驱动 `probe-cd1-gv2.mjs` + `probe-results.txt` + `kill-switch-bytes.txt` + 回归三件 + selftest + manifest 零归因）。 |

禁改清单（contracts/、governance-skills/、webview/、SKILL.md、commands/、plans/ 既有文件、manifest-build.mjs、migration.mjs、matrix.mjs、其他 adapters、vendor/）零触碰；零 git 操作（`git checkout --` 恢复 regression 重跑触碰的 REMEDIATION-2 s16 三件 evidence 文件——仅时间戳/workspace 字段漂移，语义零变化，已还原为 git 基线字节）。

## 1. CD-1 探针 ×4（probe-results.txt CD1-1a..4c，10 PASS）

- **capability 命中**：`{capability:'openapi-validation'}` → 生产 dispatch 全链 → `subtask.eligibility={capability, selected_asset:'be-validator', eligible:true, reason[2]}`（capability match + 资格判定链）；be-validator adapter（portman/Spectral）与 security adapter（semgrep）经生产 `resolveAdapter` 注册表可达（CD1-1a/1b/1c/1d）。
- **多候选决策留痕**：同 capability 文本多 manifest 行夹具 + 运行时全链 reason≥2 条留痕（CD1-2a/2b）；`CAPABILITY_MAP` 值 ⊆ manifest id 完备性断言（10 键 9 值，CD1-2c）。
- **未知 capability 拒绝**：`INELIGIBLE_CAPABILITY_UNKNOWN` 具名 skip，selected_asset=null、reason 具名"不在 CAPABILITY_MAP 受控映射（fail-closed 不猜）"、adapter 未触达（CD1-3a/3b）；映射键大小写不敏感命中（CD1-3c）。
- **asset name 向后兼容**：name-based 派单零改动（be-validator 资格门通过 + prompt adapter 真实产出 brief、eligibility 无 capability 字段注水，CD1-4a/4b）；未知资产照旧 `INELIGIBLE_ASSET_NOT_FOUND`（CD1-4c）。

## 2. GV-2 探针（GV2-5a..5f + G-8a..c，9 PASS）

- **composer 管道治理节在场**：六段 + governanceSection 插槽共存——implementation 子任务 brief 含 `# Role…# Verification` 六段 + `--- governance: test-driven-development ---` 插槽节（位于六段之后，GV2-5d）；无治理/治理缺席 → 零注入零行为。
- **debugging 摘要注入（失败后重派场景）**：E2E 两轮——run1 生产 dispatch 未知 capability 失败 → 记录侧写记忆 `{"code":"INELIGIBLE_CAPABILITY_UNKNOWN","event":"gate_failed"}`（GV2-5e）；run2 同 workspace 真实 orchestrator 重派 → implementation brief 带 `--- governance: systematic-debugging（failure memory） ---` 摘要节（≤2KB：523B 实测，含失败码计数 ×2 + 指路行；GV2-5a/5b/5c/5f）。
- **共存护栏**：EX-1 能力门控照旧 CAPABILITY_MISSING（G-8a）；governance-skills 缺失 → 摘要节静默跳过 null（G-8b）；S16 真实状态机照旧拒绝 failed→done（G-8c）；AV-3 资格门复用解析链不重解析。

## 3. 截断策略（GV2-6a..6e，5 PASS）

治理节在场 + 合成超限 → `truncateStrategy='governance-first-truncated-sections'` 登记、6KB 治理节**字节级完整**、正文段（Mission/Context/Output Contract）逐段压 1KB 并具名 [truncated]、总长回落 12KB 预算内（实测 compiled 10601B）；无治理节 → 策略字段缺席（PC-1 逐段 4KB 护栏不变）。

## 4. kill-switch 字节级比对（GV2-7a..7d，4 PASS）

- `YY_PROMPT_COMPOSER=off` 两轮生产 orchestrator 真跑：off 正文段（7551B）是 on 正文段（15609B）的**字节级前缀**（on = off 旧拼接 + 六段编译块）；off 形态 = 旧拼接（正文内治理尾节、无六段）；on 形态 = composer（六段 + 插槽治理节）。字节数/sha256 见 `kill-switch-bytes.txt`。
- 纯函数基线：composeBrief 产物 = vendor 前缀 + 六段 + 治理节**字节级相等**（GV2-7d）。

## 5. 回归三件 + audit-index selftest + manifest 零归因

| 项 | 结果 | 证据 |
|---|---|---|
| regression-all | **24 PASS / 0 FAIL**（含 S16 三段真实探针、S14b audit-index 接入门） | `final-regression.txt` / `final-regression-full.txt` |
| preflight | **8 PASS / 0 FAIL / 0 SKIP** | `final-preflight.txt` |
| validate-structure | **[OK] 0 警告** | `final-validate.txt` |
| audit-index selftest | **68 PASS / 0 FAIL**（current 三面新鲜） | `final-audit-index-selftest.txt` |
| manifest 零归因 | sha256 before == after == `c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1`（AS-1 登记现值，audit-index B-6 期望值一致） | `manifest-sha-before.txt` / `manifest-sha-after.txt` |
| governance-skills 本体 | 零触碰（本单未改该目录任何文件） | `governance-skills-hashes-after.txt` |

## 6. 偏差与判定登记（编排者 L2 复核面）

1. **E2E 记录侧调用形态**：orchestrator 生产链尚无 capability 字段入口（planner 边界外，v3.2 裁定主键 spirit 延续），GV2-5e 记录侧经生产 `runtime.dispatch` 调用触发（非自造 oracle，F-036 纪律：判定调生产函数）；消费侧 GV2-5f 为真实 orchestrator 全链。
2. **记忆记录面比指路行宽**：指路行维持 F-030 映射表 fail-closed（未映射码不指路）；记忆记录覆盖"真失败（result.ok===false 含宿主输出串/无码）+ unavailable skip"——宿主输出串等未映射形态也是门/执行面失败（F-030 兜底语义），event 一律归 gate_failed，code 截断 120 字符。指路行判定单点未动。
3. **多候选语义**：CAPABILITY_MAP 键唯一 → 映射产物 id 唯一；"多候选"按 manifest 多行共享 capability 文本 + 逐行资格判定全量 reason 留痕实现（eligible=false 不回退他行，fail-closed）——v3.2"eligible 且未 drop 的最优候选"的确定性保守口径，语义扩张（如按 when_to_use 评分择优）未做，留 L2 裁定。
4. **capability 与 asset 同传时**：capability 为准，asset 视为过期提示（logger.info 留痕覆盖行为）。
5. **governanceBriefSection 双节共存形态**：implementation 子任务在 GW-1 尾节（正文内）+ GV-2 插槽节（六段后）共存——插槽解析序"摘要优先、否则 brief 事件节"，与尾节注入互不覆写（两键匹配各自判定）。

## 7. 6 小步纪律执行

①resolver+映射 → ②dispatch capability → ③governance/composer → ④orchestrator 接线 → ⑤探针 31/31 → ⑥回归+RESULTS。每步落盘 ≤10 分钟粒度，探针输出全部在 `test-reports/autopilot-work/CD-1-GV2/`。
