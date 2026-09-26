# KERNEL-1 派单 — External Kernel Reproducibility（Batch 3 Wave 1）

- **current revision**: `c599f7b`；working tree clean。
- **Evidence Boundary**: 编排者亲验事实——`grep spectral package.json package-lock.json` **零命中**；`node_modules/@stoplight/spectral-cli` 在场（本机 6.16.3）但 node_modules 被 .gitignore 忽略；playbook:131 唯一安装记录为 `npm install --no-save`（R-2 D-1 事故根因）。交接文档降级 ADVISORY。
- **目标**: 让 **干净环境能据仓库声明稳定恢复** be-validator 的 PRIMARY 执行内核（Spectral），并同时处置另两个已迁移内核（semgrep=pip / skill-scanner=pip）的可复现声明；产出 bootstrap 机制 + 干净副本验证。
- **非目标**: **不动 reflect-metadata/tslib**（无完整证据，REJECT-1）；不改 adapter 调用逻辑；不改 ruleset；不引入新内核。
- **dependency**: 无。
- **allowed write face**: `package.json`、`package-lock.json`、`scripts/bootstrap-kernels.mjs`（新建，若采用脚本方案）、`plans/asset-migration-playbook.md`（**仅安装通道段落**）、`test-reports/autopilot-work/KERNEL-1/`。
- **forbidden write face**: `contracts/`（全）、`scripts/lib/**`、`scripts/manifest-build.mjs`、`scripts/regression-all.mjs`、`scripts/preflight.mjs`、`vendor/**`、`governance-skills/**`、`webview/**`、`SKILL.md`、`commands/`、`plans/` 其他文件。
- **frozen-contract impact**: 不触 `contracts/` → 无冻结面变更；但 manifest 的 verification 字段已声明安装通道（npm/pip）——bootstrap 须与之一致（不一致则以 manifest 声明为准并登记偏差）。
- **production caller**: `scripts/lib/adapters/portman.mjs`（spawn spectral）、`security-semgrep.mjs`（spawn semgrep）、`skill-scanner.mjs`（spawn skill-scanner）。
- **production authority**: `scripts/lib/adapters/*.mjs` 的 CLI 探测（`resolveCommandShim` + `--version`）。
- **positive probe**: 在**干净副本**（临时目录，`npm ci` 或等效 + bootstrap）中：`spectral --version`=6.16.3、`semgrep --version`=1.x、`skill-scanner --version`=2.1.0 三者可执行；并实跑各 adapter 一轮真扫（S15-A2 三 replace 引擎真实消费探针复跑）。
- **negative probe**: 干净副本**不跑 bootstrap** → 明确报缺（不得静默跳过成 pass）；bootstrap 失败 → 具名 exit≠0。
- **counterexample**: 若认为「node_modules 在场即可」——干净副本反例即证伪（node_modules 不入库）。
- **failure semantics**: bootstrap 任一内核失败 → 具名列出缺失项 + exit≠0；禁静默降级为「跳过」。
- **rollback/compat**: package.json 追加依赖不影响既有脚本（回归零破坏）；bootstrap 为新增脚本（无人调用则无影响）。
- **regression**: regression 24 项 + preflight 8 项 + validate 0 + audit-index selftest；**S15-A2 必须复跑真扫**（内核可用性）。
- **evidence path**: `test-reports/autopilot-work/KERNEL-1/`（声明 diff、干净副本重建日志、三内核 --version 输出、S15-A2 复跑、D-xxx）。
- **stop condition**: 干净副本无法复现 或 回归 FAIL → 停止登记，不得宣布完成。

## 方案选型（自决，须给理由）
候选：①正式 `dependencies` 声明 spectral（npm 面）；②`scripts/bootstrap-kernels.mjs` 一键安装三内核（含 pip 两项）；③vendor cache。**你独立选择并论证**（考虑：三内核安装通道不同 npm/pip、跨平台 Windows/Unix、锁版本、离线、许可证、CI）。
诚实边界：pip 内核（semgrep/skill-scanner）无法进 package.json——须由 bootstrap 脚本或文档声明覆盖；这部分**不得伪装成已锁**。

禁 git（干净副本操作在临时目录）；探针输出存文件。