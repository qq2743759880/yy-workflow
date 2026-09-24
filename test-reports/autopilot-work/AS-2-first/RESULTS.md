# AS-2-first RESULTS — be-validator(portman)→be-validator(spectral) 迁移范例实现

> 执行：autopilot L1（AS-2-first-dispatch.md Step 2a-2f 串行）｜日期：2026-09-24
> 契约权威：contracts/asset-migration.md（asset-migration@1.0.0）｜状态：**PRIMARY**（receipt Owner 签收位 PENDING，见偏差 D-3）
> 本文档不自称 DONE——L2 复核后方可关账进入复制阶段。

## 一、逐步结果（Step 2a-2f）

| 步 | 内容 | 结果 | 证据 |
|---|---|---|---|
| 2a | 迁移夹具 + 差异表定稿 | 完成 | `fixtures/bad-openapi.yaml`（8 类确定性违规）、`bad-openapi.json`（旧路径孪生——旧 adapter 文件型契约门只认 .json）、`fixtures/expected-findings.json`（accepted/forbidden 差异表**影子跑前**定稿） |
| 2a | 旧引擎行为实测 | 完成 | 旧路径对缺陷密集文档 **0 检出、pass=true、exit 0**（portman=转换器非 linter）；.yaml 输入被降级 pass:null（`shadow-20260924/old-engine-record*.json`） |
| 2b | 新引擎准备 | 完成 | `npm install --no-save @stoplight/spectral-cli` → `spectral --version` = **6.16.3**（npm 假包教训：装后必核，PASS）；shadow ruleset `rulesets/spectral-oas-shadow.yaml`（extends spectral:oas 官方默认，零自造规则）；package.json/package-lock 零改动 |
| 2c | Shadow Run | **PASS** | `shadow-20260924/shadow-result.json`——零 forbidden_difference（见下表） |
| 2d | Rollback Drill | **PASS** | 三场景全过（见 §三），`shadow-20260924/rollback-drill.json` |
| 2e | Promotion | 完成 | `scripts/lib/adapters/portman.mjs` spectral 驱动（**112 行** ≤150 胶水纪律）；旧 portman 逻辑保留在 EXPLICIT_COMPAT_MODE 显式旗标后；正式 ruleset 固化 `vendor/be-validator/rulesets/spectral-oas.yaml`；`contracts/manifest-sources/be-validator.yaml` verification 字段更新（provider identity 三件套）；manifest 重跑；runtime binding 验证通过 |
| 2f | 五元组落账 | 完成 | `migration-record.json` five_tuple 五字段齐备；状态机 ACTIVE→SHADOW→MIGRATING→PRIMARY 逐条 sourceEvidence |

## 二、影子跑对照表摘要（Step 2c）

| 维度 | 旧引擎 be-validator(portman) | 新引擎 be-validator(spectral) | 分类 |
|---|---|---|---|
| finding 数 | 0 | 9 | accepted（new_findings，v3.5：新工具检出更多≠失败，全部登记交 L2） |
| severity 分布 | 无（pass 布尔） | error 1 / warn 8 | accepted（severity_mapping_changed，映射：有 error 级→pass=false） |
| exit code | adapter ok=true（portman exit 0） | 1（=expected_exit_code，fail-severity=error 默认） | accepted（message/语义面）；invalid_exit_code 硬校验挂 adapter 内防回归 |
| 规则名 | 无规则名 | 8 个 Spectral 官方 rule id（operation-success-response / path-params 为 error 级） | accepted（rule_name_changed） |
| 消失的检出 | — | 无（旧 0 检出） | 无 forbidden |
| missing_detection / crash / invalid_exit_code | — | 均**未命中** | **forbidden 零命中 → PASS** |

expected_rule_ids 全部报出（8/8）；实测 9 findings = 8 规则（operation-operationId 计 2 条）。

## 三、回滚演练三场景（Step 2d，v3.6）

