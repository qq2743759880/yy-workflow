# dev-planner-optimization P2 执行计划（GWT 任务拆解）

> 由编排者按 dev-planner 方法论拆解。前置：P0+P1 已交付（2 提交，回归 8/8）。
> 前提确认：本批为 PRD 剩余 P2 任务 + 全量验收 + 独立回归审查；P1 已完成，P2 无外部依赖、零新依赖。

| task | 标题 | 依赖 | GWT 验收摘要 |
|---|---|---|---|
| task01 | FR-204 plan-review.mjs 一键串评审脚本 | 无 | 当输入 dev-plan.md 时，顺序输出 CEO→Eng→Design 三阶段 review 提示（引用 plan-review-perspectives.md 对应段）并产出 plan-review-report.md，exit 0；模板缺失 → exit 1 |
| task02 | FR-303 design-doc 检索 + 修订链约定 | 无 | 当 dev-planner Step 0 执行时，grep `docs/designs/*.md` 关键词命中既有 design doc 并提示 build-on/start-fresh；design-doc.md 模板 Supersedes 已含修订链说明 |
| task03 | 新模板同步验证 | task01, task02 | 当 `node scripts/sync.mjs --dry-run` 运行时，templates/ 全部文件（含 3 新模板）出现在渲染清单，无报错 |
| task04 | 全量验收（PRD §7） | task01-03 | 当跑 §7.2 命令集时，validate-structure / review-gate --self-test / --plan / regression-all 全 exit 0 |
| task05 | 独立回归审查（独立子 agent） | task01-04 | 当独立测试 agent 审查时，回归 8/8、新脚本/模板可移植、无假成功、FFFD 0 |

## 执行顺序
task01 → task02 → task03 → task04 → task05（串行；task05 最后为总闸门）
