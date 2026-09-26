# R-2 RESULTS — package.json 名义依赖清理（七项孤儿依赖，批 2 第一波）

> 执行：autopilot L1（R-2-dispatch 授权，全新上下文独立执行）｜日期：2026-09-26
> 并行约束：与 PC-1 写面不相交——本任务零触碰 scripts/lib/prompt-composer.mjs / scripts/orchestrator.mjs
> 白名单遵守：仅改 package.json、package-lock.json、test-reports/autopilot-work/R-2/；node_modules 变化不入库；禁 git 遵守（仅只读 git diff/status 用于自证范围）
> 本文档不自称 DONE——L2/Owner 复核后方可关账。

## 一、七项依赖逐个 grep 结论（活引用核实）

排除面：node_modules / test-reports / docs / history / .git / .mimosa（hook-state 基线快照，派单排除面同义）。
三重核实：① 活代码目录（scripts、commands、webview、contracts、vendor、templates、governance-skills、artifacts、prototypes）裸名 grep；② 全仓 import/require 语法 grep（`from 'x'` / `require('x')` / `import('x')`）；③ 全仓文件名级 grep。

| 依赖 | 活代码目录 | import/require 语法 | 全仓残留（非活引用） | 结论 |
|---|---|---|---|---|
| culori | 0 命中 | 0 命中 | CHANGELOG.md（历史叙述）、package.json/lock（本体）、handoffs/plans（派单与台账）、reference/dispatch-and-acceptance.md（S8 内核词举例，非 import） | 删除 |
| chroma-js | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans | 删除 |
| poline | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans | 删除 |
| tsyringe | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans、plans/autopilot-ledger-20260921.md（R-2 移交行） | 删除 |
| inversify | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans | 删除 |
| cockatiel | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans、ledger | 删除 |
| polly-js | 0 命中 | 0 命中 | CHANGELOG.md、package.json/lock、handoffs/plans | 删除 |

- AS-1 已删 5 孤儿脚本（di-container.mjs / resilience-check.mjs / color-mix.mjs / color-palette.mjs 等）实测不在磁盘，`ls` 全部 No such file——理论零引用与实测一致。
- 残留命中全部为历史证据面（CHANGELOG 叙述）/登记面（派单、台账）/举例面（reference S8 内核词枚举），零 import/require 语义引用。**七项无一保留，无 D-偏差"核实有误"项。**
- 保留依赖核对：playwright-core（scripts/integration-e2e.mjs:86 真实 req.resolve）、playwright（integration-e2e.mjs:178）、reflect-metadata + tslib（package.json 内仅互为 peer 语义，无脚本 import——超出本单授权范围，原样保留并在 D-2 登记）。

## 二、package.json 与 lock diff 摘要

- package.json：dependencies 9→3（删 chroma-js/cockatiel/culori/poline/polly-js/tsyringe），optionalDependencies 2→1（删 inversify）。scripts 段零改动。
- lock 重生成：`npm install --package-lock-only`（npm 11.16.0 / node 24.18.0，exit 0）。
  - packages 条目 18→4（playwright / playwright-core / reflect-metadata / tslib + root）。
  - REMOVED 14：七项本体 + @inversifyjs/{common,container,core,plugin,prototype-utils,reflect-metadata-utils}（6）+ tsyringe/node_modules/tslib（嵌套）。ADDED 0 / CHANGED 0。
  - lock sha256：0e7f7f34…（前）→ 3d451ee2…（后）；七名在 lock 中 grep 计数全 0。
- node_modules 同步：`npm prune` 移除 254 包（七项目录 + 传递依赖 + 空壳 @inversifyjs scope 目录手动 rmdir）；`npm install` 复核 up to date。七名目录逐一实测 absent。

## 三、回归三件（全绿）

| 件 | 结果 | 证据 |
|---|---|---|
| regression-all | **24 PASS / 0 FAIL**（14 段 + preflight 8 内嵌 + S15/S16 断言；含 audit-index selftest 68/68 未 stale） | regression-final.log |
| preflight | **8 PASS / 0 FAIL / 0 SKIP**（P1 85 .mjs 语法门；P4 CLUSTERS↔磁盘 9/9；P6 drop-pending 0 行） | preflight-final.log |
| validate-structure | **0 警告**（exit 0） | validate-final.log |

manifest hash 零变化：manifest-build 产物 sha256 = 落盘 contracts/asset-manifest-v2.json 重算 = regression S15-A3 三方一致 = **c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1**（9 行，与 AS-1 收口值逐字一致）。eligible 抽查：be-validator 正向解析、colorize ASSET_NOT_FOUND fail-closed（9 行 manifest）。

## 四、过程偏差登记（3 条，交 L2/Owner）

| id | 内容 | 处置 | 状态 |
|---|---|---|---|
| D-1 | **npm prune 波及 extraneous 包**：@stoplight/spectral-cli（be-validator adapter 的 PRIMARY 执行内核）历史上有 agent 以 --no-save 方式装入 node_modules（任何 lock 均无记录），首次 regression 22 PASS/2 FAIL（S15-A2 spectral FAIL + S16-2 shadow 形态 FAIL；REMEDIATION-2 三张 json 被回归自写污染一次）。经 npm prune 日志（E:\npm-cache\_logs\2026-09-26T07_25_10_958Z）实锤 288 顶层名含 @stoplight/spectral-cli + .bin/spectral.cmd 被移除。修复：`npm install --no-save @stoplight/spectral-cli@6.16.3`（实测 6.16.3，与被移除版本一致），package.json/lock sha256 复验零变化，重跑回归 24 PASS。 | 已修复并复测 | 登记待 L2 |
| D-2 | reflect-metadata/tslib 无任何脚本 import，但属 tsyringe 同源残留嫌疑——**超出本单七项授权清单，不扩权删除**，原样保留；是否二次清理移交 Owner 裁定。 | 保留 | 移交裁定 |
| D-3 | regression 运行自会重写 test-reports/autopilot-work/REMEDIATION-2/s16-{1,2,3}-*.json（时间戳 + 探针结果），超出 R-2 白名单但为回归器固有行为、非本任务编辑；终态内容全 PASS 语义（shadow_fail detected=true 等），git 层面呈修改状态。 | 如实登记 | 备查（git 收口归编排者） |

## 五、产物索引（test-reports/autopilot-work/R-2/）

- grep-evidence.txt（七项三重 grep 逐项证据）
- package.json.before / package-lock.json.before（改前快照）；lock-sha256-before/after.txt
- lock-diff-summary.txt（18→4 逐条 REMOVED 清单）
- prune-removed-packages.txt + parse-prune-log.mjs（D-1 根因实锤）
- manifest-build.log（hash c30fee6b 复算输出）
- regression.log（首次 22/2，D-1 现场留痕）；regression-final.log（终态 24 PASS）
- preflight.log（首跑 8 PASS）/ preflight-final.log（终态 8 PASS）；validate.log / validate-final.log（终态 0 警告）

## 六、不自称 DONE

七项删除已按派单完成且回归三件全绿、manifest hash 零归因成立；但 D-1（spectral extraneous 依赖的治理口径：执行内核应否进 manifest/lock）与 D-2（reflect-metadata/tslib 去留）待 L2/Owner 复核。git 收口（package*.json 与 R-2 证据目录 add/commit）归编排者。
