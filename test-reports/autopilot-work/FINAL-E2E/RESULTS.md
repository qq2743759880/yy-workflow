# FINAL-E2E RESULTS — Runtime Boundary E2E（Host Mode: mechanical acceptance host——验证 runtime 执行链，非 LLM 规划质量）（ACCEPTANCE-ENTRY.md 执行记录）

> 更名登记（HARDEN-1 H2，2026-09-25）：原标题"批 1 终验·真实 production 主链"更名如上——本验收的宿主为机械验收宿主（S8 先例机制隔离口径），测的是 **runtime 执行链机制**（planner→resolver→capabilities→专用 adapter→receipt），非 LLM 规划质量；目录名不动防证据路径断裂，只改文档与账面（ledger 追加更正段）。

> 执行：autopilot L1（AS-2-sentinel-promotion 派单 Part B）｜日期：2026-09-25
> 前置：五张 receipt SIGNED + cr-20260925T150000Z-as2sent-promotion SIGNED（Part A 晋升先于本验收执行完毕，manifest hash 已更新为 d9f0d738…）
> 本文档不自称 DONE——编排者 L2 复核后方可收口。

## 一、断言链机验结果（backend=auto 真实主链，verdict=PASS 9/9）

主链命令（真实 buildPlan → orchestrator → resolver → capabilities → adapter → receipt 全链）：

```
node scripts/orchestrator.mjs --task "backend login module with security review" \
  --workspace <tmpws> --backend auto \
  --exec node -e "<S8 同款机验宿主（regression-all.mjs S8 段逐字同源）>"
```

| # | 断言 | 结果 | 证据要点 |
|---|---|---|---|
| A1 | security 子任务被创建 | PASS | plan-mugrgfrn-5（T2_BACKEND 簇，8 子任务，security 在 phase 1）status=done mode=exec |
| A1b | auto 路由 security-semgrep 专用 adapter（非 prompt 回落） | PASS | adapter=security（security-semgrep.mjs），tool=semgrep mode=exec version=1.175.0 |
| A2 | 资格门过 eligible=true | PASS | resolveAssetEligibility fail-closed 判定 eligible=true（dispatch 内真实运行） |
| A2b | getRequiredCapabilities('security')=[write_files,run_cmd] 与 executor capabilities 匹配 | PASS | workspace 级 executor.json（A-direct+能力自描述）使 EX-1 门真实运行，missing=[] |
| A3 | Gate-2：dispatch 日志 manifest_sha256 == sha256(asset-manifest-v2.json) 现值 | PASS | 5 次派单日志行全部 = d9f0d738eba260a95996c6bc8a76ff69a9f5fb54ab19baa323872701db913df7（Part A 构建器重跑值） |
| A4a | semgrep 真实执行：.py 漏洞 findings 记账 | PASS | 6 findings（hardcoded-api-key / hardcoded-password / sql-injection-concat / weak-hash-md5 / eval-usage / subprocess-shell-true），exit_code=0，pass=false |
| A4b | UNCOVERED_LANGUAGES 含 js → pass=false（fail-closed 混合覆盖不认证） | PASS | uncovered_languages=["js"]（良性 app.js 在场），pass=false |
| A5a | 全链无静默降级（每个非 done 状态具名原因） | PASS | implementation:failed（opencode CLI 未登录，日志 [error] 行具名）；sdlc/review/be-validator:idle（plan failed 级联，plan_status=failed 具名） |
| A5b | receipt/state 转移留痕 | PASS | state.json + artifacts/<id>/security-result.json 可回查（副本 e2e-state-auto.json / e2e-security-result.json） |

逐断言 JSON：`e2e-assert-auto.json`；orchestrator 全输出（stdout+stderr）：`e2e-orchestrator-auto.log`；security-result 副本：`e2e-security-result.json`（findings 6 条 + uncovered js + pass=false 全字段）。

## 二、对照跑：--backend prompt（ACCEPTANCE-ENTRY 第 2 步字面命令形态）→ verdict=FAIL（E-3 偏差证据）

`e2e-assert-prompt.json` / `e2e-orchestrator-prompt.log`：security 子任务 adapter=**prompt**（PROMPT_ADAPTER），无 semgrep、无 security-result.json——A1b/A4a/A4b/A5b FAIL。根因：`resolveAdapter(asset,'prompt')` 无条件返回 PROMPT_ADAPTER（scripts/lib/adapters/index.mjs），prompt 后端语义 = 全资产 prompt 兜底，与断言 1「auto 路由专用 adapter（非 prompt 回落）」直接冲突。**E-3：断言链的规范命令应为默认 auto 后端（或显式 --backend auto）；字面 --backend prompt 不能满足 ACCEPTANCE-ENTRY 自身断言 1**——登记转 L2 修文（改 ACCEPTANCE-ENTRY 命令行或改 resolveAdapter 语义，后者影响面大需 Owner 裁定）。

