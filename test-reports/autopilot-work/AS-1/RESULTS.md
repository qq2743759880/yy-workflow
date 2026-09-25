# AS-1 RESULTS — drop 7 + S15 迁移不变量段（批 1 第三波，最大联动面单）

> 执行：autopilot L1（AS-1-dispatch 授权，全新上下文独立执行）｜日期：2026-09-25
> 契约权威：contracts/asset-migration.md（DEPRECATED→REMOVED 收口，Playbook §二 #15-18 + §六-A wizard）｜状态：**REMOVED-PENDING-CONFIRMATION**（drop 单 cr-20260925T102900Z-as1-drop7.json Owner 签收位 PENDING）
> 本文档不自称 DONE——L2/Owner 复核后方可关账。

## 一、6 处联动逐处 diff 摘要（+3 处必 vitals 同批联动）

| # | 面 | diff 摘要 | 验证 |
|---|---|---|---|
| 1 | `SKILL.md` 资产指针表 | **实测 0 行可删**：现版 SKILL.md（60 行）无任何 vendor 资产指针行，7 个 drop 资产名 grep 零命中——联动①无可执行对象，零改动（写权限未动用；偏差 D-4） | grep 7 名 0 命中；validate-structure 0 警告 |
| 2 | `scripts/lib/matrix.mjs` CLUSTERS | candidates 19 项→9 项（T1: implementation/be-validator/sdlc；T2: implementation/sdlc/security/review/be-validator；T3: implementation/be-validator/dev-planner；T4: frontend-design/planning/review/security；T5: security/skill-sentinel/be-validator/review）；**phases 同步收缩**（空簇相删除，零空引用）；preconditions 文案去 drop 资产名（be-architect/be-provider/be-resilience/agent-research 上游语义改为"契约产物先行冻结"）；keywords 保留（路由词汇无害，派单明示）；PRIORITY 数组核对不变（五簇 id 不变） | preflight P4 CLUSTERS↔磁盘 9/9；kickoff-drift-check PASS |
| 3 | `scripts/validate-structure.mjs` | SKILL_ENTRIES 10→6（删 agent-research/agent-vision-toolkit/colorize/frontend-visual-validation）+ AGENT_ENTRIES 6→3（删 be-architect/be-provider/be-resilience）＝16→9 断言收缩；注释同步（drop 清单指向 change.record，不重抄名单） | validate-structure 0 警告；S1 PASS |
| 4 | `webview/journey/content.js` | `node scripts/build-guide-content.mjs` 重建：6 阶段 + **9 资产卡片**，drop 资产名 0 命中（构建前 3 处命中清零）。构建器完整性自检硬编码 16→9 同步（偏差 D-2） | 构建器 exit 0 完整性自检通过；grep 0 命中 |
| 5 | `config.example.json` | enhancedAssets 删 `agent-research`/`agent-vision-toolkit` 两键（6 键保留：frontend-design/planning/review/security/sdlc/skill-sentinel） | JSON parse OK；preflight P1 全过 |
| 6 | `scripts/lib/adapters/index.mjs` | **核对即零改动**：8 个注册名（implementation/dev-backend/be-implementer/sdlc/be-validator/portman/security/skill-sentinel）无这 7 个的注册；security/skill-sentinel 的 semgrep/skill-scanner adapter 与 ruleset 原样保留（AS-2-sentinel 目录未触碰） | preflight P3 ADAPTERS 一致性全程 PASS |
| 7 | `vendor/` ×7 + sidecar ×7 | `vendor/{be-architect,be-resilience,be-provider,colorize,frontend-visual-validation,agent-vision-toolkit,agent-research}/` 文件系统删除（禁 git 遵守，git 收口归编排者）；`contracts/manifest-sources/` 同名 7 份 yaml 删除；vendor 现存 = 9 资产 + deep-research（research-gate vendor，非资产，无 sidecar） | 每 drop 后 preflight 8 PASS ×7 |
| + | `scripts/regression-all.mjs`（白名单内） | PHASE2 表 14→8 行（6 个 drop 资产行删除，偏差 D-7）；**S15 占位段实装六断言**（见 §三）；头注释 16→9 | node --check；回归 S3/S15 PASS |
| + | `templates/kickoff-prompt.md`（白名单外，偏差 D-1） | 五簇 candidates+preconditions 段与 CLUSTERS 同步收缩（candidates 逐字对齐 CLUSTERS 顺序） | kickoff-drift-check 双向 PASS 19 项一致 |
| + | `scripts/build-guide-content.mjs`（白名单外，偏差 D-2） | 完整性自检两处硬编码 16→9 + 注释（零逻辑变化；不改则派单联动④重建 exit 1） | 重建 exit 0 |
| + | `contracts/manifest-sources/{implementation,be-validator}.yaml`（偏差 D-5） | when_not_to_use 文案 2 处去 drop 资产上游引用（否则再生的 manifest 9 行内嵌死引用，S15-A1 直接 FAIL）；语义等价改写 | manifest-build exit 0 9 行 |

