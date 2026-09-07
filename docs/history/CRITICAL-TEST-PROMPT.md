# TT 编排内核 P1-1 根治——批判性测试 Prompt

> 用途：把本文件完整投喂给任意 agent（Claude Code / Codex / opencode / WorkBuddy 等）做**批判性验收**。
> 验收对象：TT 仓库提交 `7ab1faa`（fix: P1-1 execution layer — asset body into execution context）。
> 原则：**不信任提交说明**，全部命令独立重跑 + 代码审读；重点不是「能不能跑」，而是「设计是否成立、有没有假成功」。

---

## 0. 你的角色

你是独立验收员，不是开发者的帮手。以下是开发者对这次改动的自述，**请把它当作待证伪的假设**：

「P1-1 根治：新增资产加载器（asset.mjs）把 vendor 资产方法论全文读入内存；新增内置 Prompt 执行后端（prompt.mjs）把『资产正文 + 任务 + contract + 上游产物引用』组装为子任务执行指令包 brief.md；适配器注册表兜底后 16 个资产全部可达；--backend auto|prompt|cli 三模式；顺带修复 resume 重跑 bug。」

## 1. 验收对象与范围

- 仓库：`<TT_REPO>`（Windows，Git Bash；`<TT_REPO>` = 本 skill 目录）
- 提交：`7ab1faa`（父提交 `f37e5bd`）
- 变更文件：`scripts/lib/asset.mjs`（新增）、`scripts/lib/adapters/prompt.mjs`（新增）、`scripts/lib/adapters/index.mjs`、`scripts/lib/runtime.mjs`、`scripts/orchestrator.mjs`、`README.md`、`ACCEPTANCE-REPORT.md`、`.claude/specs/tasks/BE-05-agent-runtime.md`
- 只读复现命令：
  ```bash
  git -C /d/.ai-hub/skills/tt show 7ab1faa --stat
  git -C /d/.ai-hub/skills/tt diff f37e5bd 7ab1faa -- scripts/lib
  ```

## 2. 预设批判点（逐条验证或推翻，给出证据）

1. **「prompt 后端是不是另一种假执行？」** 开发者声称 T4 前端 6/6 done + brief 产物。但 brief.md 只是『资产正文 + 任务拼接成的文档』——没有真实推理产出。它是否只是把『假成功』从 skipped 换成 done？gate 的产物存在性检测是否被 brief.md 轻易蒙混？**判断标准**：brief.md 是否真的构成『可执行指令包』（含任务、方法论、上游引用、产出要求），还是空壳占位。
2. **消费链断裂**：brief.md 写给谁？仓库内没有任何宿主消费端（没有读取 brief 并产出的模块）。『执行层』是否只是『指令包生成层』？请指出若要接入真实宿主（WorkBuddy/Claude Code/Codex），缺口在哪几个函数/接口。
3. **auto 混合模式的报告语义**：T2 auto 下 6 done + 2 skipped（外部 CLI 缺失）。报告是否如实区分『prompt 兜底 done』与『CLI skipped』？有没有可能让用户误以为 6 个都真实执行了？
4. **resume 回归**：executePlan 现在跳过 `status==='done'` 的子任务。验证：① resume 一个 mixed plan（部分 done 部分 skipped）是否只重试 skipped；② resume 全 done plan 是否直接出报告不重跑；③ `--resume` 与 `--dry-run` 互斥是否仍生效；④ resume 后报告的 subtasks 是否完整（不再丢已完成的子任务）。
5. **assets 加载**：loadAssets 每次运行读全部 16 个资产全文（含 taste-skill 1202 行大文件）进内存。有无缓存/懒加载？对超大仓库（几百个资产）是否可扩展？asset 缺失正文时（body=''）prompt 后端行为是否明确？
6. **路径与编码**：Windows 下 `artifacts\plan-x\brief.md` 反斜杠路径出现在 brief 上游引用中，换到 Linux/macOS 是否一致？全仓扫描 `grep -rl $'\xEF\xBF\xBD' --exclude-dir=.git --exclude-dir=artifacts --exclude-dir=.tt-state .` 是否为零？
7. **参数面**：`--backend` 非法值是否 exit 2？`--backend` 后不跟值是否安全？`--max-retries`（若已加）是否校验？

## 3. 必跑命令与期望输出（对照记录实际输出）

```bash
cd /d/.ai-hub/skills/tt

# 1) T4 前端 auto：6 子任务全 done，无 degraded，每个有 brief.md
node scripts/orchestrator.mjs --task "做一个 landing page 前端页面"
# 期望：plan status=done, degraded=false, 6/6 done, artifacts/<plan>-0/brief.md 存在且含方法论正文

# 2) T2 后端 auto：混合语义
node scripts/orchestrator.mjs --task "实现后端登录模块"
# 期望：be-architect/be-provider/be-resilience/security/review = prompt 兜底 done；
#       implementation/be-validator = CLI 缺失 skipped（OPENCODE_NOT_AVAILABLE / CONTRACT_TOOL_NOT_AVAILABLE）；
#       sdlc = planned-only done；degraded=false

# 3) T2 prompt 全本地：8/8 done
node scripts/orchestrator.mjs --task "实现后端登录模块" --backend prompt

# 4) T2 cli 模式：仅专用 adapter，CLI 缺失时全 skipped + degraded=true
node scripts/orchestrator.mjs --task "实现后端登录模块" --backend cli

# 5) resume 四种场景（见预设批判点 4）

# 6) 结构回归 + 乱码扫描
node scripts/orchestrator.mjs --task "实现后端登录模块" --validate   # [OK] 16/16
grep -rl $'\xEF\xBF\xBD' --exclude-dir=.git --exclude-dir=artifacts --exclude-dir=.tt-state . | wc -l  # 期望 0

# 7) 参数面
node scripts/orchestrator.mjs --task x --backend bogus; echo $?   # 期望 2
node scripts/orchestrator.mjs --help                              # 期望 0
```

## 4. 报告格式（投喂的 agent 按此输出）

```
# 批判性验收报告：7ab1faa（P1-1 根治）
## 结论：PASS / PASS_WITH_ISSUES / FAIL（三选一，一句话理由）
## 逐批判点：每点给出 验证结果（成立/推翻/部分成立）+ 证据（命令输出或代码行号）+ 影响
## 假成功审查：是否存在任何把『没做』标成『做了』的路径？（重点查 gate 与 prompt 交互、skipped 判定、degraded 计算）
## 修复建议：按 P0/P1/P2 分级列出
```

## 5. 特别提醒

- 全程**只读**：允许运行编排命令（会写 artifacts/、.tt-state/，已 gitignore），但**不要修改任何源码文件**；发现问题在报告中描述，不要顺手改。
- 每次跑完编排命令后清理：`rm -rf artifacts .tt-state`（在 tt 仓库内）。
- 关注「诚实性」多于「功能性」：编排系统的核心价值是**不撒谎**。
