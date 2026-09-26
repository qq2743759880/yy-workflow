# KERNEL-1 RESULTS — External Kernel Reproducibility（Batch 3 Wave 1）

- revision: `864860669cb4fcf996e12a4d97f14e2b2d906918`（KERNEL-1 基线；写面仅本单白名单）
- 派单: `handoffs/v3/KERNEL-1-dispatch.md`；fact base: `plans/T0-ground-truth-20260926.md` §2 ACCEPT-4
- 状态: **完成待 L2 核验**（不自称 DONE）

## 一、方案选型与理由

**选定：①package.json 正式声明 spectral（npm 面） + ②新增 `scripts/bootstrap-kernels.mjs` 编排三内核（覆盖 pip 面）**；
**否决 ③vendor cache**。

理由（逐候选）：
- **①（采纳，仅对 npm 面）**：Spectral 走 npm，可被 package.json `dependencies` + package-lock **精确锁到传递树**。
  这是唯一能让 `npm ci` 在干净环境**字节级可复现**的通道。R-2 D-1 的根因正是"无 lock 保护的 extraneous 包"——
  正式声明即结构性消除该根因（`npm prune`/`npm ci` 不再把它当垃圾）。版本用**精确 `6.16.3`**（非 `^`），防主版本静默漂移。
- **②（采纳，覆盖 pip 面 + 统一入口）**：semgrep / skill-scanner 走 pip，**无法进 package.json**（诚实边界）。
  由 `bootstrap-kernels.mjs` 用**精确版本**声明并安装核验；同时把三内核的可复现恢复收敛为**一条命令**，
  fail-closed（任一缺失 → 具名 + exit≠0，禁静默跳过）。跨平台：Windows .cmd shim 经 ComSpec /d /c（与 `adapters/util.mjs` 同语义）。
- **③（否决）**：vendor cache 把 npm 包体入库，带来 ①许可证/体积污染（spectral 传递树 244 包） ②与 `node_modules` 被 .gitignore 的既有纪律冲突
  ③需自建解包/指纹机制——**多于收益**。npm 原生 lock + pip 声明已覆盖两通道，无需自造缓存层。

**许可证**：spectral Apache-2.0（npm）；semgrep LGPL-2.1-or-later、cisco-ai-skill-scanner Apache-2.0（pip，独立进程 spawn，不并入分发物）。
**离线**：npm 面由 lock 的 integrity 保证；pip 面须可达 PyPI（与既有 status quo 一致，本单不引入新离线要求）。

## 二、三内核声明落点（诚实分列，不伪装统一）

| 内核 | 期望版本 | 通道 | 落点 | 复现命令 |
|---|---|---|---|---|
| spectral | 6.16.3 | npm | `package.json` `dependencies`（精确 `6.16.3`）+ `package-lock.json`（12 条 @stoplight 条目） | `npm ci` |
| semgrep | 1.175.0 | pip | `scripts/bootstrap-kernels.mjs` 声明 + `plans/asset-migration-playbook.md` Step 2.2 表（**无 lock 可锁，不得伪装已锁**） | `python -m pip install semgrep==1.175.0` |
| cisco-ai-skill-scanner | 2.1.0 | pip | 同上（官方包名，PyPI `skill-scanner` 0.3.3 为同名撞车假目标） | `python -m pip install cisco-ai-skill-scanner==2.1.0` |

证据：`08-declaration-diff.txt`（package.json diff + lock 行）、`baseline-sha256.txt`（改动前 sha256）。

## 三、干净副本重建证据

干净副本 = **临时目录**（`os.tmpdir`），起点 `node_modules` ABSENT（复制时排除），名为 `/tmp/kernel1-clean-*`。

- `01-clean-copy-rebuild.txt`：`npm ci` 后三 `--version` = **6.16.3 / 1.175.0 / 2.1.0**；`bootstrap-kernels --check` = `KERNEL_BOOTSTRAP_OK` (exit 0)。
- `11-s15a2-bootstrap-only.txt`：**更强路径** —— 起点 node_modules ABSENT，**只跑 `bootstrap-kernels.mjs`**（不经 npm ci 前置）也从零恢复；随后
  S15-A2 等价探针（`s15a2-probe.mjs`，复刻 regression S15-A2 夹具/断言）**PASS**：
  `be-validator/spectral: 真扫 6 findings pass=false | security/semgrep: 真扫 1 findings pass=false | skill-sentinel/skill-scanner: 真扫 is_safe=true threats=0`。
- `04-regression-clean-copy.log`：干净副本全量回归 **24 PASS / 0 FAIL**，S15-A2 真扫三行同值。

## 四、负向探针（不跑 bootstrap → 明确报缺，非静默 pass）

- `02-negative-probe.txt` NEG-1：干净副本（node_modules ABSENT，未跑 bootstrap）`bootstrap-kernels --check` →
  `[MISS] spectral … ⇐ spectral 不在 PATH 且 <repo>/node_modules/.bin/spectral 缺席` + `KERNEL_BOOTSTRAP_FAIL` + **exit=1**。
- `02-negative-probe.txt` NEG-2：**adapter 层真实消费**（无 spectral）→ `be-validator ok=false error=SPECTRAL_NOT_AVAILABLE (legacy portman path blocked…)`
  ——**fail-closed 具名，未静默跳过成 pass**（Gate-1 语义保持）。
- 反例证伪：若"node_modules 在场即可"成立，NEG-1 应 pass；实测 MISS → node_modules 不入库，声明才是唯一恢复依据。

## 五、回归三件 + S15-A2

- `07-regression-trio-and-s15a2.txt`：regression **24 PASS / 0 FAIL**（仓库内 + 干净副本均）；preflight **8 PASS / 0 FAIL**；
  validate-structure **0 警告**；audit-index selftest（S14b 内嵌）**68 PASS / 0 FAIL**。
- S15-A2 真扫（仓库内与干净副本各复跑）：**三引擎真实消费 PASS**（值同上）。
- 日志：`03-regression-repo.log`、`05-preflight.log`、`06-validate.log`。

## 六、偏差

见 `09-deviations.md`：D-K1-1（sidecar verification 仍写 `--no-save`，**contracts/ 在 forbidden 面 → 登记不改**）、
D-K1-2（pip 无 lock 可锁，诚实边界）、D-K1-3（@scarf/scarf postinstall 被 npm 11 allow-scripts 拦截，不影响内核可用性）、
D-K1-4（本单文件被并行单 SECMAN-1 的提交一并扫入——KERNEL-1 自身禁 git，commit 归属须按写面分账）。

## 七、写面核验

本单实际写入：`package.json`、`package-lock.json`、`scripts/bootstrap-kernels.mjs`（新建）、
`plans/asset-migration-playbook.md`（仅安装通道段落：Step 2 / Step 2.2 / 模板 install_channel 注释）、
`test-reports/autopilot-work/KERNEL-1/`。**未触** contracts/ 全、scripts/lib/**、manifest-build/regression-all/preflight、
vendor/**、governance-skills/**、webview/**、SKILL.md、commands/、plans/ 其他文件。
（`git status` 中 contracts/ 与 plans/audit-index、plans/batch2-*、test-reports/SECMAN-1 的改动属并行单 SECMAN-1/ACC-1。）
