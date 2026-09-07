# TT 修复轮验收报告（P0/P1/P2 修复 + P3 可移植性保证）

> 验收方式：只读复现 + 代码审读 + **新鲜部署模拟**（整目录拷贝到 `%TEMP%`，无 AI-Hub、无环境、无作者绝对路径，独立运行全链路）。
> 验收对象：批判性审计（`CRITICAL-TEST-PROMPT.md`，针对提交 `7ab1faa`）发现的 7 个批判点 + 扩展可移植性审计的全部修复。
> 仓库：`<TT_REPO>`（Windows，PowerShell）。
> 验收时间：2026-08-29（GMT+8）。

## 0. 总体结论

**PASS。** 前一轮 `7ab1faa` 的 4 个核心断言中 3 个被证伪：

1. 「16 资产全部可达」实为 **14**（`agent-vision-toolkit` 以 `vision-skills` 注册且不在任何 cluster candidates、`skill-sentinel` 不在任何 candidates → 永不可路由）；
2. 「资产方法论全文进入执行上下文」只载入**顶层 SKILL.md stub**（如 frontend-design 仅 31 行），`reference/*.md`（taste-skill 1202 行）不进内存，brief 内相对引用悬空；
3. prompt 后端是**「指令包生成层」而非执行层**——brief.md 无任何消费端，gate 存在性检测被 brief.md 单文件轻易满足，报告不区分兜底来源（用户误读为真实执行）。

另发现：`--backend cli` 下 sdlc 仍 planned-only 降级（违反 README「cli 模式全 skipped」契约）、3 个核心脚本源文件 U+FFFD 编码损坏（用户可见报错乱码）、validator 可移植性扫描不覆盖 scripts/ 全量、config/文档残留已合并消失的资产名。

**本轮全部修复并经新鲜部署复验（见 §4/§5），无遗留 P0/P1。**

## 1. 分项验收表（逐批判点）

| # | 批判点 | 结果 | 证据 |
|---|---|---|---|
| 1 | prompt 后端是否假执行？ | **修复（诚实性闭环）** | `runtime.mjs` 每子任务标注 `mode`（prompt/cli/planned-only/skipped）；`report.mjs` markdown 含执行摘要 + 警告行「prompt 兜底/planned-only 未真实执行」。T2 auto 实测：5 prompt + 1 planned-only + 2 skipped，`degraded=false`，modes 摘要如实 |
| 2 | 消费链断裂？ | **修复（声明边界）** | brief 新增「资产根目录」行，`reference/*.md` 相对引用可解析（实测指向 `%TEMP%\tt-fresh-deploy\vendor\be-architect`）；消费端接口列为下一迭代（§6）。brief 性质在 README/报告明确声明为「指令包，需宿主消费」 |
| 3 | auto 报告语义误导？ | **修复** | 报告每个子任务带 `(mode: X)`；摘要「N 真实执行 / N prompt 兜底(指令包) / N planned-only 降级 / N skipped」；存在兜底/降级时追加 ⚠ 警告行 |
| 4 | resume 回归 | **未发现问题（保留）** | 混合 plan 只重试 skipped/failed（done attempts 不增）；全 done 直接出报告不重跑；`--resume --dry-run` 互斥 exit 2；报告子任务完整 |
| 5 | assets 加载 | **修复（部分）** | 懒加载：`only` 只读本计划路由到的资产；assetsRoot 解耦（不再依赖 workspace 含 vendor）；「方法论全文」表述修正为「顶层 SKILL.md 正文 + 资产根目录（reference 按需解析）」 |
| 6 | 路径与编码 | **修复** | 源文件 U+FFFD：orchestrator 176→0、runtime/state 归零；新增 validator ⑧ U+FFFD 扫描（scripts+SKILL）。深扫全仓仅剩 3 个历史日志文档（CHANGELOG/OPTIMIZATION/RELEASE）+ 1 个历史 spec（BE-12）含作者路径，属历史记录非部署面 |
| 7 | 参数面 | **修复** | `--backend` 缺值 → exit 2（不再静默回落 auto）；`--backend bogus` → 2；`--max-retries -3/abc` → 2；`--help` → 0；无任务 → 2；`--resume --dry-run` → 2 |

## 2. 扩展可移植性审计（P3 保证）

