# FINAL-E2E 验收入口（批 1 终验·真实 production 主链）

> 状态：**待 Owner receipt 签收后执行**（第十三审计 F-025 采纳：签收前不可声明"全部验证完成"——本文档即签收后的第一项动作）。
> 与 REMEDIATION-1 f011-e2e-probe 的区别：probe 是 planner-shaped dispatch（手工构造子任务）；本验收走 **真实 buildPlan() → orchestrator → resolver → capabilities → adapter → receipt 全链**。

## 前置（签收后立即可用）

五张 receipt SIGNED（asset-migration / manifest schema / AS-2-first / AS-2-security r2 / AS-2-sentinel）。

## 执行步骤

1. **临时 workspace 准备**：`mkdtemp` 目录，放入含已知漏洞的 .py（从 `test-reports/autopilot-work/AS-2-security/fixtures/fixture-vulnerable_app-evidence.tar.gz` 解包）+ 一个良性的 .js 文件（验证 UNCOVERED_LANGUAGES 语义）。
2. **真实 planner 主链**：`node scripts/orchestrator.mjs --task "backend login module with security review" --workspace <tmpws>（默认 auto 后端——原稿误写 --backend prompt，与 A1b auto 路由断言冲突，E-3 已修：prompt 后端无条件 PROMPT_ADAPTER 不经专用 adapter）`（T2 簇自然语言 contract 路径——planner.mjs:46 `contract: cluster.contract` 的真实形态）。
3. **断言链（逐条机验）**：
   - security 子任务被创建且 auto 路由到 security-semgrep 专用 adapter（非 prompt 回落）；
   - 资格门过（eligible=true）+ `getRequiredCapabilities('security')=[write_files,run_cmd]` 与 executor capabilities 匹配；
   - Gate-2：dispatch 日志 manifest_sha256 == `sha256(contracts/asset-manifest-v2.json)` 现值；
   - semgrep 真实执行：.py 漏洞 findings 记账 + UNCOVERED_LANGUAGES 含 js → pass=false（fail-closed 语义：混合覆盖不认证）；
   - receipt/state 转移逐步留痕（receipt 存在≠transition 完成，逐条 sourceEvidence）。
4. **sentinel 晋升执行**（receipt SIGNED 后）：SHADOW→MIGRATING→PRIMARY 逐步执行 post_sign_actions（cr-20260925T150000Z）——adapter 写入/注册/manifest 重跑/Gate-2 新 hash/回归三件。
5. **证据落盘**：`test-reports/autopilot-work/FINAL-E2E/`（orchestrator 全输出、逐断言 PASS 行、receipt 链）。

## PASS 判据

全链无静默降级（每个非 done 状态具名原因）；security 主链 semgrep 真实执行≥1 次；所有 receipt/transition 留痕可回查；回归 14 段 + preflight 8 项 + validate 0 全绿。

## 失败处置

任何断言 FAIL → 停止晋升/收口，登记 D-偏差转修复——照 playbook Failure Rules。
