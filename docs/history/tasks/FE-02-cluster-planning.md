# Task: FE-02 资产簇化：需求/规划簇（2 → 1）

## 概述
把 `prd-writer` 与 `vibe-coding-prd` 两个 PRD 生成资产合并为一个 `planning` 簇：`prd-writer` 面向正式产品需求文档，`vibe-coding-prd` 面向可直接交给编码 Agent 的精简 PRD。两者能力互补，合并为一个「PRD/规划」簇，统一底层结构。

> 注意：`dev-planner`（agent 型，负责规划与任务拆分）**保留为独立 agent 资产**，不并入本簇——它是执行者而非文档模板。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化）
- **层级**：Frontend（资产层）
- **上游依赖**：无
- **下游被依赖**：FE-06（资产表更新）、BE-04（planner 候选资产名同步）

## 目标与非目标
**目标**
- 新建 `vendor/planning/`（skill 型），整合两个 PRD 资产。
- 保留两种输出形态：正式 PRD（prd-writer 风格）与 Vibe Coding PRD（vibe-coding-prd 风格）。
- 保留 `vibe-coding-prd` 的四个强制确认关卡（需求定义 / 功能优先级 / 技术栈 / 原型图）——这是它的核心价值。

**非目标**
- 不合并 `dev-planner`。
- 不在本任务替换内部实现（Next 阶段才引入 MetaGPT / crewAI 竞品）。

## 前置条件
- 已阅读 `vendor/prd-writer/SKILL.md`（+ `PROMPT.md`、`README.md`、`LICENSE`）与 `vendor/vibe-coding-prd/SKILL.md`（+ `references/prd-template.md`）。
- 仓库可写；FE-01 可并行执行（互不重叠）。

## 输入
- `vendor/prd-writer/`、`vendor/vibe-coding-prd/`

## 需要创建 / 修改的文件

| 文件 / 目录 | 动作 | 说明 |
|---|---|---|
| `vendor/planning/SKILL.md` | 创建 | 簇入口：两种输出形态的选择与索引 |
| `vendor/planning/reference/formal-prd.md` | 创建（迁入） | 原 `prd-writer/SKILL.md` + `PROMPT.md` |
| `vendor/planning/reference/vibe-prd.md` | 创建（迁入） | 原 `vibe-coding-prd/SKILL.md` 正文（含四关卡） |
| `vendor/planning/reference/prd-template.md` | 创建（迁入） | 原 `vibe-coding-prd/references/prd-template.md` |
| `vendor/planning/LICENSES.md` | 创建 | 登记两个来源的许可与署名 |
| `vendor/{prd-writer,vibe-coding-prd}/` | 删除 | 合并后移除 |

## 实现步骤
1. 列出两个资产的独有内容清单（尤其 `vibe-coding-prd` 的四关卡规则与 `prd-template.md` 的 11 节结构）。
2. 创建 `vendor/planning/`，迁入上述文件到 `reference/`。
3. 编写 `vendor/planning/SKILL.md`：
   - frontmatter：`name: planning`，`version: 1.0.0`，description 涵盖「正式 PRD + Vibe Coding PRD」。
   - 正文首段给出**选择指引**：面向团队/正式评审 → 用 formal-prd；面向编码 Agent 直接执行 → 用 vibe-prd。
   - 两节分别指向对应 reference 文件，并简述各自流程（vibe-prd 必须保留四关卡的强制顺序）。
4. `LICENSES.md` 登记 prd-writer 与 vibe-coding-prd 的许可（prd-writer 自带 LICENSE）。
5. 删除两个旧目录（保留 `.openclaw/source-origin.json` 溯源信息，迁入 `reference/` 或簇根）。
6. 暂不提交，等 FE-06 一起提交。

## 关键契约 / 数据结构

```yaml
# vendor/planning/SKILL.md frontmatter
---
name: planning
description: 统一 PRD/规划簇：正式产品需求文档 与 可直接交给编码 Agent 的 Vibe Coding PRD
version: 1.0.0
---
```

```
vendor/planning/
  SKILL.md
  LICENSES.md
  reference/
    formal-prd.md        # ← prd-writer
    vibe-prd.md          # ← vibe-coding-prd（含四关卡）
    prd-template.md      # ← vibe-coding-prd/references/
```

## 验收标准（Given / When / Then）
- Given 合并完成，When 检查 `vendor/`，Then `prd-writer` 与 `vibe-coding-prd` 目录不存在，`planning` 存在且含 `SKILL.md`。
- Given `vendor/planning/SKILL.md`，When 检查 frontmatter，Then `name=planning`、`version=1.0.0`。
- Given 需要 Vibe Coding PRD 的用户，When 阅读簇文档，Then 能找到「四个强制确认关卡」的完整说明（需求定义/功能优先级/技术栈/原型图），且顺序未被打乱。
- Given 需要正式 PRD 的用户，When 阅读簇文档，Then 能找到指向 `formal-prd.md` 的明确路径与适用场景说明。
- Given 原 `vibe-coding-prd/references/prd-template.md` 的 11 节结构，When 检查 `reference/prd-template.md`，Then 11 节模板结构完整保留。
- Given 合并后，When 检查 `dev-planner`，Then 仍作为独立 agent 资产存在于 `vendor/dev-planner/`（未被合并）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor | grep -E "prd|planning"     # 期望只有 planning 与 dev-planner
ls vendor/planning/reference
grep -c "关卡" vendor/planning/reference/vibe-prd.md   # 期望 ≥4
ls vendor/dev-planner                  # 期望 dev-planner.md 仍在
```

## 失败与回滚
- 失败：vibe-prd 的四关卡规则丢失 → 从 `git show HEAD:vendor/vibe-coding-prd/SKILL.md` 取回原文。
- 回滚：`git checkout -- vendor/`（未提交前提下）。

## 风险与注意
- `vibe-coding-prd` 的四关卡是其核心差异化，**不可简化**——合并时最容易丢的就是「前一关未确认不进入下一关」这类硬规则。
- 不要误把 `dev-planner` 一起合并（它是对外提供规划能力的 agent，被 BE-04 与下游任务引用）。
- `prd-writer` 的 `PROMPT.md` 内容需迁入，不能只搬 `SKILL.md`。

## 交付物检查清单
- [ ] `planning` 簇已建立，两个旧目录已删除
- [ ] 四关卡规则完整保留
- [ ] `prd-template.md` 11 节结构保留
- [ ] `dev-planner` 保持独立未被合并
- [ ] `LICENSES.md` 已登记
- [ ] 未提交（等 FE-06）
