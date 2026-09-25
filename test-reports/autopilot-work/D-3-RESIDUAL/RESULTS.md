# D-3-RESIDUAL RESULTS — drop 7 残留面 17 文件分类清理（D-3 偏差收口）

> 执行：autopilot 管线 L1 独立执行 agent（D-3-RESIDUAL-dispatch 授权，全新上下文）｜日期：2026-09-25
> 上游：AS-1（drop 7 + S15 六断言）偏差 D-3 移交项。契约权威：contracts/asset-migration.md + change.record cr-20260925T102900Z-as1-drop7.json。
> 本文档不自称 DONE——L2/Owner 复核后方可关账。

## 一、17 文件分类处置表（逐文件：类 + 理由 + diff 摘要）

| # | 文件 | 类 | 理由 | diff 摘要 | 复验 |
|---|---|---|---|---|---|
| 1 | `scripts/color-mix.mjs` | **A 删除** | colorize 专属增强脚本（chroma-js 真调），colorize 已 drop 成孤儿；全仓活面 grep 零引用 | 文件删除（原 39 行） | node --check 全量过；删除前 grep 全活面零引用（§三） |
| 2 | `scripts/color-palette.mjs` | **A 删除** | colorize 专属增强脚本（culori+poline 真调），同上 | 文件删除（原 48 行） | 同上 |
| 3 | `scripts/design-enhancer.mjs` | **A 删除** | FR-7 设计规范生成器，正文引用 colorize/color-palette（drop 资产）；全仓活面 grep 零引用 | 文件删除（原 121 行） | 同上 |
| 4 | `scripts/di-container.mjs` | **A 删除** | be-provider 专属增强脚本（tsyringe+inversify 真调），be-provider 已 drop | 文件删除（原 101 行） | 同上 |
| 5 | `scripts/resilience-check.mjs` | **A 删除** | be-resilience 专属增强脚本（cockatiel+polly 真调），be-resilience 已 drop | 文件删除（原 95 行） | 同上 |
| 6 | `README.md` | **B 活文档** | 资产表/目录树/计数全部按 16 资产书写 | 资产表 13 行→9 行（删 colorize、frontend-visual-validation、agent-research、agent-vision-toolkit 4 行；be-* 合并行改 be-validator 单行）；目录树 vendor 16→9；全部「16 个/10 skill+6 agent/TT 16 资产」计数→「9 个/6 skill+3 agent/TT 9 资产」；S3 漂移门行去「（14 项）」旧计数；TOC 锚点同步。零 drop 资产名残留 | grep 7 名 0 命中 |
| 7 | `reference/asset-integration.md` | **B 活文档** | 随包资产清单表按 16 资产书写 | 表删 3 行（前端辅助/调研/视觉质检）、be-*（4）行改 be-validator 单行；竞品内核示例 agent-research→gpt-researcher 改 be-validator→portman；「TT 16 资产兜底」→「TT 9 资产」 | grep 0 命中 |
| 8 | `reference/planning.md` | **B 活文档** | T2 后端任务链仍引用 be-architect/be-resilience 上游 | 任务链改「契约先行冻结（上游 agent 已 drop 语义）→ implementation → security 加固 → be-validator/review 验收」 | grep 0 命中 |
| 9 | `reference/frontend-gate.md` | **B 活文档** | §6.6 资产分级表含 agent-research/agent-vision-toolkit | 该行改 skill-sentinel 单资产行（用途/降级列同步收窄） | grep 0 命中 |
| 10 | `templates/orchestration-frontend-backend.md` | **B 活文档** | 执行排序图与 14 闸门表引用 be-architect/be-resilience/agent-research | 阶段 1「be-architect 产 contract.md」→「implementation 簇产 contract.md」；阶段 3 去 be-resilience；阶段 5 去 agent-research；闸门② 判据改「契约先行冻结」；闸门⑨ 改「security 簇加固覆盖限流/降级路径」 | grep 0 命中 |
| 11 | `templates/task-agent-matrix.md` | **B 活文档（S12 联动面）** | 五类任务总览/调度链图/16 资产速查表全按 16 资产书写 | 总览表 5 行主干全部对齐 CLUSTERS 9 资产 candidates/phases；T2 调度链图去 be-architect/be-resilience（改「契约先行冻结」）；速查表 16 行→9 行（逐字=CLUSTERS 收缩名单）；头注改 9 资产簇化版（drop 名单不重抄，指向 change.record）。**改后 S12 双向漂移门复跑 PASS 19 项一致** | kickoff-drift-check PASS；validate-structure 0 警告 |
| 12 | `contracts/asset-manifest-v2.md` | **C 豁免不改** | schema 历史文档：「行数随资产重组变化，schema 不绑定 16」为显式历史声明；16 行基线数据是批 0 冻结确认的历史证据面 | **零改动**（S15-A1 豁免口径：改了反而篡改） | 与冻结基线一致，零 diff |
| 13 | `contracts/C-R3-review-checklist.md` | **C 豁免不改** | 2026-09-13 Owner 冻结决断单据（R3-2/R3-9 用 colorize 作 fixture 示例），历史决断证据面 | **零改动** | 同上 |
| 14 | `scripts/lib/adapters/prompt.mjs` | **B/D 注释面** | 仅一行注释提及 agent-research（drop 资产），逻辑零涉及 | 注释示例改在役资产（be-validator/skill-sentinel） | node --check 过；grep 0 命中 |
| 15 | `scripts/lib/activation.mjs` | **D 配置删键** | CATALOG_IDS 16 资产配置键（类 D：CATALOG_IDS 类配置收缩）+ 2 处 16 计数注释/报错文案 | CATALOG_IDS 16→9（含 be-validator，对齐 manifest 权威名单）；ASSET_NOT_FOUND 报错文案 16→9；extractPayloadFromBrief 注释去 colorize 实测举例 | node --check 过；动态验证 length=9 |
| 16 | `scripts/lib/evolution.mjs` | **D 配置删键** | ASSET_WHITELIST 16 资产配置键（类 D：ASSET_WHITELIST 收缩） | ASSET_WHITELIST 16→9（逐字对齐 manifest 9 资产）；头注改「名单权威=manifest」 | node --check 过；动态验证 length=9；asset-io-report/asset-io-transcript/preflight 三消费面动态遍历，无硬编码 16 断言 |
| 17 | `scripts/regression-all.mjs` | **D 猎手名单收缩（断言自身）** | A1_REGISTERED_RESIDUALS 登记残留面 17 文件——D-3 处置后应收缩 | 登记残留面收缩为类 C 两项（asset-manifest-v2.md、C-R3-review-checklist.md）；S15 断言自身持有 DROPPED_ASSETS 常量（猎手名单）自命中改显式豁免（输出具名「猎手名单≠资产引用」）；头注去 drop 名单重抄（指向 change.record）。**该文件在 17 文件清单内的处置=名单收缩，非类 A/B** | 回归 22 PASS 含 S15-A1 PASS（§二） |

