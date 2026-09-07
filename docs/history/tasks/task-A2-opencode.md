# task A2 · implementation→opencode 实跑

## 目标
验证已部署 opencode 1.18.25 作为 orchestrator `--exec` 宿主真实执行（非仅 `--version`）。

## 执行
1. 确认 opencode 非交互调用方式（`opencode run ...` 等，参考 `opencode --help`）
2. 跑：`node scripts/orchestrator.mjs --task "实现一个加法函数" --exec opencode run`（cwd=TT 仓库，workspace 用临时目录避免污染）
3. 检查：子任务 mode=exec 且产物真实（非仅 brief）

## GWT
- Given opencode 已装；When orchestrator --exec opencode；Then 子任务真实执行、mode=exec、产物含方案

## 产出
验证报告：执行命令 + state.json modes/assetConsumed + 产物样例，写 `.claude/specs/tasks/reports/A2-report.md`
