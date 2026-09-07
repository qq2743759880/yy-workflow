# TT 阶段验收报告：execution-trust + 宿主真机验证 + Phase 2 资产替换

> 验收方式：只读复现 + 代码审读 + 新鲜部署模拟，不信任任何完工说明，全部命令独立重跑。
> 验收对象：工作树当前状态（基线 commit `cbd0868` + 未提交增量：execution-trust 5 task、宿主执行修复、Phase 2 三资产替换）。
> 仓库：`<TT_REPO>`（Windows，PowerShell）。
> 验收时间：2026-08-29（GMT+8）。

## 0. 总体结论

**PASS。** 阶段内 5 个 task（BE-13 契约文件工作流 / BE-14 宿主执行硬化 / BE-15 资产缓存 / FE-11 文档同步 / BE-16 一键回归）全部落地；`--exec` 宿主通道经**真实 LLM 端到端验证**（a6api/DeepSeek-V4-Flash-0731，5 子任务 mode=exec，8269 字节真实交付物）；Phase 2 三个高杠杆资产（implementation→opencode / sdlc→BMAD+cline / be-validator→portman）内容对齐竞品内核执行契约。**回归基线 6/6 PASS，无遗留 P0/P1。**

## 1. 分项验收表

| 域 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| A | 一键回归基线（BE-16） | **PASS** | `regression-all.mjs` 6/6 PASS：S1 结构 / S2 重试 / S3 Phase2 清单 / S4 契约 / S5 宿主执行 / S6 缓存，exit 0 |
| B | 契约文件工作流（BE-13） | **PASS** | `contracts/<planId>.json` 冻结；`--dry-run` 零副作用；执行期篡改契约 → `ContractViolationError` → **exit 4** |
| C | 宿主执行（BE-14） | **PASS** | stdout 型 → `mode=exec`；写文件型（claude/codex 行为，无 stdout）→ `mode=exec`；空输出/超时 → 诚实降级 `mode=prompt`；`--exec-timeout` 生效（sleep 3s+timeout 500ms → 589ms 降级） |
| D | 资产缓存（BE-15） | **PASS** | `assets-cache.json` 只含路由资产（8 项）；二次运行复用；touch vendor mtime → 失效重读仍绿 |
| E | 执行诚实性 | **PASS** | `mode` 五态（exec/cli/prompt/planned-only/skipped）+ `plan.modes` + `plan.warnings`；报告 markdown 含执行摘要与 ⚠ 提示，防误读假成功 |
| F | resume 语义 | **PASS** | 混合 plan 只重试 skipped/failed（done 的 attempts 不增）；全 done 直接出报告不重跑；`--resume --dry-run` 互斥 exit 2 |
| G | 路由可达性 | **PASS** | 16/16 资产可达，无不可路由项 |
| H | 编码与可移植性 | **PASS_WITH_NOTE** | 部署面 0 U+FFFD、0 路径泄露；仅 3 个历史日志文档（COMPETITORS/ITERATION_PLAN/PRD）保留原写入时丢失的 FFFD，不可恢复、非部署面 |
| I | 新鲜部署 | **PASS** | 整目录拷贝到 `%TEMP%` 独立跑 `regression-all` 6/6 PASS；brief 资产根指向拷贝位置（非作者机器路径） |
| J | Phase 2 替换（3 高杠杆） | **PASS** | implementation→opencode / sdlc→BMAD+cline(v2.1.0) / be-validator→portman 执行契约对齐；S3 漂移门 marker 保留；`validate-structure` 0 漂移；竞品 flag 以 `--help` 为准诚实表述，未编造命令 |
| K | 宿主真机验证 | **PASS** | 真实 LLM（a6api）端到端：brief → LLM → 写 plan.md → mode=exec；本机 claude/codex 模型路由损坏属用户代理体系，超出 TT 边界未改动 |

## 2. 关键命令与退出码（全部独立复现）