类 C 豁免口径复核：两文件的 drop 资产名出现均为历史证据（schema 冻结基线/Owner 决断 fixture），与派单「历史证据面禁改」一致，未动一字。

config.example.json 核对：enhancedAssets 现存 6 键（frontend-design/planning/review/security/sdlc/skill-sentinel），7 个 drop 键均不在场（AS-1 已清理），无新增残留键——零改动。

## 二、S15-A1 复跑（清理后）——缩短且 PASS

复跑命令：`node scripts/regression-all.mjs`（S15-A1 内嵌）

```
PASS S15-A1 drop 资产引用 0 命中（治理活面）
  扫描 164 文件 0 命中；类 C 豁免残留面 3 文件（D-3 处置后仅剩历史/schema 豁免件 + S15 猎手名单自身，不阻断）:
  contracts/asset-manifest-v2.md (be-architect,be-resilience,be-provider,colorize,frontend-visual-validation,agent-vision-toolkit,agent-research);
  contracts/C-R3-review-checklist.md (colorize);
  scripts/regression-all.mjs (S15 断言持有 drop 清单常量——猎手名单≠资产引用)
结果: 22 PASS / 0 FAIL
```

登记残留面 17 文件 → 3 项（2 类 C 豁免件 + S15 断言猎手名单自身，均不可清——前者篡改历史，后者是断言常量本体）。缩短且 PASS 达成。

## 三、类 A 无活引用证明（删除前核实命令+输出）

核实命令（工作区根执行）：

```bash
# 1) 全仓活面引用扫描（排除 node_modules/历史证据面 docs/test-reports/plans/handoffs/artifacts/
#    recovery-20260919/prototypes/CHANGELOG/contracts/discrepancies 等）
grep -rn "color-mix\|color-palette\.mjs\|design-enhancer\|di-container\|resilience-check" \
  --include="*.mjs" --include="*.js" --include="*.json" --include="*.md" \
  --include="*.yaml" --include="*.yml" \
  scripts/ webview/ commands/ governance-skills/ templates/ reference/ \
  README.md SKILL.md ONBOARDING.md config.example.json package.json contracts/ vendor/
```

