# Task: FE-08 sdlc 资产改写（BMAD-METHOD + cline）

## 概述
把 `vendor/sdlc/` 从 TT 自研编排改写为以 **BMAD-METHOD（方法论层）+ cline（执行层）** 组织的版本：phase 定义对齐现有 `skills/{plan,develop,review,summarize}`，执行模式对齐 cline 的 plan/exec。与 BE-08 适配器双向对齐。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Frontend（资产层）
- **上游依赖**：无（sdlc 未参与簇化，保留独立）
- **下游被依赖**：**BE-08（适配器按本文档的 phase 序列实现）**、FE-06（条目中 sdlc 仍为独立 skill）

## 目标与非目标
**目标**
- `vendor/sdlc/SKILL.md` 的编排方法论改写为 BMAD phase + cline plan/exec。
- 保留现有四个子 skill（`skills/plan`、`skills/develop`、`skills/review`、`skills/summarize`）与 6 个 agent 的能力，不丢失内容。
- phase 序列与 BE-08 的 `BMAD_PHASES` 常量严格一致。

**非目标**
- 不复制 BMAD / cline 源码（风险 R1：仅引用方法论）。
- 不删除现有子 skill 与 agent（只重组与改写说明）。

## 前置条件
- 已阅读 `vendor/sdlc/` 现有结构：`SKILL.md`、`README.md`、`skills/{plan,develop,review,summarize}/SKILL.md`、`agents/{control,developer,peer,sprint,summary,supervisor}.md`、`scripts/collect-summaries.sh`。
- 已了解 BMAD-METHOD 的阶段概念与 cline 的 plan/exec 模式（依据 `COMPETITORS.md`）。

## 输入
- `vendor/sdlc/` 现有全部文件；BMAD/cline 的方法论要点。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `vendor/sdlc/SKILL.md` | 改写 | 方法论层：BMAD phase；执行层：cline plan/exec |
| `vendor/sdlc/reference/bmad-phases.md` | 创建 | 四个 phase 的定义、输入、输出、验收 |
| `vendor/sdlc/reference/cline-exec.md` | 创建 | cline 的 plan/exec 用法（以真实 `--help` 为准） |
| `vendor/sdlc/skills/*/SKILL.md` | 保留/微调 | 保持四个子 skill，仅在需要时补 phase 对齐说明 |
| `vendor/sdlc/agents/*.md` | 保留 | 6 个 agent 不动（能力保留） |

## 实现步骤
1. 通读现有 sdlc，列出四个子 skill 与 6 个 agent 的职责清单（合并时不得丢失）。
2. 定义 phase 序列（**必须与 BE-08 的 `BMAD_PHASES` 完全一致**）：
   `PHASES = ['plan', 'develop', 'review', 'summarize']`
   —— 与现有 `skills/` 四个目录名一一对应，这是保持兼容的关键。
3. 新建 `reference/bmad-phases.md`：为每个 phase 写明：
   - `plan`：需求 → 计划（输入需求，输出计划文档）
   - `develop`：计划 → 代码（输入计划，输出实现产物）
   - `review`：产物 → 评审结论（输入产物，输出问题清单）
   - `summarize`：结论 → 汇总（输入评审，输出阶段总结）
   每个 phase 含：目标、输入、输出、验收点、失败处理。
4. 新建 `reference/cline-exec.md`：记录 cline 的 plan/exec 调用方式（**执行 `cline --help` 核实，不确定处标注「待核实」，禁止编造**）；说明「cline 不可用时降级为 planned-only」。
5. 改写 `vendor/sdlc/SKILL.md`：
   - frontmatter 保留 `name: sdlc`，`version` 递增（如 `2.0.0`），description 改为「BMAD phase + cline plan/exec 的软件生命周期编排」。
   - 正文：方法论层（BMAD）→ 执行层（cline）→ 四个 phase 索引 → 子 skill/agent 索引 → 降级说明。
   - 明确写出：BMAD 是**方法论**（组织阶段序列），真正执行由 cline（可用时）或 implementation 簇（opencode）承接，避免职责混淆。
6. 保留 `scripts/collect-summaries.sh` 与 6 个 agent，不做删除。

## 关键契约 / 数据结构

```yaml
# vendor/sdlc/SKILL.md frontmatter
---
name: sdlc
description: 软件生命周期编排 — BMAD-METHOD 阶段方法论 + cline plan/exec 执行模式
version: 2.0.0
---
```

```js
// 必须与本资产一致（BE-08）
export const BMAD_PHASES = ['plan', 'develop', 'review', 'summarize'];
```

```
vendor/sdlc/
  SKILL.md
  reference/
    bmad-phases.md   # 四 phase 定义
    cline-exec.md    # cline 调用与降级
  skills/{plan,develop,review,summarize}/SKILL.md   # 保留
  agents/{control,developer,peer,sprint,summary,supervisor}.md  # 保留
  scripts/collect-summaries.sh   # 保留
```

## 验收标准（Given / When / Then）
- Given 改写完成，When 检查 `vendor/sdlc/SKILL.md` frontmatter，Then `name=sdlc` 且 `version` 已递增，description 含 BMAD 与 cline。
- Given `reference/bmad-phases.md`，When 检查 phase 列表，Then 恰好四个且顺序为 `plan → develop → review → summarize`，与 `vendor/sdlc/skills/` 的四个目录名一致。
- Given BE-08 已实现，When 对比 `scripts/lib/adapters/bmad-cline.mjs` 的 `BMAD_PHASES`，Then 与文档的 phase 序列**完全一致**。
- Given 改写后，When 检查 `vendor/sdlc/agents/`，Then 6 个 agent 文件仍在且未被删除。
- Given 改写后，When 检查 `vendor/sdlc/skills/`，Then 四个子 skill 仍在。
- Given `reference/cline-exec.md`，When 检查命令示例，Then 参数来自实际 `--help` 或标注「待核实」，含「不可用时降级为 planned-only」的说明。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor/sdlc/skills vendor/sdlc/agents
grep -n "plan\|develop\|review\|summarize" vendor/sdlc/reference/bmad-phases.md
grep -n "BMAD_PHASES" scripts/lib/adapters/bmad-cline.mjs   # 与 BE-08 对齐
node scripts/validate-structure.mjs   # sdlc 仍应作为 16 项之一通过
```

## 失败与回滚
- 失败：phase 序列与 BE-08 不一致 → 以 `vendor/sdlc/skills/` 实际目录名为准，两侧同步修正。
- 失败：误删 agent/子 skill → `git checkout -- vendor/sdlc/` 恢复后重来。
- 回滚：`git checkout -- vendor/sdlc/`；删除新增的两个 reference 文件。

## 风险与注意
- 职责混淆是最大风险：**BMAD 是方法论不是可执行 CLI**，文档必须写清「方法论组织阶段、cline/opencode 负责执行」。
- phase 名称必须与现有 `skills/` 目录名一致，否则 BE-08 与文档会漂移。
- cline 参数必须 `--help` 核实，禁止编造。

## 交付物检查清单
- [ ] `SKILL.md` 已改写（BMAD + cline），version 递增
- [ ] `reference/bmad-phases.md` 四 phase 定义完整
- [ ] `reference/cline-exec.md` 含真实用法与降级说明
- [ ] 四个子 skill 与 6 个 agent 全部保留
- [ ] phase 序列与 BE-08 完全一致
- [ ] 未复制 BMAD/cline 源码