## 二、7 资产 drop 完成

| 资产 | vendor | sidecar | 簇引用清理 | 每 drop preflight |
|---|---|---|---|---|
| be-architect | 删除 | 删除 | T1/T2 candidates+phases+preconditions | 8 PASS / 0 FAIL |
| be-resilience | 删除 | 删除 | T2/T5 | 8 PASS / 0 FAIL |
| be-provider | 删除 | 删除 | T1/T2/T3 | 8 PASS / 0 FAIL |
| colorize | 删除 | 删除 | T4 | 8 PASS / 0 FAIL |
| frontend-visual-validation | 删除 | 删除 | T4 | 8 PASS / 0 FAIL |
| agent-vision-toolkit | 删除 | 删除 | T4 | 8 PASS / 0 FAIL |
| agent-research | 删除 | 删除 | T3 + PHASE2 行 | 8 PASS / 0 FAIL |

drop 三条件（candidate / runtime invocation 零调用 / quality）与回滚 tombstone 逐资产记录于 change.record `droppedAssets` + `dropReceipt.dropTriple` + `rollbackProof`。

## 三、S15 迁移不变量段（regression-all.mjs 新增，继 S14 后）——六断言全绿

| 断言 | 内容 | 实测结果 |
|---|---|---|
| S15-A1 | drop 资产引用 0 命中（治理活面全扫；历史证据面/一字不改面/登记残留面三类排除面显式列举留痕） | 扫描 169 文件 **0 命中**；登记残留面 17 文件逐文件计数输出（偏差 D-3，不阻断） |
| S15-A2 | replace 资产真实消费探针（be-validator/spectral、security/semgrep、skill-sentinel/skill-scanner 各一次真实扫描，os.tmpdir 夹具跑完即删） | spectral 真扫 **6 findings pass=false**；semgrep 真扫 **1 findings pass=false**；skill-scanner 真扫 **is_safe=true threats=0**（三探针 mode=exec，经 resolveAdapter 注册表真实消费） |
| S15-A3 | manifest 驱动路由断言 | manifest-build **9 行**，打印 hash == 落盘重算 sha256 == 真实 dispatch `Gate-2 manifest_sha256=` 日志 hash，三方一致 **c30fee6b4d1a…**（动态重算，禁硬编码）；eligible.mjs **9 资产全 eligible=true + 7 drop 资产全 eligible=false**（ASSET_NOT_FOUND fail-closed 具名） |
| S15-A4 | legacy loader 不可达 | ①orchestrator 生产 loadAssets 调用恒传 manifest（静态断言）；②loadAssets manifest 路径与 legacy 自动路径输出**零 drop 资产**（vendor 物理删除后旧 loader 无法复活）+ 9 资产 manifest 路径全可达；③三 replace adapter 旧引擎路径 EXPLICIT_COMPAT_MODE 旗标门在场（Gate-1 禁静默并存）。loader 自身旗标门属 v3.2 Phase 2（偏差 D-6） |
| S15-A5 | 真实执行≠能力覆盖（第十二审计模式 1） | 混合语言目录（clean.py + plain.js）semgrep 真扫 **0 findings 仍 pass=false** 且 **UNCOVERED_LANGUAGES=["js"]** 必现——"真的扫了"≠"能力覆盖了目标" |
| S15-A6 | correction≠作废（第十二审计模式 2） | voided transition **留痕保留**（voidReason 在场）+ 回放状态机跳过 voided 终态 **PRIMARY == 记录终态** + voided 实例身份（from→to@at）**零复用不可再入**（证据 AS-2-sentinel/migration-record.json，未触碰该目录其他文件） |

### 注入反例（自测 3）：5 注入全 FAIL 具名 + 现场还原（s15-injection-result.log）

| 注入 | 故障 | 期望捕获 | 结果 |
|---|---|---|---|
| INJ-1 | 治理活面造孤儿引用（scripts/ 临时 .md 含 be-architect） | A1 FAIL 具名 DROP_REF_HIT + 注入文件名 | **PASS**（FAIL 行具名文件+资产名；还原=true） |
| INJ-2 | 三引擎缺席（PATH 剥离 + spectral.cmd 临时改名） | A2 三探针全 FAIL 具名 + A5 FAIL | **PASS**（A2 具名三 FAIL；A5 FAIL；spectral.cmd 复原在位） |
| INJ-3 | 孤儿 sidecar（不在 CLUSTERS 权威清单） | A3 FAIL（manifest-build fail-closed 拒产） | **PASS**（manifest 产物 sha256 未被污染=拒绝半成品不落盘） |
| INJ-4 | drop 资产复活（重建 vendor/be-architect/be-architect.md） | A4 FAIL 具名 leak=be-architect | **PASS**（旧 loader 输出含复活资产即抓；还原=目录删除） |
| INJ-5 | 迁移记录篡改（current_state PRIMARY→TAMPERED） | A6 FAIL 具名（回放终态≠记录终态） | **PASS**（还原后 sha256 与原值一致） |