删除前输出：命中仅为（a）5 脚本自身正文（自我引用，随删除消失）；（b）`scripts/regression-all.mjs:279` A1_REGISTERED_RESIDUALS 登记名单字符串（猎手名单，D-3 收缩后移除）；（c）`webview/journey/journey.css:50` CSS 函数 `color-mix(in srgb,…)`——同名 CSS 原生函数，非脚本引用；（d）contracts/discrepancies、docs/、test-reports/ 历史证据面（红线保留，不计活引用）。**活代码/配置引用 = 0**。

```bash
# 2) 语法完整性（删除前后全量）
for f in scripts/*.mjs scripts/lib/*.mjs scripts/lib/adapters/*.mjs; do node --check "$f" || echo "FAIL $f"; done
# 输出：无 FAIL 行（83 个 .mjs 编译器级全过；preflight P1 终态 88 个全过）
```

补充：package.json dependencies 中 culori/chroma-js/poline/tsyringe/inversify/cockatiel/polly-js 依赖（原为 5 孤儿脚本间接消费）不在本单白名单内，未动（见偏差 R-2）。

## 四、回归三件（收口终态）

| 件 | 结果 | 证据 |
|---|---|---|
| regression-all | **22 PASS / 0 FAIL**（22 项=S1-S14 + S15 六断言 + S16 两断言；S16 已并入） | test-reports/autopilot-work/D-3-RESIDUAL/regression-final.log（exit 0） |
| preflight | **8 PASS / 0 FAIL / 0 SKIP**（P1 语法门 88 个 .mjs 全过；P4 CLUSTERS↔磁盘 9/9） | test-reports/autopilot-work/D-3-RESIDUAL/preflight-final.log（exit 0） |
| validate-structure | **0 警告**（vendor 9/9 在场；可移植性 0 泄露） | test-reports/autopilot-work/D-3-RESIDUAL/validate-final.log（exit 0） |

联动门：
- **S12 双向漂移门**：task-agent-matrix.md 改后复跑 kickoff-drift-check → **PASS 19 资产双向一致**（test-reports/autopilot-work/D-3-RESIDUAL/s12-drift-check.log）；regression 内嵌 S12 段同步 PASS。
- token-audit --gate（S10 量尺）：**PASS**，全部 12 文件 token 回退 <10%（删行只松不紧）。
- S15-A2/A3/A4/A5/A6、S16-1/S16-2 全 PASS，manifest 9 行 hash c30fee6b4d1a… 三方一致未变。

## 五、偏差登记（4 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| R-1 | regression-all.mjs 不在派单「禁止」清单但在白名单边界——本单白名单未列 regression-all.mjs，但 17 文件清单（S15-A1 A1_REGISTERED_RESIDUALS）含 scripts/regression-all.mjs（D-3 偏差原文「regression-all 猎手名单」），名单收缩是处置项本身；改动仅限 A1 豁免名单/头注两处，S15/S16 断言逻辑零变化 | 登记待 L2 |
| R-2 | package.json 中 5 孤儿脚本的依赖项（culori/chroma-js/poline/tsyringe/inversify/cockatiel/polly-js）仍在 dependencies——脚本删除后成为名义依赖；白名单未含 package.json，未动用写权限，移交 | 移交 L2/Owner |
| R-3 | 类 B 模板/reference 中 drop 资产语义位改写为「契约产物先行冻结」（对齐 matrix.mjs preconditions 已定文案）——属语义等价最小改写，非逐字删除（删除会留下空引用）；具体见 §一逐文件 diff 摘要 | 登记待 L2 |
| R-4 | S15-A1 扫描计数 169→164 文件：5 孤儿脚本删除后扫描面自然缩小（每脚本含 colorize/be-resilience/be-provider 自我引用各计入），非排除面变化 | 备查 |

## 六、不自称 DONE

- 本单为 D-3 残留面清理收口，17 文件分类处置齐（A×5 / B×6+1 注释面 / C×2 不改 / D×3，见 §一）；
- 零触碰确认：governance-skills/、vendor/、SKILL.md、commands/、webview/、scripts/lib/runtime.mjs、scripts/lib/governance.mjs、scripts/manifest-build.mjs、contracts/asset-manifest-v2.md、contracts/C-R3-review-checklist.md、plans/（PB-WRITEBACK 写面 asset-migration-playbook.md 未触碰）、regression-all.mjs 的 regression/audit 断言段（HARDEN-1 产线）——本单零改动；
- 禁 git 遵守（5 孤儿脚本删除用文件系统，git 收口归编排者）；
- 偏差 R-1~R-4 待 L2/Owner 复核；drop 单 Owner 签收仍以 cr-20260925T102900Z-as1-drop7.json 为准。

## 七、产物索引

- 本结果：test-reports/autopilot-work/D-3-RESIDUAL/RESULTS.md
- 回归证据：D-3-RESIDUAL/{regression-final.log, preflight-final.log, validate-final.log, s12-drift-check.log, token-gate.log}
