# REMEDIATION-1 派单 — 第十一审计五项闭环（批 1 整改单，晋升放行前置）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` v3.1-v3.6、`contracts/asset-migration.md`、第十一审计五项 findings（本单即其闭环）与 `test-reports/autopilot-work/AS-2-security/RESULTS.md`。完成后交付证据，不自称 DONE。

## 防超时纪律
切 6 小步每步 ≤10 分钟落盘；**所有探针输出必须存文件**（编排者上轮的 inline 探针无独立 artifact，被审计判为不可独立验证——你不得重蹈）。

## 已由编排者完成的整改（你不必重做，需复核）
F-012 sentinel 状态 MIGRATING→SHADOW（+state_correction）；F-016 RESULTS Step9 [x]→DEVIATED；F-018 runtime getRequiredCapabilities 加 security/skill-sentinel→run_cmd + regression PHASE2 security dedicatedAdapter:true（S3 实测仍绿）。

## 任务 F-011【P0】：security scanTarget 生产链 + 真实 caller E2E
现状：planner 给 security 子任务的自然语言 contract 永远不产生 scanTarget → 修复后真实 auto 路径必然 NO_SCAN_TARGET 失败（诚实但功能未通）。
设计（编排者裁定，照此实现）：
1. `scripts/lib/adapters/security-semgrep.mjs`：scanTarget 解析链尾部追加**默认目标=workspace 本身**（`options.scanTarget || subtask.scanTarget || 文件型 contract || options.workspace`）——semgrep 支持目录递归扫描，workspace 就是"被审的项目"；
2. F-005 语言守门**放宽为文件级**：显式非 Python **文件**扩展名 → SCOPE_LANGUAGE_UNSUPPORTED 拒绝；**目录目标放行**（semgrep 对目录内 .py 生效；0 findings 属真实扫描结果如实记录，不再误判假绿——因为真的扫了）；
3. **E2E 探针（真实 caller shape，存文件）**：临时 workspace 放一个含漏洞的 .py → 模拟 planner 形态子任务（自然语言 contract、无 scanTarget）→ `dispatch()` auto → 断言：semgrep 真实执行（日志含规则命中）+ findings 记账 + status 按 ok 语义；反向探针：空 workspace → 真实扫描 0 findings pass=true（如记录 scanned_path 证据）。探针脚本+输出全部落 `test-reports/autopilot-work/REMEDIATION-1/`。

## 任务 F-014【P1】：能力收缩三件套补全（第十一审计：只落了 1/3）
1. `contracts/manifest-sources/security.yaml` when_not_to_use 增列：`非 Python 目标（晋升 ruleset 现为 Python-only；gitleaks/多语言暂缺——能力收缩登记，扩规前 adapter 以 SCOPE_LANGUAGE_UNSUPPORTED 拒绝）`；
2. `node scripts/manifest-build.mjs` 重跑 → 新 hash 记录；
3. AS-2-security `migration-record.json` deviations 追加 **D-8 capability narrowed**（旧引擎声明多语言+gitleaks；新引擎 Python-only——显式收缩，扩规任务列 backlog）。

## 任务 F-015【P1】：AS-2-security promotion receipt 重签（旧单 stale）
1. 新建 `contracts/discrepancies/cr-20260925T130000Z-as2sec-promotion-r2.json`：SUPERSEDES cr-20260925T063000Z；绑定**当前** adapter（重数行数）+ 第十/十一轮全部整改事实（NO_SCAN_TARGET fail-closed / SCOPE_LANGUAGE_UNSUPPORTED 守门 / Step9 DEVIATED / evidence rebind / capability narrowed D-8 / 当前 manifest hash）；deviations 合并 D-1..D-8；Owner 签收位 PENDING；
2. 旧单 cr-20260925T063000Z 加 `supersededBy` 字段指向新单（不删——历史留痕）。

## 任务 F-017【P1】：证据指针重绑定补全 + 结构化 schema
1. 补漏：`AS-2-security/RESULTS.md`（§夹具描述、:61 附近）与 `migration-record.json` ACTIVE→SHADOW sourceEvidence 仍指 vulnerable_app.py——全部改指 tar member；
2. **结构化 schema 替换字符串后缀**：三份 JSON 里我此前的 `[REBOUND ...]` 字符串改为结构化对象 `{archive:"...tar.gz", member:"vulnerable_app.py", sha256:"1177efe8...cf"}`（保留 note 字段）；RESULTS.md 人类段落可用文字但须引用同 schema；
3. README 同步结构化口径。

## 白名单
scripts/lib/adapters/security-semgrep.mjs（守门放宽+默认目标）、scripts/lib/runtime.mjs（如 E2E 需要透传，最小改动）、contracts/manifest-sources/security.yaml、contracts/asset-manifest-v2.json（构建器再生）、contracts/discrepancies/（新单+旧单 supersededBy 标记）、test-reports/autopilot-work/AS-2-security/（rebind 补全+RESULTS 修订）、test-reports/autopilot-work/REMEDIATION-1/。

## 禁止
改 contracts/asset-migration.md、manifest-sources 其他 15 份、governance-skills/、SKILL.md、commands/、webview/、plans/、vendor/、其他 scripts/（runtime.mjs 仅限 scanTarget 透传所需最小改动）；禁 git。

## 回归（完成后）
regression 14 段 + preflight 8 项 + validate 0 全绿；E2E 探针文件+输出为最重要交付物。

完成后报告：F-011 E2E 探针结果（真扫证据）+ F-014 三件套 + F-015 新单要点 + F-017 补全清单 + 回归 + 偏差。不自称 DONE。