## 三、上游宿主形态双跑记录（E-4 偏差证据）

T2 requireExec 前置门要求上游 done 且 assetConsumed=true，security（phase 1）才派单：

1. **无宿主**（ACCEPTANCE-ENTRY 字面命令形态）：be-architect brief-only（assetConsumed=false）→ phase-1+ 全部 DEP_PRECONDITION 诚实跳过，security 不派单——门本身工作正常，但断言 4a/4b 无法达成。
2. **真实 LLM 宿主**（a6api 网关 127.0.0.1:15724，model gpt-5.6-sol，2 轮）：真实执行、真实 plan.md 产出（方法论锚点命中），但 D-1 内核词门（锚点 AND ≥1 内核词字面 token）2 轮均未过——模型诚实拒绝声称 `csalvato/system-design-template` 采用（回复明言「未声称调用外部」）。assetConsumed=false → security 不派单。证据：e2e-orchestrator-auto.log 两轮前版（本目录 git 外无留档，原始 plan.md 摘录见 deviation 登记）。
3. **S8 同款机验宿主**（本验收主形态）：regression-all.mjs S8 段先例「机制测试须隔离外部 CLI/模型依赖」——brief 提取锚点+内核词写 plan.md（mechanical，非 LLM）。FINAL-E2E 断言链的对象是 security 子链机制（planner→resolver→capabilities→专用 adapter→receipt），上游 brief 消费按 S8 口径隔离。**此形态下断言链 9/9 PASS**。
4. 诚实性边界声明：机验宿主产出的上游 plan.md 无实质方法论内容（S8 先例同款形态）；assetConsumed=true 属 legacy telemetry-only 弱证据（receipt.mjs §7.8 口径），不构成 behavior_verified——L2 如裁定 FINAL-E2E 须 LLM 真实上游消费，则 D-1 内核词门与真实 LLM 输出的张力（模型不逐字复述 kernel token）须先裁决，本单不擅自改门。
5. **llm 模式声明（HARDEN-1 H2 随附）**：驱动 `--host-mode=llm` 路径存在但依赖真实 LLM 宿主（E-4 张力在案，见上第 2/4 条）——标注 **post-Owner-ruling 可选项**，非本验收形态；Owner 裁定前不作为验收口径。

## 四、临时 workspace 纪律

mkdtemp 创建（os.tmpdir/final-e2e-*），含：fixture tar 解包 vulnerable_app.py（sha256 1177efe8…，AS-2-security canonical）+ 良性 app.js（UNCOVERED_LANGUAGES 语义）+ .tt-state/executor.json（EX-1 能力门真实运行）。验收完成后全部删除，证据副本落本目录。

## 五、产物索引

- 逐断言机验：e2e-assert-auto.json（PASS 9/9）/ e2e-assert-prompt.json（E-3 对照 FAIL）
- orchestrator 全输出：e2e-orchestrator-auto.log / e2e-orchestrator-prompt.log
- state 与产物副本：e2e-state-auto.json / e2e-security-result.json / e2e-report-auto.md
- 驱动（可复现）：final-e2e-assert.mjs（--backend auto|prompt；--host-mode mech|llm）
- Part A 晋升探针：gate2-eligible-skill-sentinel.json / gate2-dispatch-probe.log / probe-skill-scanner-json-shape.json / probe-skill-scanner-adapter-scenarios.txt
- 晋升后回归三件：post-promotion-regression-all.txt（14 PASS/0 FAIL）/ post-promotion-preflight.txt（8 PASS/0 FAIL/0 SKIP）/ post-promotion-validate-structure.txt（0 警告）

## 六、偏差登记（交 L2 复核）

| id | 内容 | 状态 |
|---|---|---|
| E-3 | ACCEPTANCE-ENTRY 第 2 步字面命令 `--backend prompt` 与断言 1「auto 路由专用 adapter」冲突（resolveAdapter prompt 后端无条件 PROMPT_ADAPTER）——对照跑 FAIL 留证；规范命令应为默认 auto | 登记，转 L2 修文/裁定 |
| E-4 | 上游宿主形态：LLM 宿主（真实执行）2 轮被 D-1 内核词门拒绝（模型不逐字复述 kernel token）→ security 无法派单；主验收采用 S8 先例机验宿主（机制隔离口径）达成断言链 9/9——门与真实 LLM 输出的张力交 L2 裁定 | 登记，交 L2 |
| E-5 | implementation 子任务 opencode CLI 未登录真实失败（[error] 具名）→ plan failed 级联，sdlc/review/be-validator idle 未派——A5a 判据按「state error ∪ 日志具名行」机验通过；plan 级 exit code 0 与 plan.status=failed 的不一致系 orchestrator 既有行为（禁改面），留 L2 知悉 | 登记，交 L2 |
