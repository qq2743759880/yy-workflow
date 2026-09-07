# Task: FE-06 资产表与校验条目更新（确定最终 16 个资产）

## 概述
簇化（FE-01~FE-05）完成后，同步更新 `SKILL.md` §1c 资产表、`validate-structure.mjs` 的 `SKILL_ENTRIES` / `AGENT_ENTRIES`，使回归校验重新通过。本任务确定并固化**最终 16 个顶层资产**（10 skill + 6 agent）。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化收口）
- **层级**：Frontend（资产层）
- **上游依赖**：**FE-01 ~ FE-05 全部完成**
- **下游被依赖**：**BE-12（回归校验依赖本任务的条目与数量）**、BE-04（候选资产名）

## 目标与非目标
**目标**
- 更新 `SKILL.md` §1c 资产表为簇化后的 16 项。
- 更新 `validate-structure.mjs` 的 `SKILL_ENTRIES`（10）/ `AGENT_ENTRIES`（6）。
- 跑通 `node scripts/validate-structure.mjs`：16/16、0 警告、0 漂移、0 泄露。

**非目标**
- 不修改校验器的检查逻辑（只更新条目常量）。
- 不在此任务替换资产实现。

## 前置条件
- FE-01~FE-05 已全部完成，`vendor/` 结构如下（**务必以此为准确认**）：

**Skill 型（10 个，含 `SKILL.md`）**
| # | 目录 | 说明 |
|---|---|---|
| 1 | `agent-research` | 科研/调研子技能集（保留） |
| 2 | `agent-vision-toolkit` | 视觉 CLI（保留） |
| 3 | `colorize` | 图像上色（保留） |
| 4 | `frontend-design` | **簇**：原 5 合 1（FE-01） |
| 5 | `frontend-visual-validation` | 视觉回归（保留，不并入 review） |
| 6 | `planning` | **簇**：prd-writer + vibe-coding-prd（FE-02） |
| 7 | `review` | **簇**：critique + polish，嵌套 be-tester（FE-05） |
| 8 | `sdlc` | 生命周期编排（保留，FE-08 改写） |
| 9 | `security` | **簇**：audit + harden，嵌套 be-security（FE-03） |
| 10 | `skill-sentinel` | Skill 安全扫描（保留） |

**Agent 型（6 个，含 `<name>.md`，无 `SKILL.md`）**
| # | 目录 | 说明 |
|---|---|---|
| 1 | `be-architect` | 架构设计（保留） |
| 2 | `be-provider` | 依赖注入/服务提供（保留） |
| 3 | `be-resilience` | 弹性/熔断（保留） |
| 4 | `be-validator` | 契约校验（保留，FE-09 改写） |
| 5 | `dev-planner` | 规划/任务拆分 agent（保留，不并入 planning） |
| 6 | `implementation` | **簇**：dev-backend + be-implementer（FE-04） |

> 校验口径：`10 + 6 = 16` 个顶层 vendor 资产。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `SKILL.md` | 修改 | §1c 资产表改为上表；同步自包含计数「26 个」→「16 个」 |
| `scripts/validate-structure.mjs` | 修改 | `SKILL_ENTRIES`（10）、`AGENT_ENTRIES`（6）按上表更新 |
| `README.md` | 修改 | 资产清单同步（详细文档在 FE-10） |

## 实现步骤
1. 先**实地核对** `vendor/` 目录：`ls vendor` 数出实际一级目录数，与上表逐项比对（若实际与上表不符，以实际目录为准并修正上表，然后同步修正 PRD/ITERATION_PLAN 中的数量表述）。
2. 打开 `scripts/validate-structure.mjs`，找到 `const SKILL_ENTRIES = [...]` 与 `const AGENT_ENTRIES = [...]`，按上表重写：
   - `SKILL_ENTRIES`：10 个 skill 目录名。
   - `AGENT_ENTRIES`：6 个 agent 目录名。
   - **必须删除**已合并/降级的条目：`audit`、`harden`、`be-security`、`critique`、`polish`、`be-tester`、`prd-writer`、`vibe-coding-prd`、`prototype`、`pick-ui-library`、`taste-skill`、`ui-ux-pro-max`、`dev-backend`、`be-implementer`。