1. **正常路径**：candidate 对 fixture 真实 spectral lint → 9 findings（1 error+8 warn）pass=false——expected-findings 内问题全部报出。PASS
2. **binary missing**（Failure Injection：临时改名 node_modules/.bin/spectral.cmd，本机 PATH 无 spectral）：adapter 检测 SPECTRAL_NOT_AVAILABLE → **无旗标：拒绝（LEGACY blocked，Gate-1）**；**显式 EXPLICIT_COMPAT_MODE（options 或 env）：回滚旧 portman 路径可用**（pass=true，contract 内 compat='EXPLICIT_COMPAT_MODE' + rollback_adapter='be-validator(portman)' receipt 留痕）。注入后已还原现场。PASS
3. **输出格式异常**：假 spectral（垃圾输出+exit 0）注入 PATH → adapter 诚实报错 **SPECTRAL_OUTPUT_INVALID**（invalid_output:true，receipt failure 路径），不静默吞。PASS

晋升后复测（真 adapter，`shadow-20260924/post-promotion-probes.json`）：默认 ruleset 正常路径 ✓ / 旧路径拒绝探针 ✓ / EXPLICIT_COMPAT_MODE 门（env 形态）实测 ✓ / spectral 现场还原 ✓。

## 四、五元组（Step 2f，migration-record.json）

```json
{
  "old_asset": "vendor/be-validator/ + scripts/lib/adapters/portman.mjs（portman 1.35.0）；ADAPTERS 两键 + S3 PHASE2 + baseline#be-validator",
  "new_asset": "@stoplight/spectral-cli 6.16.3（npm --no-save；ruleset 固化 vendor/be-validator/rulesets/spectral-oas.yaml）；Apache-2.0（AS-0 LICENSES.md §5 实测）",
  "shadow_result": "fixture=fixtures/bad-openapi.yaml/.json；Design consumption CONFIRMED；Runtime consumption=shadow-result.json（零 forbidden）；baseline_ref=asset-baseline-before.json#be-validator",
  "promotion_receipt": "apr-20260924T103500Z-as2first-promotion（approvedBy=PENDING，见 D-3）",
  "runtime_binding": "consumed_hash == build_hash == 84e2c7ab4db924e0b9b517b3ad084a7fce2709ca04526584e0d6a181bb08e525（Gate-2）"
}
```

## 五、manifest hash 绑定与回归三件

- **新 manifest hash**：`sha256(asset-manifest-v2.json) = 84e2c7ab4db924e0b9b517b3ad084a7fce2709ca04526584e0d6a181bb08e525`（旧 f770140c…，verification 字段更新后 manifest-build 重跑生成）
- **runtime binding**：`node scripts/eligible.mjs --asset be-validator` → eligible=true；真实 dispatch 日志 `[tt] Gate-2 manifest_sha256=84e2c7ab…`（== build hash，AV-3/EX-1 零改动）
- **回归三件**：
  - 晋升前：regression-all **14 PASS / 0 FAIL**，preflight **7 PASS**，validate **0 警告**
  - 晋升后：regression-all **14 PASS / 0 FAIL**（S3/S7/S8 全绿），preflight **7 PASS**，validate **0 警告**
  - **S8 裁定**：无需裁定——S8 走 `--backend prompt`（PROMPT_ADAPTER），不经 be-validator 专用 adapter，引擎切换零影响（实测 PASS）；S3 marker 亦 PASS（vendor 文档未动）。

## 六、偏差登记（4 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| D-1 | 契约 §五.1 要求夹具 tmpdir 跑完即删；派单明确夹具落 `test-reports/autopilot-work/AS-2-first/fixtures/` 并入白名单——按派单执行（临时 harness/临时接线仍在 tmpdir，已删） | 登记待 L2 |
| D-2 | expected_rule_ids 在官方影子跑前依 Step 2b smoke 修订（openapi-tags 在 spectral:oas 为 recommended:false 不触发→移除；operation-tags 补入）；修订留痕于 expected-findings.json amendments，非静默改门 | 登记待 L2 |
| D-3 | promotion receipt approvedBy=PENDING（Owner 签收不归 L1 代签，决策权纪律）；contracts/discrepancies/ change.record 不在本单白名单——**待 L2/编排者补立 CONTRACT 类 change 单并回填 Owner 签收** | 待 Owner/L2 |
| D-4 | 新引擎使 adapter 文件型契约面 .json → .json/.yaml/.yml（YAML 契约由旧降级 pass:null 变真校验）——能力提升面，登记交复核 | 登记待 L2 |

## 七、复制阶段前置核对（Playbook 输入）

复制其余三个 replace 前必须满足：D-3 receipt 关账 + L2 复核本记录 + Playbook v1 按本实例蒸馏（v3.4/3.5/3.6：evidence_required per state，不另立状态机）。
