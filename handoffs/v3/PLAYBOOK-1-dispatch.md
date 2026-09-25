# PLAYBOOK-1 派单 — Asset Migration Playbook v1 蒸馏（批 1 第二波 Step 6）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` 的 v3.3/v3.5/v3.6 修订节与 `contracts/asset-migration.md`（状态机唯一权威）。完成后交付证据，不自称 DONE。

## 防超时纪律
切 5 小步每步 ≤10 分钟落盘：①提纲 ②正文 ③回溯自测 ④修订 ⑤RESULTS。

## 任务：蒸馏 `plans/asset-migration-playbook.md`（唯一白名单产出）

### 输入材料（全部已存在，只读）
- `contracts/asset-migration.md`——状态机唯一权威（ACTIVE→SHADOW→MIGRATING→PRIMARY→DEPRECATED→REMOVED + 非法流转 + 五元组 + 三硬门）
- `test-reports/autopilot-work/AS-2-first/`——**已完成的迁移范例全部实证**（RESULTS.md、migration-record.json、fixtures/、shadow-20260924/ 影子跑 8 件、post-promotion-probes）
- `scripts/preflight.mjs` / `scripts/change-lock.mjs` / `scripts/manifest-build.mjs` / `scripts/eligible.mjs`——门栈 CLI
- `test-reports/asset-eval-20260923/asset-baseline-before.json`——Gate-0 产物样例
- `plans/execution-plan-v3-20260923.md` v3.1-v3.6 各审计裁定

### Playbook 结构（v3.6 定型，三部分缺一不可）
1. **Migration Object**（机读 YAML 头）：old_asset/new_asset/owner/status（映射契约状态机，不另立状态机）/required_evidence 清单
2. **Per-state Evidence Requirements**：进入每个契约状态所需证据逐条列出（如 SHADOW：baseline-before + accepted/forbidden 差异表定稿 + 影子对照记录；PRIMARY：五元组 + promotion receipt + Gate-2 新 hash 绑定）
3. **Operator Guide（How-to）**：照着敲的命令序列——按 AS-2-first 实际用过的命令写实（preflight/change-lock acquire/manifest-build/eligible/spectral lint--ruleset/回归三件），含每步的 PASS 判据与 FAIL 处置

### 必须收录的 Failure Rules（v3.6 裁定）
- 影子跑 FAIL（含 forbidden_difference 命中）→ **NO PROMOTION**（回滚即可，FAIL 也是有效迁移证据）
- 回滚演练 FAIL → **NO DROP**（回滚不了就不许删旧资产）
- Provider identity 三件套缺一 → **NO INSTALL**（npm semgrep 假包教训：package name ≠ capability，必须 official source + install 通道 + runtime_test 如 --version）
- EXPLICIT_COMPAT_MODE：旧路径每次调用必须显式旗标+留痕，禁静默并存

### 关键经验教训（从 AS-2-first 实证蒸馏，逐条注明出处）
- accepted_difference/forbidden_difference 表**先于**影子跑定稿（"新工具发现更多问题"是能力提升不是失败——旧 portman 对缺陷密集文档 0 检出 vs Spectral 9 findings 实证）
- 回滚路径**影子跑前**验证存在（migration-record.json 的 rollback_path_verified_before_shadow 模式）
- 硬编码 hash 随合法晋升腐坏（AV-3 探针 C1/C2 假 FAIL 教训）——期望值动态重算
- 全量门栈只压首个 replace，复制的 replace 走机械化清单（v3.3 摊销规则）
- 写面声明表 + change-lock 先于动工（F-003 并行双写教训）

### 回溯适用性自测（本单的核心自测）
把 Playbook 当作"如果重来一次 be-validator→Spectral"的操作手册逐条对照 `test-reports/autopilot-work/AS-2-first/` 的实际证据：每一步必须能在真实产物中找到对应物；发现 Playbook 写了但实际没做/做了但 Playbook 漏写的，双向修订并登记。

## 白名单
`plans/asset-migration-playbook.md`（新建）、`test-reports/autopilot-work/PLAYBOOK-1/`（自测证据）。

## 禁止
改 contracts/（状态机权威不动）、scripts/、webview/、SKILL.md、commands/、其他 plans/ 文件、test-reports 既有文件；禁 git。

## 验收要点（编排者 L2 将复核）
三部分结构齐；Failure Rules 四条全收；回溯自测双向修订记录；后续三个 replace 的执行者只读此文档+契约即可开工。