| 项 | 修复前 | 修复后 | 证据 |
|---|---|---|---|
| 16 资产路由可达 | 14/16 | **16/16** | `matrix.mjs` T4 加 `agent-vision-toolkit`、T5 加 `skill-sentinel`；`vendor/agent-vision-toolkit/SKILL.md` frontmatter `name` 改回目录名（消除注册漂移）；validator 新增 ⑥b name==目录名校验 |
| vendor/workspace 解耦 | 产物落 skill 安装目录 | 产物/状态落 `--workspace`（默认 `config.json` projectRoot）；vendor 恒取随包 `SKILL_DIR/vendor` | `--workspace %TEMP%\x` 实测 artifacts/.tt-state 落在 x、brief 根指向 skill 内 vendor；skill 目录零污染 |
| 部署面硬编码 | validator 只扫 SKILL+3 脚本 | 扫 SKILL+README+ONBOARDING+templates/**/*.md+全部 scripts/**/*.mjs | 深扫 13 文件命中→剔除自引用/历史日志后，部署面归零；README/ONBOARDING 自述行改为不含字面路径 |
| 过期资产名 | SKILL.md §6.6/§2.1、config、ONBOARDING 引用已合并消失的 `ui-ux-pro-max`/`taste-skill`/`prd-writer`/`vibe-coding-prd` | 全部替换为现行簇名 | validate 16/16、0 漂移 |
| 测试可移植 | `test-retry.mjs` 用 `sleep`（Windows 无此命令，2 用例必挂） | 改 `node -e setTimeout` | 6/6 ALL PASS |

## 3. 变更文件清单（15 文件）

| 文件 | 变更 |
|---|---|
| `scripts/orchestrator.mjs` | 全量重写（编码修复）：SKILL_DIR/VENDOR_DIR 解耦、config.json projectRoot 默认、`--backend` 缺值校验、loadAssets 传 assetsRoot/only、runValidate cwd=SKILL_DIR |
| `scripts/lib/runtime.mjs` | 全量重写（编码修复）：子任务 `mode` 标注、plan.modes 摘要 |
| `scripts/lib/state.mjs` | 重写（编码修复） |
| `scripts/lib/asset.mjs` | 新增 assetsRoot/only 参数（懒加载），root 改从 assetsRoot 解析 |
| `scripts/lib/manifest.mjs` | `loadManifest` 增 `stateDir` 参数（缓存落 workspace/.tt-state） |
| `scripts/lib/report.mjs` | markdown 执行摘要 + mode 标注 + ⚠ 警告行；JSON 增 modes |
| `scripts/lib/adapters/bmad-cline.mjs` | `--backend cli` 下 cline 缺失直接返回 probe（不再 planned-only 降级） |
| `scripts/lib/adapters/prompt.mjs` | brief 增「资产根目录」声明 |
| `scripts/lib/matrix.mjs` | T4+T5 补 2 个可达资产 |
| `scripts/validate-structure.mjs` | ⑥b name==目录名；⑤ 扫描面扩展；新增 ⑧ U+FFFD 扫描 |
| `scripts/test-retry.mjs` | `sleep` → `node -e`（Windows 可移植） |
| `vendor/agent-vision-toolkit/SKILL.md` | frontmatter name 统一为目录名 |
| `SKILL.md` / `README.md` / `ONBOARDING.md` / `config.example.json` | 过期资产名替换；README 补 `--workspace`/`chcp 65001`/mode 语义；自述行去字面路径 |
| `ACCEPTANCE-REPORT.md` / `CRITICAL-TEST-PROMPT.md` | 作者绝对路径 → `<TT_REPO>` 占位 |

## 4. 复验命令与期望输出（规划 agent 独立重跑）