3. 打开 `SKILL.md`，定位 §1c 资产表，替换为上表（含「簇」标注与来源说明）；把文中「共 26 个」等表述统一改为「共 16 个」。
4. 运行校验，逐项修复（常见问题：frontmatter 缺 `version`、description 与实际不符、残留绝对路径）。
5. 校验通过后，把 FE-01~FE-06 的改动**一起提交**（`git add -A && git commit`），提交信息注明「簇化 26→16」。
6. 把最终数量（16）同步给 BE-12 的期望值（`expected` 常量）。

## 关键契约 / 数据结构

```js
// scripts/validate-structure.mjs
const SKILL_ENTRIES = [
  'agent-research', 'agent-vision-toolkit', 'colorize',
  'frontend-design', 'frontend-visual-validation',
  'planning', 'review', 'sdlc', 'security', 'skill-sentinel',
];
const AGENT_ENTRIES = [
  'be-architect', 'be-provider', 'be-resilience',
  'be-validator', 'dev-planner', 'implementation',
];
```

## 验收标准（Given / When / Then）
- Given FE-01~05 完成且条目已更新，When 运行 `node scripts/validate-structure.mjs`，Then 输出 `16/16 vendor`、`0 警告`、`接口漂移 无`、`可移植性泄露 无`。
- Given `ls vendor`，When 数一级目录，Then 恰好 16 个且与 `SKILL_ENTRIES + AGENT_ENTRIES` 完全一致（无多无缺）。
- Given `SKILL.md`，When 检查 §1c，Then 资产表列出 16 项并标注各簇来源，且文中不再出现「26 个资产」的旧表述。
- Given 校验器，When 检查 `AGENT_ENTRIES`，Then 不含 `be-security`、`be-tester`、`dev-backend`、`be-implementer`（已合并/降级）。
- Given 校验通过，When 执行 `git status`，Then FE-01~06 的改动已提交（工作区干净或仅剩后续任务改动）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor | wc -l                 # 期望 16
node scripts/validate-structure.mjs
grep -n "SKILL_ENTRIES" -A 12 scripts/validate-structure.mjs
grep -n "AGENT_ENTRIES" -A 8 scripts/validate-structure.mjs
grep -n "26 个" SKILL.md README.md || echo "无残留 26 的表述"
```

## 失败与回滚
- 失败：校验报「资产缺失」→ 多为某个簇目录名拼写不一致，用 `ls vendor` 逐字比对。
- 失败：报「frontmatter 缺失 version」→ 给对应 `SKILL.md` 补 `version: 1.0.0`（簇化改写的文档可能漏写）。
- 失败：报「可移植性泄露」→ 检查迁入文件是否带绝对路径（如 `D:\`、`C:\Users\`），改为相对路径或 `<USER_HOME>` 占位。
- 回滚：`git checkout -- SKILL.md scripts/validate-structure.mjs`；若 FE-01~05 尚未提交，`git checkout -- vendor/` 可整体回滚簇化。

## 风险与注意
- **数量口径**：PRD/ITERATION_PLAN 中写作「26→16」，本任务必须以 `ls vendor` 实际结果为准；若重组后不是 16，需同步修正 PRD 与 ITERATION_PLAN 的表述（由 FE-10 统一改）。
- 条目与目录**双向一致**：既不能少（漏检），也不能多（残留已删条目会导致误报缺失）。
- 本任务是簇化的**唯一收口点**，FE-01~05 在此之前都不提交，避免中间态不可回滚。

## 交付物检查清单
- [ ] `vendor/` 实际 16 个顶层目录
- [ ] `SKILL_ENTRIES`(10) 与 `AGENT_ENTRIES`(6) 已更新
- [ ] `SKILL.md` §1c 资产表已更新，旧「26 个」表述已清除
- [ ] `validate-structure.mjs` 通过：16/16、0 警告、0 漂移、0 泄露
- [ ] FE-01~06 已统一提交
- [ ] 最终数量已同步给 BE-12
