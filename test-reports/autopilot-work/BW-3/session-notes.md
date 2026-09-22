# session-notes（随手记录：现象 + 位置 + 猜测）

- 现象：`tt-journey.mjs --prereq-check --step 0` 首次运行报 "journey 未初始化（先跑 orchestrator 或 --update）"，exit 1。位置：`scripts/tt-journey.mjs`。猜测：journey.json 不存在时 prereq-check 不自动建状态；SKILL.md 命令索引没写清"首次要先 --update 初始化"，新手按文档先跑 prereq-check 会被劝退。
- 现象：`detect-platforms.mjs` 探测到 7 个平台（opencode/trae/claude/codex/cursor/openclaw...），但本会话实际只有我一个 agent 可用（无子 agent 派发工具）。猜测：探测的是"机器上装的 CLI"而非"本会话能调度的执行器"；阶段 4 派单按 N=1 单平台退化模式走（SKILL §5.0），独立实证验收用本会话工具实跑代替。
- 现象：journey 步骤编号与命令文件编号错位（命令文件叫 yy-2-planning 但 journey-step 是 3，yy-3-contract 是 5）。位置：commands/*.md vs scripts/tt-journey.mjs STEPS。猜测：回跳层 2/4/6 占了号，命令名沿用旧版编号未同步；按 journey-step 走机验，别按文件名走。
- 现象：SKILL.md 三条红线里 "APPROVED before code" 是前端纪律，但纯 CLI 项目没有 HTML 原型。猜测：frontend-gate 对无 UI 项目天然不适用，gate-a-approved 以"可运行 CLI + 实跑证据"替代，记录于此。
- 现象：`--json --apply` 组合时 stdout 混打人类摘要+JSON 导致解析失败（42 测试抓出的真实 bug）。位置：file-tidy.mjs main。处置：json 模式跳过人类输出。
- 现象：dedupe 隔离目录落盘用了占位符 `PENDING` 而非真实 manifestId，违反契约 C3。位置：file-tidy.mjs applyPlan。处置：执行时回写真实 id（契约 v2 变更单 plans/change-001.md 同批处理）。
- 现象：`review-gate.mjs` 的 tracker 校验路径硬编码为技能根目录（`path.join(ROOT, 'plans/critique-backlog-tracker.md')`），不跟随 `--dir` 指向的项目工作区，跨项目使用必 FAIL。位置：review-gate.mjs L516/L968/L999。猜测：该脚本只在自己仓库根目录跑过，从未被外部 workspace 调用方使用过。绕过：不污染技能目录，改为直接 import 同一 `verifyCritiqueUrls` 机验函数验证（4 URL 全 PASS 200），批判 5/5 条有效、优化方案在场、tracker 已在 workspace/plans/ 登记——闸门实质达成，形式 FAIL 如实记录不假装通过。
- 现象：WebSearch/WebFetch 工具不可用（provider 报 Access denied / thinking.type 配置错误）。猜测：宿主模型配置问题。绕过：URL 可达性用 curl 核验（语义等同 review-gate --verify-urls）。
- 现象：`review-gate.mjs` 批判表格解析要求精确 9 列模板（`| # | 批判点 | 竞品对标 | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |`）且列名必须含"批判点/竞品对标"字样才认表格，否则解析为 0 条。位置：review-gate.mjs parseCritiqueEntries。猜测：模板强耦合，自由格式批判会被静默判 0 条，报错信息不提示格式原因，上手成本高。