## 四、回归三件（drop 前基线与 drop 后双绿）

| 件 | drop 前基线 | drop 后终态 |
|---|---|---|
| regression-all | **14 PASS / 0 FAIL**（baseline-regression.log） | **20 PASS / 0 FAIL**（14 段 + S15 六断言；regression-post-drop.log 与收口终态 regression-final.log 双 capture，锁释放后终跑 exit 0） |
| preflight | 8 PASS / 0 FAIL / 0 SKIP | 8 PASS / 0 FAIL / 0 SKIP（每 drop 后 ×7 + 终态 preflight-final.log；P4 CLUSTERS↔磁盘 9/9） |
| validate-structure | 0 警告 | 0 警告（validate-final.log；随包资产 9/9 存在） |
| token-audit --gate（S10 量尺） | PASS | PASS：全部 12 文件 token 回退 <10%（删行只松不紧） |

manifest：16 行（d9f0d738…，AS-2-sentinel 晋升后现值）→ **9 行（c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1）**；9 资产 eligible 全 true（交付断言）。

## 五、偏差登记（8 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| D-1 | `templates/kickoff-prompt.md` 越白名单联动——S12 对 CLUSTERS↔kickoff 双向集合 diff，只改 CLUSTERS 必 FAIL；Playbook §二#17 将 kickoff 清单列为收口项。已同步收缩+加锁 | 登记待 L2 |
| D-2 | `scripts/build-guide-content.mjs` 越白名单——fail-closed 自检硬编码 16，联动④重建不可执行；仅改 16→9 断言零逻辑变化 | 登记待 L2 |
| D-3 | 登记残留面 17 文件（README/reference×3/templates×2/contracts schema 与 C-R3 冻结件/enhancement 脚本×5/prompt.mjs 注释/activation CATALOG_IDS/evolution ASSET_WHITELIST/regression-all 猎手名单）——治理活面 0 命中达标，残留面逐文件计数留痕；清理（含 CATALOG_IDS/ASSET_WHITELIST 16→9）超白名单，移交 | 移交 L2/Owner |
| D-4 | 联动①『SKILL.md 指针表删 7 行』实测 0 行可删——零改动关账，写权限未动用 | 备查 |
| D-5 | 保留 sidecar 2 份最小文案改写（when_not_to_use 死引用）——『9 份保留核对』扩为最小联动，否则 S15-A1 FAIL | 登记待 L2 |
| D-6 | S15-A4『EXPLICIT_COMPAT_MODE 未开启时旧路径不可达』loader 层无可机验旗标门（asset.mjs/manifest.mjs 禁改面）——实装为生产恒 manifest 驱动+双路径零 drop 输出+adapter 旗标门在场；loader 自身门/删除属 v3.2 Phase 2 | 登记移交 |
| D-7 | regression-all.mjs 白名单标注『S15 段』，PHASE2 14→8 收缩同为必须（vendor 删除后 6 行必 S3 FAIL；Playbook §二#17 PHASE2 表在收口清单内） | 登记待 L2 |
| D-8 | 派单括注 T3『剩 be-validator/dev-planner』疑笔误——按『删 7 项+按实存核对』实为 implementation/be-validator/dev-planner（implementation 为保留资产实存），已按实存保留 | 待 L2 确认 |

另登记：drop_allowed 旗标未做中间 manifest 置位（行随删除不存续，意图+放行落 change.record；preflight P6 全程零违例）——口径见 change.record dropReceipt.dropAllowed。

## 六、产物索引

- change.record（合并 tombstone 单）：contracts/discrepancies/cr-20260925T102900Z-as1-drop7.json（CONTRACT 类，Owner PENDING）
- 回归证据：test-reports/autopilot-work/AS-1/{baseline-regression.log, regression-post-drop.log, regression-final.log, preflight-final.log, validate-final.log, token-gate-final.log}
- 注入反例：test-reports/autopilot-work/AS-1/{s15-injection-test.mjs, s15-injection-result.log}
- Playbook 回写：plans/asset-migration-playbook.md §六-A（drop wizard 清单逐项勾选）
- 未动：AS-2-sentinel 目录（仅 S15-A6 只读消费 migration-record.json，INJ-5 临时翻转已 sha256 复验还原）；security/be-validator/skill-sentinel 的 adapter 与 rulesets 保留；commands/、governance-skills/、runtime.mjs、eligible.mjs、manifest-build.mjs 零改动；vendor 保留资产一字未改；禁 git 遵守（vendor 删除用文件系统）

## 七、不自称 DONE

drop 单 Owner 签收位 PENDING（cr-20260925T102900Z-as1-drop7.json ownerApprovalReceipt）；偏差 D-1~D-8 待 L2/Owner 复核；残留面清理（D-3）与 loader Phase 2（D-6）移交后续批。git 收口（vendor 7 目录删除与全部改动的 add/commit）归编排者。
