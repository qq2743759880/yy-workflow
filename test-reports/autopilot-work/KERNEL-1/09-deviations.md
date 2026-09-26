# KERNEL-1 偏差登记（D-K1-xxx）

生成: 2026-09-26T15:55Z  revision: 864860669cb4fcf996e12a4d97f14e2b2d906918

## D-K1-1：sidecar verification 声明仍写 `--no-save`（stale，KERNEL-1 无写面）

- **实测**：`contracts/manifest-sources/be-validator.yaml` 的 `verification` 字段现文：
  `install 通道=npm install @stoplight/spectral-cli --no-save（node_modules 不入库，装后必跑 spectral --version 期望 6.16.3…）`
- **与 KERNEL-1 落点不一致**：本单将 spectral 正式落 `package.json` `dependencies`（精确 6.16.3）+ `package-lock.json`，
  复现命令变为 `npm ci`；sidecar 仍声明 `--no-save`（迁移探测期口径）。
- **为何不改**：`contracts/`（全）在 KERNEL-1 **forbidden write face**；派单明写「不一致则以 manifest 声明为准并登记偏差」。
  → **按派单口径登记偏差，不改 contracts/**。SECMAN-1 已占用 contracts/ 写面，本偏差应转由后续 contracts 写面的单处理
  （从 sidecar 修 verification.install 通道为 `npm ci`（package.json+lock 声明），再 rebuild→hash→consumers）。
- **影响面**：登记类，不阻断。adapter 真实执行不读该字段（`portman.mjs` 只 spawn `spectral`）；manifest JSON 的
  verification 文本随之 stale（同源）。
- **反向陈述（诚实边界）**：本偏差**不得**被读作"KERNEL-1 已完成 sidecar 同步"。sidecar 同步**未做**。

## D-K1-2：pip 两内核无 lock 文件可锁（诚实声明，非缺陷）

- semgrep 1.175.0 / cisco-ai-skill-scanner 2.1.0 走 pip 通道，**无法进 package.json / package-lock.json**。
  本单以 `scripts/bootstrap-kernels.mjs` 内**精确版本声明** + playbook Step 2.2 通道表覆盖。
- **不得伪装成"已锁"**：pip 无 lock 等价物；本声明的保障上限是"声明精确版本 + 装后 --version 核验（版本前缀符合）"，
  不提供传递依赖的字节级锁。这是本单的**能力边界**，已如实写入 playbook 与 bootstrap 脚本头注释。

## D-K1-3：`@scarf/scarf` postinstall 未执行（npm 11 allow-scripts 默认拦截）

- `npm ci` 输出警告：`@scarf/scarf@1.4.0 (postinstall: node ./report.js)` 未被 allowScripts 覆盖，脚本未跑。
- **判定：不影响内核可用性**——scarf 为 spectral 的匿名使用统计依赖，非功能性路径；干净副本 S15-A2 spectral 真扫
  6 findings pass=false 实测通过，证明 lint 功能完整。
- 注：该拦截是 npm 11 的默认安全行为（未显式 approve 的 postinstall 不执行），非本单引入。

## D-K1-4：本单文件被并行单（SECMAN-1）的 git 提交一并扫入（非本单动作）

- **实测**：`git log` 现 HEAD = `9f65249`（`autopilot(SECMAN-1): security sidecar semantic freshness …`），其 `--stat`
  **包含本单的** `package.json`、`package-lock.json`、`plans/asset-migration-playbook.md`、`scripts/bootstrap-kernels.mjs`
  以及 KERNEL-1 的 01/02/07/08/baseline-sha256 证据文件。
- **判定**：该提交由**并行单 SECMAN-1 的 agent** 以其 L2 流程发起（广域 `git add`），**不是本单动作**——
  KERNEL-1 派单明确「禁 git」。
- **影响**：文件内容与工作区一致，**未受损、未丢失**；本单仍留有 5 份未入库证据（`09/10/11/RESULTS/s15a2-probe.mjs`）。
  但**提交归属**（commit message 为 SECMAN-1）与写面来源不符，属跨任务提交污染，须登记供 L2 分账。
- **建议**：L2 核验时按写面（KERNEL-1 白名单）而非 commit message 归属；如需清理，另开 amendment，不在本单处理。



- 未改 `contracts/`、`scripts/lib/**`、`manifest-build.mjs`、`regression-all.mjs`、`preflight.mjs`、`vendor/**`、
  `governance-skills/**`、`webview/**`、`SKILL.md`、`commands/`、`plans/` 其他文件。
- 未动 `reflect-metadata` / `tslib`（REJECT-1）。
- 未改 adapter 调用逻辑 / 未改 ruleset / 未引入新内核。
- `git status` 中 `contracts/asset-manifest-v2.json`、`contracts/manifest-sources/security.yaml`、
  `plans/audit-index-20260925.md`、`plans/batch2-acceptance-reconciliation-20260926.md`、
  `contracts/discrepancies/cr-20260926T153000Z-335b9fd6.json`、`test-reports/autopilot-work/SECMAN-1/`
  的改动**均属并行单（SECMAN-1 / ACC-1）**，非本单写面。
