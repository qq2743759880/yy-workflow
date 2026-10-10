# 阶段文档模板（sdlc 生产资源）

> 模板标准件注记：执行模式声明块与四模板的字段名/去向行为 FIXED 区；`<>` 占位为 VARIABLE 区。

## 执行模式声明（每个 sdlc 交付首部）

```markdown
## SDLC 执行模式
模式：<real-exec | planned-only>
cline probe：<版本号实测（只证可用） | 不可用（原因）>
启用依据（AND 双留痕）：<命中特征清单：多阶段依赖/release governance/migration/接口协同> **和** <授权指针：owner 指令/派单字段>
本任务 spawn 留痕：<real-exec：逐阶段命令+退出码+输出指针；多执行者独立性=逐执行者独立留痕 | 不适用（planned-only）>
本模式允许的宣称：<独立进程参与编排（以逐阶段 spawn 留痕为界） | 结构化阶段文档+单模型执行（只证明规划材料）>
```

## phase-plan.md

```markdown
# Phase: plan
输入：启用依据=<指针>；任务简报=<指针>
阶段分解：<阶段→产物→验收；与 YY 派单的边界声明（本资产不重派）>
验收（可观察）：AC1 <Given/When/Then 或可观察行为>
去向：develop 消费本文件 <字段清单>
```

## phase-develop.md

```markdown
# Phase: develop
输入：phase-plan.md=<指针；实际引用的字段>
实现：<变更清单；执行留痕=命令/输出/时间（real-exec）或 单模型执行声明（planned-only）>
自检：<对照 plan 验收逐条核对>
去向：review 消费 <…>
```

## phase-review.md

```markdown
# Phase: review
输入：phase-develop.md=<指针>；实现范围=<diff/文件清单>
peer 评审记录：<发现按七要素（位置/证据/复现/严重度/影响/修复边界/类别）；允许零发现>
结论：<通过/返工项清单>
```

## phase-summarize.md

```markdown
# Phase: summarize
阶段摘要：<各阶段一段>
supervisor 决断：<放行/驳回 + 理由 + 时间>
遗留清单：<移交 backlog 项>
```
