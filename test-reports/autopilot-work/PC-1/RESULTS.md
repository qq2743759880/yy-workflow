# PC-1 RESULTS — Prompt Compiler v1（批 2 第一波，2026-09-26）

执行 agent：autopilot L1（PC-1 派单，handoffs/v3/PC-1-dispatch.md）。**状态：DELIVERED（待编排者 L2 复核，不自称 DONE）。**

## 交付物（白名单内）

| 文件 | 变更 |
|---|---|
| `scripts/lib/prompt-composer.mjs` | 新建。纯函数 composer：composeBrief / loadCapabilityRows / composePlanAssets / truncateSection + 常量 MAX_SECTION_BYTES / SECTION_ORDER / DEFAULT_MANIFEST_V2_PATH。零 LLM、零网络、零时间戳。 |
| `scripts/orchestrator.mjs` | 最小 diff 两处：①import 行 +5 行注释；②brief 组装处（finalReceiptAssets 之后）接 loadCapabilityRows + composePlanAssets → execOpts.assets。 |
| `test-reports/autopilot-work/PC-1/` | 本目录全部证据（探针脚本 + 输出 + 回归三件 + audit-index selftest）。 |

禁改清单（contracts/、governance-skills/、webview/、SKILL.md、commands/、plans/、governance.mjs、runtime.mjs、matrix.mjs、eligible.mjs、vendor/）零触碰；零 git 操作。

## 1. 六段样例（be-validator capability）

全量见 `probe-structure-sample.md`（composer 模式产物 9999B）。结构：

- 前缀 = vendor/be-validator/be-validator.md 正文（字节级不动，锚点 "Backend Validator Agent" + Execution kernel 段原位）
- `# Role`：`- asset: be-validator` / `- role: You design and implement Zod schemas…` / `- capability: Zod schemas, OpenAPI generation…`
- `# Mission`：task 一句话 + `why-this-asset（manifest.when_to_use 摘要）` 两条
- `# Context`：cluster / asset-root / contract / upstream（defaultProjectContext 缺省行，仓库相对路径）
- `# Output Contract`：artifact-dir / contract-file / exec(requireExec) / consumption-evidence（defaultConstraints 缺省行）
- `# Constraints`：`when-not-to-use（manifest）` 两条逐字 + `全局红线` 三条（禁造接口/路径可移植/诚实降级）
- `# Verification`：`manifest-verification:`（Spectral 三件套全文）+ `verify_command（TK-1 executor_acceptance 口径）` JSON `{"ac","verify_command","expected_exit"}`

机验（probe-results.txt T1a-T1f）：六段齐 / when_not_to_use 逐字进 Constraints / verification 进 Verification / verify_command TK-1 JSON 形态逐字命中 / 红线三项 / Role capability 命名，全 PASS。

## 2. 降级兼容

- 无 manifest 行（capability:null）→ mode=legacy，正文原样透传，**字节级相等**（T2a/T2d，probe-legacy-bytes.txt）；空输入零崩溃（T2b）。
- contracts/asset-manifest-v2.json 不可读 → loadCapabilityRows fail-soft `{ok:false,error}`，orchestrator 接线处整体回落 finalReceiptAssets（T2c）。
- 行缺失资产 → composePlanAssets 原样返回同一 Map（T6d，零行为面）。

## 3. 确定性 hash

同输入两次构建 sha256 一致 + 输入键序重排不变（T3a/T3b）：`composer.sha256=e35cd9cca5f21f01…`（全文见 probe-determinism.txt）。组合零时间戳/零绝对路径/零随机源。

## 4. S8 兼容探针

