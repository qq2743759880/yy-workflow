# AV-2 RESULTS — Manifest 构建器 + 16 资产数据填充（批 1）

日期：2026-09-24 · 执行：L1 独立 agent（AV-2） · 派单：`handoffs/v3/AV-2-dispatch.md` · 计划：`plans/execution-plan-v3-20260923.md` §二/v3.1/v3.2 · 写面：`handoffs/v3/write-faces-batch1.md`（AV-2 三项全在其列，零越权）

## 交付物（白名单内）

| 文件 | 说明 |
|---|---|
| `scripts/manifest-build.mjs` | manifest 唯一构建器（单源确立；自带受约束 YAML 子集解析，零新增依赖） |
| `contracts/manifest-sources/*.yaml` ×16 | sidecar：三核心字段方法论内容（我方署责任），source 引 vendor 路径行号；vendor 文件一字未改 |
| `contracts/asset-manifest-v2.json` | 构建产物（16 行，schema `asset-manifest-v2@1.0.0`，AV-1 冻结面） |
| `test-reports/autopilot-work/AV-2/` | selftest.mjs / selftest.json / out-regression.txt / RESULTS.md |

## 产物 hash（Gate-2 runtime hash 绑定用）

```
sha256(contracts/asset-manifest-v2.json) = f770140ca4bc0e458a7eaa74b21a3956e45e34112a1c24132337a27e849a3360
```

产物无时间戳等易变字段 → 同输入重跑字节一致（selftest T6 实测两次构建 hash 相等）。

## 16 行 sidecar 摘要（id / cluster（CLUSTERS 重算）/ source 锚点 / 三字段依据）

| id | cluster | source | 三字段内容依据（vendor 头部 + EA-1） |
|---|---|---|---|
| agent-research | T3 | vendor/agent-research/SKILL.md#L1-L8 | hub 29 子技能（调研/论文/实验）；not_to_use 引 EA-1 实测（BW 四项目工程类调研零命中，宁窄） |
| agent-vision-toolkit | T4 | vendor/agent-vision-toolkit/SKILL.md#L1-L13 | 五 CLI+scripts 问句-工具表；not_to_use=无图像任务/共享 vision config 缺失 |
| be-architect | T1,T2 | vendor/be-architect/be-architect.md#L1-L5 | Hono/Express API 设计+契约产出；kernel=csalvato/system-design-template probe/内置分层约定 |
| be-provider | T1,T2,T3 | vendor/be-provider/be-provider.md#L1-L5 | 多 provider LLM adapter（流式/token/成本/限速/回退）；kernel=di-container.mjs 真调 |
| be-resilience | T2,T5 | vendor/be-resilience/be-resilience.md#L1-L5 | 熔断/退避/超时/降级/健康/舱壁；kernel=resilience-check.mjs 真调+cockatiel/polly probe |
| be-validator | T1,T2,T3,T5 | vendor/be-validator/be-validator.md#L1-L5 | Zod/OpenAPI/RFC 9457/消毒；kernel=portman/contracteer（vendor L205 Execution kernel） |
| colorize | T4 | vendor/colorize/SKILL.md#L1-L10 | 策略性补色；MANDATORY PREPARATION 禁猜测；not_to_use 引 EA-1 零调用+计划 §六 colorize 覆辙 |
| dev-planner | T3 | vendor/dev-planner/dev-planner.md#L1-L5 | 需求分析/GWT AC/handoff spec+Premise Challenge；EA-1 实测 4/4 工作区署名消费 |
| frontend-design | T4 | vendor/frontend-design/SKILL.md#L1-L5 | taste 工作流+search.py 真查两步必做（MUST，禁跳）；Pre-Flight 矩阵 |
| frontend-visual-validation | T4 | vendor/frontend-visual-validation/SKILL.md#L1-L5 | 截图→审查→修正→复测；L0 像素全量+L1 抽样；非 Web/无 Playwright 前置不满足即阻塞 |
| implementation | T1,T2,T3 | vendor/implementation/implementation.md#L1-L5 | 冻结契约→可运行代码；kernel=opencode adapter（OPENCODE_NOT_AVAILABLE 诚实降级） |
| planning | T4 | vendor/planning/SKILL.md#L1-L5 | formal/vibe PRD 四确认关卡；not_to_use 引 EA-1（BW 规划由 dev-planner 承担） |
| review | T2,T4,T5 | vendor/review/SKILL.md#L1-L5 | critique+可复现验证+polish（YAGNI）；kernel=pr-agent/continuedev probe/内置降级 |
| sdlc | T1,T2 | vendor/sdlc/SKILL.md#L1-L5 | BMAD 四阶段+六 agent；kernel=cline（planned-only/SDLC_NOT_AVAILABLE 诚实降级） |
| security | T2,T4,T5 | vendor/security/SKILL.md#L1-L5 | audit→harden→backend specialist；kernel=semgrep+gitleaks 真扫 exit 1，缺工具诚实标注 |
| skill-sentinel | T5 | vendor/skill-sentinel/SKILL.md#L1-L5 | SKILL.md 恶意模式扫描；vendor P2 诚实标注：自带工具未部署，probe 不过不得伪报已扫描 |

