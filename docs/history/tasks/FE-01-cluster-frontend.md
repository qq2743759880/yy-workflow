# Task: FE-01 资产簇化：前端设计簇（5 → 1）

## 概述
把 `frontend-design`、`taste-skill`、`ui-ux-pro-max`、`pick-ui-library`、`prototype` 五个重叠的前端/设计资产合并为一个 `frontend-design` 簇，统一底座为 `shadcn-ui/ui` + `bolt.new`，并把各自独有内容保留为簇内的 `reference/` 模块。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化）
- **层级**：Frontend（资产层）
- **上游依赖**：无（可最先执行）
- **下游被依赖**：FE-06（资产表更新）、FE-07（实现簇文档，无直接依赖但同一批次）、BE-04（planner 候选资产名需同步）、BE-12（回归数量）

## 目标与非目标
**目标**
- `vendor/frontend-design/` 成为唯一前端设计簇，含 `SKILL.md` + `reference/` 子模块。
- 不丢失任何一方的独有内容（设计品味、设计数据、组件选型、原型生成）。
- 统一底座说明：组件用 `shadcn-ui/ui`，原型生成用 `bolt.new` 思路。

**非目标**
- 不在此任务替换内部实现（属于 Next 阶段）；本次只做**重组与去重**。
- 不删除被合并资产的 LICENSE/署名（需保留到簇内 `LICENSES.md`）。

## 前置条件
- 已阅读五个资产的 `SKILL.md`：
  - `frontend-design`（生产级界面 + `reference/` 7 个设计维度文件）
  - `taste-skill`（反模板化设计 + `blocks/` 8 个版块）
  - `ui-ux-pro-max`（设计智能 + `data/*.csv` + `scripts/`）
  - `pick-ui-library`（组件库选型）
  - `prototype`（HTML 原型 + `PICKER.md`）
- 仓库可写，且当前无未提交改动（建议先 `git status` 确认）。

## 输入
- `vendor/{frontend-design,taste-skill,ui-ux-pro-max,pick-ui-library,prototype}/`

## 需要创建 / 修改的文件

| 文件 / 目录 | 动作 | 说明 |
|---|---|---|
| `vendor/frontend-design/SKILL.md` | 改写 | 簇入口：总述 + 五个能力模块索引 |
| `vendor/frontend-design/reference/taste-blocks/` | 创建（迁入） | 原 `taste-skill/blocks/` |
| `vendor/frontend-design/reference/design-data/` | 创建（迁入） | 原 `ui-ux-pro-max/data/*.csv` 与 `scripts/` |
| `vendor/frontend-design/reference/component-selection.md` | 创建（迁入） | 原 `pick-ui-library/SKILL.md` 的选型矩阵 |
| `vendor/frontend-design/reference/prototyping.md` | 创建（迁入） | 原 `prototype/SKILL.md` + `PICKER.md` |
| `vendor/frontend-design/LICENSES.md` | 创建 | 汇总五个来源资产的许可与署名 |
| `vendor/{taste-skill,ui-ux-pro-max,pick-ui-library,prototype}/` | 删除 | 合并后移除（内容已迁入） |

## 实现步骤
1. 通读五个资产，列出各自**独有内容清单**（做成表格写入 PR 提交信息，便于回滚核对）。
2. 保留 `frontend-design` 作为簇根，保留其现有 `reference/` 7 个设计维度文件不动。
3. 迁入：
   - `taste-skill/blocks/*` → `vendor/frontend-design/reference/taste-blocks/`
   - `ui-ux-pro-max/data/*`、`ui-ux-pro-max/scripts/*` → `vendor/frontend-design/reference/design-data/`
   - `pick-ui-library/SKILL.md` 正文 → `vendor/frontend-design/reference/component-selection.md`
   - `prototype/SKILL.md` + `PICKER.md` → `vendor/frontend-design/reference/prototyping.md`