- 单元层（prompt.mjs:110-122 同款提取逻辑逐字同构）：锚点保持（"Backend Validator Agent"）+ 内核词保持（hasKernelSection=true, tokens=[portman, scripts/lib/adapters/portman.mjs.]）（T4a/T4b）；正向 锚点 AND 内核词→consumed（T4c）；负向 仅锚点→不 consumed（T4d）。
- **E2E 层（真实 orchestrator --backend prompt --exec 链，含 composer 接线）**：正向 exec=5、false(正)=0（T4e），be-validator brief.md 实测含 # Role/# Verification（T4f，节选 probe-s8-e2e-brief-excerpt.md）；负向 仅锚点回写 → false(负)=2（T4g，门禁未退化）。
- 结构裁定 D-PC1-1：六段置于 vendor 正文**之后**（正文前缀原样）——若 '# Role' 成为首标题，锚点降熵且 S8 负向断言必挂；探针实证现形态兼容。

## 5. 截断护栏

6KB 段 → 4096B UTF-8 安全前缀 + `[truncated] 本段（<段名>）超 4KB 注入上限（原始 NB）…全文见 contracts/asset-manifest-v2.json 对应字段`（T5a/T5b）；CJK 多字节边界无残字符（T5c/T5d）；≤4KB 原样（T5e）；GW-1 治理正文 5KB 护栏独立不混用（T5f）。vendor 正文不截断（D-PC1-2，截断会切走 Execution kernel 段破坏 S8）。

## 6. 回归三件 + 门禁

| 门 | 结果 | 证据 |
|---|---|---|
| validate-structure | exit 0（0 警告） | final-validate.txt |
| preflight | 8 PASS / 0 FAIL / 0 SKIP | final-preflight.txt |
| regression-all | **24 PASS / 0 FAIL**（含 S8 资产消费证据、S14 preflight invariants、S14b） | final-regression.txt |
| audit-index selftest | 68 PASS / 0 FAIL（未 stale） | final-audit-index-selftest.txt |

## 7. manifest 零归因

contracts/asset-manifest-v2.json sha256 前缀 **c30fee6b**（9 资产行）任务前后一致（本单开工前与回归后各实测一次）；本单零写 contracts/。preflight P5（唯一写方=manifest-build.mjs）+ P5b（legacy manifest.mjs 禁写 contracts/）双断言 PASS。

## 8. 偏差登记（D-PC1 系列，供 L2 复核裁定）

- **D-PC1-1（结构裁定）**：六段编译块置于 vendor 正文之后（正文=前缀，字节级不动）。派单未规定六段与正文的相对位置；实测 S8 负向探针（仅锚点→false）强制此形态，否则锚点降熵为 'role' 且负向断言挂。结果与派单意图（S8 机验照常命中）一致，属实现位置澄清而非语义变更。
- **D-PC1-2（截断范围）**：4KB 截断只作用于六个编译段，vendor 正文不截断。派单"单段 4KB"按"编译段"口径落地；GW-1 的 5KB 截断语义（UTF-8 安全 + [truncated] 标注）完整复用，但治理正文仍走 governance.mjs 5KB 上限（两护栏独立）。
- **D-PC1-3（治理叠加形态）**：governanceSection 插槽已预留并探针验证（T6a/T6b/T6c），但本期 orchestrator **不传**该参数——GW-1 的 governPlanAssets 尾部追加保持现状（stage_7/before_final_receipt 两发射点不动），治理节与六段共存（探针 T6c：implementation 正文+TDD 节（前缀）→ 六段（后缀））。GV-2 迁移时只需在 orchestrator 接线处传入预渲染节，composer 零改动。
- **D-PC1-4（kill-switch）**：新增 env `YY_PROMPT_COMPOSER=off` 全量 legacy 逃生舱（T6e）。派单未要求；为降级探针/应急回退加的最小开关，默认未设即 composer 生效。
- **D-PC1-5（缺省行措辞）**：Context/Output Contract 无显式输入时渲染 "(未登记——如实留空，不虚构)" / "(无显式产出要求…)" 类诚实缺省行（不虚构）；红线条目为派单三约束的逐字展开措辞，L2 若须逐字冻结可再校正。

## 复核命令

```
node test-reports/autopilot-work/PC-1/probe-pc1.mjs      # 33 项探针
node scripts/validate-structure.mjs && node scripts/preflight.mjs && node scripts/regression-all.mjs
node plans/audit-index-selftest.mjs
```
