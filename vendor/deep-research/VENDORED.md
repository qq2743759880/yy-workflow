# VENDORED — dzhng/deep-research

| 字段 | 值 |
|---|---|
| repo | https://github.com/dzhng/deep-research |
| commit hash | `1f8f3e285bbc23e80b98a66a64effab9069f3ad4` |
| commit 日期 | 2026-04-11T23:58:21Z（浅克隆 HEAD，实测经 api.github.com /repos/.../commits 交叉核对一致） |
| license | MIT（仓库 LICENSE 文件：Copyright (c) 2025 David Zhang；GitHub API license.spdx_id=MIT 一致） |
| 星标 | 19,717（2026-09-23 实测 api.github.com /search/repositories?q=deep-research+user:dzhng） |
| clone 方式 | `git clone --depth 1`（2026-09-23，网络实测可达；WebSearch 不可用不影响 clone/npm/gh api） |
| vendor 范围 | 全量整仓库（src/ deep-research.ts 循环内核 + run.ts + prompt.ts + feedback.ts + ai/providers.ts），node_modules 为本地 `npm install` 产物（探针运行依赖），非 vendor 提交物 |
| 引入依据 | execution-plan-v3-20260923.md §四「dzhng/deep-research 19.7k★ 全量 vendor」；GPT-Researcher(29.6k★, apache-2.0)/STORM(stanford-oval/storm 31.5k★, mit) 按 §四 不引入 |
| 胶水纪律 | 禁止改 vendored 文件；只允许 `scripts/research-gate.mjs` ≤150 行胶水调其 `deepResearch` 循环 |
| 内核 API | `import dr from './src/deep-research.ts'` → `dr.deepResearch({query,breadth,depth,learnings,visitedUrls,onProgress})` / `dr.writeFinalReport` / `dr.writeFinalAnswer`（tsx 运行时经 default 命名空间导出） |
| 探针证据 | `node_modules/.bin/tsx probe → {"moduleLoaded":true,"exportsOk":true,"loopEntered":true,"errorName":"Error","errorMessage":"No model found"}` exit 0 —— 无 API key 时循环体真实执行至 `generateSerpQueries → getModel` 边界抛「No model found」，证明内核真跑而非复述（探针脚本见 test-reports/autopilot-work/RG-1/RESULTS.md §A） |
| 升级纪律 | 季更：git pull + 探针重跑 + 回归全绿才换 pin（本文件记 pin 历史） |
| pin 历史 | 2026-09-23 首次 vendor @ 1f8f3e2（RG-1） |

## 入库方式（2026-09-23 修订）
- 初次提交曾被 git 识别为嵌套仓库（gitlink 指针，克隆者拿不到源码）——已剥除内嵌 .git 目录，按普通文件快照重新入库。
- node_modules 不入库（package.json/package-lock.json 在场，`npm install` 可复原探针运行依赖）。