4. 改写 `vendor/frontend-design/SKILL.md`：
   - frontmatter 保留 `name: frontend-design`，`version` 递增为 `2.0.0`，`description` 改为涵盖五个能力。
   - 正文分五节：①设计生成 ②反模板化品味 ③设计数据与搜索 ④组件库选型 ⑤原型生成；每节指向对应 `reference/` 文件。
   - 新增「统一底座」段：组件基线 `shadcn-ui/ui`、原型生成 `bolt.new`、动效增强 `magicui`（引用 `COMPETITORS.md` 的结论）。
5. 建立 `LICENSES.md`，把 taste-skill / ui-ux-pro-max / prd-writer 等自带 LICENSE 的内容登记进去（保留原许可声明，不要丢）。
6. 删除四个已合并目录；**不要**删除 `.openclaw/source-origin.json`（如果存在，一并迁入簇内 `reference/` 或保留溯源信息）。
7. 用 `git status` 确认删除与新增符合预期，暂不提交（等 FE-06 一起提交）。

## 关键契约 / 数据结构

```yaml
# vendor/frontend-design/SKILL.md frontmatter
---
name: frontend-design
description: 统一前端设计簇：设计生成 / 反模板化品味 / 设计数据 / 组件库选型 / 原型生成
version: 2.0.0
---
```

簇内结构：
```
vendor/frontend-design/
  SKILL.md
  LICENSES.md
  reference/            # 原有 7 个设计维度文件
    taste-blocks/       # ← taste-skill
    design-data/        # ← ui-ux-pro-max
    component-selection.md  # ← pick-ui-library
    prototyping.md      # ← prototype
```

## 验收标准（Given / When / Then）
- Given 合并完成，When 检查 `vendor/`，Then `taste-skill`、`ui-ux-pro-max`、`pick-ui-library`、`prototype` 四个目录不存在，且 `frontend-design` 存在。
- Given `vendor/frontend-design/`，When 检查其 frontmatter，Then `name` 为 `frontend-design`、`version` 为 `2.0.0`、`description` 涵盖五个能力。
- Given 原 `taste-skill` 的 8 个 blocks 文件，When 合并后检查 `reference/taste-blocks/`，Then 8 个文件全部存在。
- Given 原 `ui-ux-pro-max` 的 `data/*.csv`，When 合并后，Then `reference/design-data/data/` 下 CSV 数量与原目录一致。
- Given 簇已建立，When 检查 `LICENSES.md`，Then 五个来源资产的许可/署名均被登记，无遗漏。
- Given 合并后，When 运行 `node scripts/validate-structure.mjs`（FE-06 更新前），Then 会因条目不匹配而报错——这是**预期现象**，由 FE-06 修复（不要在本任务跳过 FE-06）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor                                  # 四个目录应已消失
ls vendor/frontend-design/reference
ls vendor/frontend-design/reference/taste-blocks | wc -l    # 期望 8
find vendor/ui-ux-pro-max -name "*.csv" 2>/dev/null | wc -l # 期望 0（已迁入）
node scripts/validate-structure.mjs         # 预期报错，待 FE-06 修复
```

## 失败与回滚
- 失败：迁入后内容缺失 → `git checkout -- vendor/` 恢复，重新按独有内容清单核对。
- 回滚：`git checkout -- vendor/` 即可恢复全部五个目录（前提：本任务未提交）。

## 风险与注意
- **R3 独有能力丢失**：合并前必须先列独有内容清单，逐条核对已迁移。
- `ui-ux-pro-max` 的 `scripts/` 含 Python 脚本与测试，迁入后路径变化可能影响其内部相对引用——迁入后需检查脚本内是否有硬编码相对路径并修正。
- 不要改动其他簇的资产（本任务只动前端设计簇）。

## 交付物检查清单
- [ ] 四个旧目录已删除、内容已迁入
- [ ] `SKILL.md` 已改写为五个能力的索引，version=2.0.0
- [ ] `LICENSES.md` 已登记五个来源
- [ ] taste-blocks 8 文件、design-data CSV 数量与原一致
- [ ] 未提交（等 FE-06 统一提交）
