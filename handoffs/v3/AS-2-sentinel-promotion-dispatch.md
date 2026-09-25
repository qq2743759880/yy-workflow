# AS-2-sentinel-promotion 派单 — sentinel 晋升执行 + FINAL-E2E 主链验收（签收后第一单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `contracts/asset-migration.md`（状态机）、`contracts/discrepancies/cr-20260925T150000Z-as2sent-promotion.json`（**已 SIGNED**——post_sign_actions 清单就是你的任务清单）、`test-reports/autopilot-work/FINAL-E2E/ACCEPTANCE-ENTRY.md`（主链验收入口）、`test-reports/autopilot-work/AS-2-sentinel/RESULTS.md`（shadow 证据）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 8 小步每步 ≤10 分钟落盘；**所有探针输出存文件**（FINAL-E2E 目录）；migration-record 边跑边写。

## Part A：sentinel 晋升（cr-20260925T150000Z post_sign_actions，receipt 已 SIGNED）

当前状态=SHADOW（第十二审计 F-020 归一后）。执行：
1. **SHADOW→MIGRATING**：receipt 已签发（满足契约前置）——migration-record 状态转移 + transitions 补记（合法 transition，引用本 change record id）。
2. **adapter 写入**：`scripts/lib/adapters/skill-scanner.mjs`（≤150 行）——先 `skill-scanner scan --help` 摸清 CLI 与 JSON 输出形态（2.1.0 已装，entry `skill_scanner.cli.cli:main`），spawn scan → 解析 findings/is_safe → 资产消费证据锚点；良性/恶意双夹具语义（is_safe=false→pass=false；良性 0 威胁→pass=true，benign_false_positive 语义保留）。**参照 security-semgrep.mjs 的能力发现/守门形态**（skill-scanner 是多语言/多分析器引擎，语言守门不适用，但目录能力发现记录保留：record analyzers_used）。
3. **index.mjs 注册**：`ADAPTERS.set('skill-sentinel', skillScanner)`。
4. **manifest-sources/skill-sentinel.yaml** verification 更新（provider identity 三件套：official_source=cisco-ai-defense/skill-scanner / install=pip cisco-ai-skill-scanner / runtime_test=skill-scanner --version 期望 2.1.0）。
5. **manifest-build 重跑** → 新 hash 记录。
6. **PHASE2**：`scripts/regression-all.mjs` 的 skill-sentinel 行 dedicatedAdapter:true（security 行已改，同款）。
7. **Gate-2 绑定**：`node scripts/eligible.mjs --asset skill-sentinel`（true）+ dispatch 日志新 hash == build hash。
8. **MIGRATING→PRIMARY**：回归三件（regression 14/preflight 8/validate 0）全绿 → migration-record 状态转移 + 五元组 runtime_binding 回填（新 hash）→ PRIMARY。
9. **change record 补记**：cr-20260925T150000Z 追加 execution log（post_sign_actions 逐项完成记录）。

## Part B：FINAL-E2E 主链验收（ACCEPTANCE-ENTRY.md 全文执行）

临时 workspace 解包漏洞夹具 + 良性 .js → **真实 buildPlan/orchestrator 主链**：`node scripts/orchestrator.mjs --task "backend login module with security review" --backend prompt --workspace <tmpws>` → 逐断言机验（ACCEPTANCE-ENTRY 断言链）：security 子任务 auto 路由专用 adapter / 资格门 / Gate-2 hash / semgrep 真扫 findings / UNCOVERED_LANGUAGES 语义 / receipt 留痕。全输出落 `test-reports/autopilot-work/FINAL-E2E/`。

## 白名单
scripts/lib/adapters/skill-scanner.mjs（新建）、scripts/lib/adapters/index.mjs（仅 skill-sentinel 注册行）、scripts/regression-all.mjs（仅 skill-sentinel PHASE2 行）、contracts/manifest-sources/skill-sentinel.yaml、contracts/asset-manifest-v2.json（构建器再生）、contracts/discrepancies/cr-20260925T150000Z（execution log 追加）、test-reports/autopilot-work/AS-2-sentinel/migration-record.json（状态转移）、test-reports/autopilot-work/FINAL-E2E/、node_modules/pip。

## 禁止
改 contracts/asset-migration.md、其他 5 张已 SIGNED 单、manifest-sources 其他 15 份、runtime.mjs、eligible.mjs、matrix.mjs、security-semgrep.mjs、portman.mjs、SKILL.md、commands/、webview/、plans/、governance-skills/、vendor/ 其他文件；禁 git。

## 验收要点（编排者 L2 将复核）
sentinel PRIMARY + 五元组 runtime_binding 回填 + FINAL-E2E 逐断言 PASS + 回归三件全绿。任何断言 FAIL → 停止、登记、不粉饰。