```bash
node scripts/regression-all.mjs        # 6 PASS / 0 FAIL，exit 0
node scripts/validate-structure.mjs    # [OK] 16/16、0 漂移、0 泄露、0 编码损坏，exit 0
node scripts/orchestrator.mjs --task "backend login module"
# T2 auto：modes={prompt:5, skipped:2, planned-only:1}，degraded=false，exit 0
node scripts/orchestrator.mjs --resume # remaining=2（只重试 skipped），exit 0
node scripts/orchestrator.mjs --task x --backend    # exit 2（缺值）
node scripts/orchestrator.mjs --task x --exec-timeout abc  # exit 2
# 契约篡改（exec 内 append 契约文件）→ contract violation → exit 4
node scripts/orchestrator.mjs --task "frontend page" --dry-run  # 零副作用
node scripts/test-retry.mjs           # ALL PASS
```

## 3. 已知遗留与决策（交接 agent 需知情）

1. **本机 claude/codex 无法非交互执行**：模型路由配置（`DeepSeek-V4-Flash-0731` 不被 Claude Code 2.x 识别 / codex 走本地 PROXY_MANAGED 代理）属于用户 cc-switch 代理体系，**TT 未改动**。真机验证改走 a6api OpenAI 兼容端点，已跑通。
2. **竞品 CLI flag 未实测**：opencode/cline/portman 均未安装，执行契约中的 flag 以"`--help` 为准"诚实表述；装真机后需行为级复核。
3. **契约文件被"执行前篡改"不触发 exit 4**：gate 只比对**执行期**前后 hash；执行前已篡改的文件被 fresh snapshot 后视为基线。这是设计（防执行期篡改），非缺陷。
4. **全仓 0 U+FFFD**：字节级深扫（EF BF BD）全仓 **0 文件**。`COMPETITORS.md` / `ITERATION_PLAN.md` / `tt-together-agent-vibe-coding-prd.md` 为 **GBK 编码**（非 UTF-8）历史文档：UTF-8 读取会现替换符，但**不含任何 FFFD 字节**，GBK 读取可完整恢复（非"损坏不可恢复"）。此前两轮误报为 FFFD 损坏，根因是扫描用 UTF-8 解码而非字节级检测——已修正 validator ⑧ 为字节级 EF BF BD。

## 4. 交接建议

- 测试交接 Prompt 见 `TEST-HANDOFF-PROMPT.md`（供独立验收 agent 复跑）。
- 后续迭代：Phase 2 剩余候选（前端簇/agent-research/skill-sentinel/安全簇等）渐进替换，每替换跑 `regression-all` 卡点；装真机宿主后复核竞品 CLI 行为。

## 5. 独立验收记录（TEST-HANDOFF-PROMPT 投喂结果 + 修复）

独立验收 agent 结论 **FAIL**，发现 2 个 P0 + 1 个 P1 + 若干 P2，全部复现并已修复，复验通过：

| 级 | 发现 | 根因 | 修复 | 复验 |
|---|---|---|---|---|
| **P0** | workspace≠cwd 时契约 gate 静默降级 describe，"篡改→exit 4"失效 | `gate.parseContract` 按 cwd 解析相对契约路径 → ENOENT → describe | `gate.mjs` 新增 `resolveContractPath`（isAbsolute 或 join workspace）；`before/after` 透传 workspace；dispatch 传 opts | workspace=tmp 下篡改契约 → **exit 4** ✓ |
| **P0** | 宿主写空文件/无关文件被标 `mode=exec`（假执行） | `prompt.mjs` 只查"存在非 brief/result 文件"，不校验非空 | 改为校验产物文件 `stat.size > 0` | 空文件宿主 → `mode=prompt`（exec=0）✓；非空 → exec ✓ |
| **P1** | S3 漂移门被击穿（正文抽空仅留"no longer uses cline"仍 PASS） | marker 只是 `includes(k)` 关键字 contains | 升级为「非否定上下文行」判定（剔除 no longer/not/without/replaced 等） | 正常资产仍 PASS；抽空攻击样本不再通过 |
| **P1** | implementation.md 声称 probe 但 opencode.mjs 直接 spawn | 文档/代码漂移 | `opencode.mjs` 补 `--version` probe（与 bmad/portman 一致） | 行为一致 |
| **P2** | 执行期篡改无回归测试覆盖（S4 全程 describe 模式） | S4 只断言"文件存在+resume" | regression-all S4 增加「执行期篡改→exit 4」真实断言（tmpWs 下） | S4 现含 exit 4 断言 ✓ |
| **P2** | `待核实` 残留字符（contract-testing.md / opencode-usage.md） | 早期乱码修复占位 | 替换为准确描述 | 无残留 |
| **P2** | asset 签名与 spec 声明不符（无 generatedAt） | `signature()` 未含 manifest.generatedAt | 补入签名 | 缓存失效语义不变 |
| **P2** | portman 文件可读即 `pass:true`（弱验收） | hash 记录被当通过 | 改为 `pass:null + degraded`（未跑真实套件不制造假 pass）；契约路径解析与 gate 统一 | 诚实语义 |