```bash
# 结构回归：期望 [OK] 0 项错误、16/16、0 泄露、0 编码损坏
node scripts/validate-structure.mjs

# P3 超时重试回归：期望 ALL PASS (exit 0)
node scripts/test-retry.mjs

# 路由可达性：期望 reachable 16/16
node -e "import('./scripts/lib/matrix.mjs').then(async ({CLUSTERS})=>{const {buildManifest}=await import('./scripts/lib/manifest.mjs');const m=await buildManifest({vendorDir:process.cwd()+'/vendor'});const names=new Set(m.entries.map(e=>e.name));const routed=new Set();for(const c of CLUSTERS)for(const n of c.candidates)if(names.has(n))routed.add(n);console.log(routed.size+'/'+names.size)})"

# 执行三模式 + 诚实标注（state.json 检查 mode 字段）
node scripts/orchestrator.mjs --task "backend login module"
#   期望：8 子任务，5 prompt + 1 planned-only(sdlc) + 2 skipped，degraded=false，modes={prompt:5,skipped:2,planned-only:1}
node scripts/orchestrator.mjs --task "backend login module" --backend cli
#   期望：8/8 skipped，degraded=true（sdlc 不再 planned-only）
node scripts/orchestrator.mjs --task "backend login module" --backend prompt
#   期望：8/8 done mode=prompt

# resume：期望只重试 skipped，done 的 attempts 不增；全 done 直接出报告
node scripts/orchestrator.mjs --resume
node scripts/orchestrator.mjs --resume --dry-run   # 期望 exit 2

# 参数面：期望全部 exit 2
node scripts/orchestrator.mjs --task x --backend
node scripts/orchestrator.mjs --task x --backend bogus
node scripts/orchestrator.mjs --task x --max-retries -3

# 可移植性（关键）：拷贝到全新目录后从该目录独立跑通
robocopy <TT_REPO> %TEMP%\tt-fresh /E /XD .git artifacts .tt-state node_modules
cd %TEMP%\tt-fresh
node scripts\validate-structure.mjs      # [OK]
node scripts\test-retry.mjs              # ALL PASS
node scripts\orchestrator.mjs --task "backend login module"   # exit 0
#   brief 资产根目录必须指向 %TEMP%\tt-fresh\vendor\...（非作者机器路径）
```

每次跑完清理：`Remove-Item -Recurse -Force artifacts,.tt-state`。

## 5. 已知遗留与设计决策（规划 agent 需知情）

1. **3 个历史文档为 GBK 编码（非 UTF-8）**（`COMPETITORS.md` / `ITERATION_PLAN.md` / `tt-together-agent-vibe-coding-prd.md`）：UTF-8 读取会现替换符，但字节级 EF BF BD 扫描为 **0**——无 FFFD 字节、内容可 GBK 恢复，非"损坏不可恢复"。本条目此前误报为 U+FFFD 损坏，根因是扫描用 UTF-8 解码；validator ⑧ 已改为字节级检测。
2. **gate 产物存在性检测仍可被 brief.md 单文件满足**：**有意保留**。prompt 后端的产品本质就是指令包，强制要求非 brief 产物会逼出更假的占位文件。诚实性改由 `mode` 标注 + 报告警告承担（已验证）。
3. **brief 消费链仍未实现真实宿主端**：orchestrator 是「指令包生成层」是**声明的事实**而非缺陷——README 已明确「需宿主平台消费产物后回填结果」。接真实宿主（WorkBuddy/Claude Code/Codex）为下一迭代（§6）。
4. **历史日志保留作者路径**（CHANGELOG/OPTIMIZATION/RELEASE/BE-12）：变更记录的是过去事实，改写即篡改历史；已用 `<TT_REPO>` 占位替换的是**活跃**验收/测试文档。

## 6. 对规划 agent 的建议（下一迭代候选）

- **P1**：brief 消费端——为 WorkBuddy/Claude Code/Codex 各加一个「读取 brief → 产出结果 → 回填」的宿主适配器，把指令包层升级为执行层。
- **P2**：契约 gate 内容级校验（非仅存在性）——brief 产物含任务专属输出段才判 done。
- **P2**：`plan.degraded` 细分——当前仅「全 skipped」置真；可对「存在 prompt/planned-only done」加 `plan.warnings` 独立字段。
- **P3**：asset 正文缓存（manifest 哈希触发刷新），支持几百资产仓库。

## 7. 证据完整性

- 全部验收命令独立重跑，未采信任何完工声明。
- 新鲜部署模拟（`%TEMP%\tt-fresh-deploy-2`）完整复验 validate/detect/retry/orchestrator/resume/brief 资产根，全部 PASS。
- 验收后工作区已清理（artifacts/、.tt-state/、临时目录），`git status` 仅含 15 个目标文件改动，无新增文件。
- 本报告本身及 §4 命令为规划 agent 的**可复现验收依据**。
