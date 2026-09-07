# Task: FE-05 资产簇化：评审簇（3 → 1）

## 概述
把 `critique`（批判性审查）、`be-tester`（自动化评审/测试 agent）、`polish`（打磨精简）合并为一个 `review` 簇（skill 型），统一「评审 → 改进」闭环，并统一评审内核说明（`qodo-ai/pr-agent` 行级批注 + `continuedev/continue` 规则即代码）。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化）
- **层级**：Frontend（资产层）
- **上游依赖**：无（可与 FE-01~04 并行）
- **下游被依赖**：FE-06（条目更新）、BE-04（候选资产名同步）

## 目标与非目标
**目标**
- 建立 `vendor/review/`（**skill 型**：含 `SKILL.md`）。
- 三阶段闭环：critique（发现问题） → be-tester（自动化验证） → polish（打磨改进）。
- 统一评审内核说明：行级批注（`pr-agent`）+ 规则即代码（`continue` checks）。

**非目标**
- 本任务不接入 pr-agent / continue（属 Next 阶段），只统一口径与重组。
- 不改变前端可视化验证资产 `frontend-visual-validation`（它属视觉验证，不并入本簇）。

## 前置条件
- 已阅读 `vendor/critique/SKILL.md`、`vendor/be-tester/be-tester.md`、`vendor/polish/SKILL.md`。
- FE-01~FE-04 可并行（互不重叠目录）。

## 输入
- `vendor/critique/`、`vendor/be-tester/`、`vendor/polish/`

## 需要创建 / 修改的文件

| 文件 / 目录 | 动作 | 说明 |
|---|---|---|
| `vendor/review/SKILL.md` | 创建 | 簇入口：三阶段闭环与索引 |
| `vendor/review/reference/critique.md` | 创建（迁入） | 原 `critique/SKILL.md` |
| `vendor/review/reference/polish.md` | 创建（迁入） | 原 `polish/SKILL.md` |
| `vendor/review/agents/be-tester.md` | 创建（迁入） | 原 `be-tester.md`（嵌套 agent，不再是顶层 AGENT_ENTRIES） |
| `vendor/review/LICENSES.md` | 创建 | 登记来源许可 |
| `vendor/{critique,be-tester,polish}/` | 删除 | 合并后移除 |

## 实现步骤
1. 列出三者独有内容（critique 的批判维度、be-tester 的测试/评审项、polish 的打磨原则如 YAGNI）。
2. 创建 `vendor/review/`，按上表迁入。
3. 编写 `vendor/review/SKILL.md`：
   - frontmatter：`name: review`，`version: 1.0.0`，description 涵盖批判/验证/打磨。
   - 正文三阶段：**①批判（critique）发现问题 → ②验证（be-tester）自动化检查 → ③打磨（polish）改进精简**，每阶段指向对应 reference/agents 文件。
   - 新增「统一评审内核」段：行级批注参考 `qodo-ai/pr-agent`，规则即代码参考 `continuedev/continue` 的 checks；标注为**说明性引用、未接入**。
   - 保留 polish 的 YAGNI / 最小改动原则（这是它的核心价值，易在合并中丢失）。
4. 保留 `.openclaw/source-origin.json` 溯源信息（若存在）。
5. 删除三个旧目录；暂不提交，等 FE-06。
6. **重要**：`be-tester` 由顶层 agent 变为嵌套 agent，需在 FE-06 从 `AGENT_ENTRIES` 移除。

## 关键契约 / 数据结构

```yaml
# vendor/review/SKILL.md frontmatter
---
name: review
description: 统一评审簇：批判发现 → 自动化验证 → 打磨改进
version: 1.0.0
---
```

```
vendor/review/
  SKILL.md
  LICENSES.md
  reference/
    critique.md   # ← critique
    polish.md     # ← polish
  agents/
    be-tester.md  # ← be-tester（嵌套）
```

## 验收标准（Given / When / Then）
- Given 合并完成，When 检查 `vendor/`，Then `critique`、`be-tester`、`polish` 目录不存在，`review` 存在且含 `SKILL.md`。
- Given `vendor/review/SKILL.md`，When 检查 frontmatter，Then `name=review`、`version=1.0.0`。
- Given 需要打磨/精简的用户，When 阅读簇文档，Then 能找到 polish 的 YAGNI 与最小改动原则（未被合并时丢失）。
- Given 需要自动化评审，When 阅读簇文档，Then 能找到指向 `agents/be-tester.md` 的路径且该文件保留原检查项。
- Given 簇文档，When 检查「统一评审内核」段，Then 写出 pr-agent 与 continue 且标注「未接入」。
- Given 合并后，When 在 FE-06 检查 `AGENT_ENTRIES`，Then `be-tester` 已被移除。
- Given 合并后，When 检查 `frontend-visual-validation`，Then 仍作为**独立资产**存在（未被并入 review）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor | grep -E "critique|be-tester|polish|review"   # 期望只有 review
diff <(git show HEAD:vendor/be-tester/be-tester.md) vendor/review/agents/be-tester.md && echo "一致"
diff <(git show HEAD:vendor/polish/SKILL.md) vendor/review/reference/polish.md && echo "polish 一致"
ls vendor/frontend-visual-validation   # 期望仍存在
```

## 失败与回滚
- 失败：polish 的 YAGNI 原则丢失 → 从 `git show HEAD:vendor/polish/SKILL.md` 取回并在新文档中补回。
- 回滚：`git checkout -- vendor/`（未提交前提下）。

## 风险与注意
- **类型变化**：`be-tester` 由顶层 agent 变嵌套 agent，必须与 FE-06 的 `AGENT_ENTRIES` 更新同步。
- polish 的原则性内容（YAGNI、最小改动）比流程更容易在合并中被删，务必显式核对。
- `frontend-visual-validation`（视觉回归）与 `review`（代码评审）职责不同，**不要合并**。

## 交付物检查清单
- [ ] `review` 簇已建立，三个旧目录已删除
- [ ] 三阶段闭环清晰，polish 的 YAGNI 原则保留
- [ ] `be-tester` 已嵌套且内容一致
- [ ] pr-agent / continue 说明标注未接入
- [ ] `frontend-visual-validation` 未被误合并
- [ ] 未提交（等 FE-06）