**修复后回归**：`validate-structure` exit 0；`regression-all` **6/6 PASS**（S3/S4 已含加固断言）；字节级 FFFD 0。

### 二次验收（独立 agent 重投喂，PASS_WITH_ISSUES → 已修复）

二次验收确认上轮 2 个 P0 + P1 全部实测生效（gate workspace 解析、空文件降级、S3 否定句拦截、S4 篡改断言、opencode probe、portman pass:null），另发现 3 个新 P1 + 若干 P2，均已修复：

| 级 | 发现 | 修复 |
|---|---|---|
| **P1** | 无关非空文件（`junk.tmp`）可伪造 `mode=exec` | prompt.mjs 执行判定收紧：交付物命名白名单 `\.(md\|json\|yaml\|yml)$` + 非空（`stat.size>0`） |
| **P1** | 专用 CLI（opencode/cline/portman）真实成功时 `mode=adapter.name`，逃逸报告 exec 桶（真实执行为 0 exec 显示）；且 implementation.md 混淆 `--exec` 宿主通道与 opencode adapter | runtime.mjs：专用 CLI 成功统一归 `exec` 桶，prompt 无宿主/失败归 `prompt`，仅 bmad 降级归 `planned-only`；`subtask.adapter` 保留明细；implementation.md 修正文档-代码漂移 |
| **P1** | S3 漂移门仍可被 `deprecated/obsolete/stub 行`绕过 | 否定词扩充（+deprecated/obsolete/discontinued/unsupported）+ 要求「动作动词/内核语义 + 关键字」同行（ACTIVE 白名单） |
| **P2** | TEST-HANDOFF-PROMPT 改动计数失准 | 改为「以 git status 为准」 |
| **P2** | S4 篡改断言 planId 推导有簇序隐式依赖 | 补顺序依赖注释 |

**二次修复后回归**：`validate-structure` exit 0；`regression-all` **6/6 PASS**；字节级 FFFD 0。

### 三次验收（独立 agent 重投喂，PASS_WITH_ISSUES → P2 已清理）

三次验收确认前两轮 2 P0 + 3 P1 全部实测生效，**无新 P0/P1**，仅剩 7 个 P2 边界/文档项，已全部修复：

| P2 | 发现 | 修复 |
|---|---|---|
| 1 | 纯空白文件（size>0）判 exec | 改为内容 trim 后非空才算产出 |
| 2 | 仅 stderr 输出判 exec | util.mjs 分离 stdout/stderr：result.txt 只采信 stdout |
| 3 | resume 时契约文件缺失 → json gate 静默降级 describe 无告警 | orchestrator resume 分支校验契约存在性并 warn「篡改防护失效，建议重冻结」 |
| 4 | sdlc/SKILL.md 声称走 `--exec` host（与 bmad adapter 不符） | 删除该表述，注明 `--exec` 属 prompt 后端 |
| 5 | portman 归 exec 桶但产物 `pass:null not validated` | degraded 提升到 result 顶层 → runtime 归 planned-only |
| 6 | `--backend cli` 无专用 adapter 时 `subtask.adapter=undefined` | dispatch 置 `adapter='none'` |
| 7 | 4 个 vendor `.openclaw/source-origin.json` 含作者 `Z:\node\...` 机器路径 | spec 路径换 `<OPENCLAW_SOURCE_*>` 占位 |

**三次修复后回归**：`validate-structure` exit 0；`regression-all` **6/6 PASS**；字节级 FFFD 0；全仓无机器路径残留。