**drop 旗标（任务 C）**：16/16 行 `drop_pending:false, drop_allowed:false`，显式布尔（构建器只接受字面 `true`/`false`）——字段名与 B1-GATE 派单一致，其 preflight P6 已实测读本产物（见下）。

## 自测证据（selftest 10/10 PASS，详见 selftest.json）

| # | 测试 | 结果 |
|---|---|---|
| T1 | 构建产物 16/16 行 | PASS |
| T2 | 逐行 drop_pending/drop_allowed 显式布尔 false 起步 | PASS |
| T3 | schema 九必填字段全齐（缺一即空值禁入） | PASS |
| T4 | **`asset.mjs readManifest()`（AV-1 接口）实读产物 16 行全过 CANDIDATE_INVALID 校验** | PASS |
| T5 | **`asset.mjs readManifestEntries()` 实读 {entries} 口径 16 行通过** | PASS |
| T6 | 单源确定性：同输入重跑字节一致 | PASS |
| P1 | fail-closed：删 sidecar `verification` 字段 → `CANDIDATE_INVALID sidecar security.yaml: 必填字段缺失或为空 "verification"`，产物拒绝落盘 | PASS |
| P2 | fail-closed：source 路径不存在 → `CANDIDATE_INVALID … source 路径不存在或不可读: vendor/review/NOT-EXIST.md（ENOENT）` | PASS |
| P3 | fail-closed：`drop_allowed: no`（非显式布尔）→ `CANDIDATE_INVALID … "drop_allowed" 必须为显式布尔字面量 true/false` | PASS |
| P4 | fail-closed：删整个 sidecar → `CANDIDATE_INVALID 资产 sdlc: 缺 sidecar …` | PASS |

asset.mjs 本身零改动（AV-1 面纪律遵守）。

## 回归（只跑一次，实际段数注明）

- `npm run regression`：**14 PASS / 0 FAIL（实际段数=14）**——B1-GATE 的 S14（preflight invariants）已先行合入并在本次回归同场通过；S15 为占位（AS-1 时填充）。输出归档 `out-regression.txt`。
- 关键联动实证（B1-GATE preflight 消费本单产物）：
  - `PASS P5 buildManifest 单源 — 唯一写方 scripts/manifest-build.mjs ✓`
  - `PASS P6 DROP_ALLOWED 断言 — 扫描 16 行：无 drop-pending 行（当前无 drop 意图）`
  - `PASS P4 CLUSTERS ↔ 磁盘 — 16 资产 vendor/<name>/ 文档齐全`
- `npm run validate`：**0 警告 / PASS**。
- vendor/ 内文件零改动；禁改文件（asset.mjs/orchestrator.mjs/regression-all.mjs/SKILL.md/commands/webview/plans）零触碰；禁 git 遵守；未跑 BFX/FE 历史回归目录。

## D-偏差

1. **cluster 口径**：产物 cluster 按 schema 明文权威源（matrix.mjs CLUSTERS）重算，为多簇数组（如 security=T2,T4,T5，与 EA-1 BASELINE.md 簇列一致）；AV-1 冻结表 16 行的簇列为单值暂记（如 security=["T5_OPS"]），两者不一致处以 CLUSTERS 为准（schema §Schema 定义"cluster…来自 matrix.mjs CLUSTERS"）。
2. **name/role/capability 为 vendor 逐字提取**（schema 提取源纪律 §1-2：frontmatter + 首段正文首句），与冻结表人工转写值存在措辞差异（冻结表 role 为中文转写；agent-research/agent-vision-toolkit 冻结表 capability 为占位注记）。冻结表 Owner receipt 本为 PENDING_OWNER_RECEIPT 草稿态，本产物为构建器按纪律的机器提取口径。
3. **implementation.md 无 frontmatter**：name=id（目录名）、capability=role=首段首句（与冻结表口径一致，无编造）。
4. **CANDIDATE_INVALID 导出重名 2 处**（asset.mjs + manifest-build.mjs）：preflight P2 按 LEGACY_DUP_EXPORTS 登记 WARN（非阻断），与既有 13 组存量重名同口径。
5. **sidecar not_to_use 引用 EA-1 实测消费语义**（agent-research/colorize/planning 等写窄依据）：属派单许可的内容依据（vendor 头部+EA-1 消费语义），留痕于各 sidecar 头注释。
6. **YAML 子集自解析**：仓库无 yaml 依赖，构建器自带受约束子集解析（标量/列表/显式布尔），格式契约写死在构建器头注释；如未来引入 yaml 库可替换解析层而不动数据面。

## 结论

派单任务 A/B/C + 自测 5 项全部完成并有证据；回归与 validate 绿。**不自称 DONE**——关账待编排者核证据、Gate-2 runtime hash 绑定与 Owner 侧放行。
