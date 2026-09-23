# LS-1 派单 — lessons.md 工作区级半采纳（批 0 补派）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §四 LS-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务：工作区级 lessons.md（批判反哺的落盘格式，不是新记忆层）
1. **schema**：`<workspace>/.tt-state/lessons.md`，条目格式强制：`L-<n> | 日期 | 来源批判条目 id | 条件（何时适用） | 教训 | 验证状态`。
2. **写入纪律（生死线）**：只有**阶段 8 批判 gate PASS 的条目**可落盘——写入接口必须校验来源批判条目在 `plans/critique-backlog-tracker.md` 中存在且 status 为 accepted/converted；无批判产物/伪造批判 id 调用写入 → **拒绝（fail-closed）**，detail 指名"无有效批判来源"。
3. **生命周期**：journey init 时创建空文件；归档随 journey 终态；`--session` 隔离（a 会话写的 lessons 不出现在 b）。
4. **消费点**：`tt-journey --prereq-check` 输出一行提示"本工作区有 N 条已验证教训"（只提示不注入正文，防 prompt 膨胀）。

## 白名单
`scripts/blindqueue.mjs` 旁边的独立新脚本 `scripts/lessons.mjs`（CLI：--init/--append/--list/--count，全部带 --workspace）；如需 prereq-check 提示行，**只允许在 `scripts/tt-journey.mjs` 的 prereq-check 输出段追加 ≤10 行**（RG-1 已完成其写面，无并行冲突）。

## 自测（证据落 `test-reports/autopilot-work/LS-1/`）
1. 有效批判来源 → --append 成功落盘；无来源/伪造 id → 拒绝且 detail 指名（fail-closed 生死线探针）；
2. --session 隔离：a 写的条目 b 的 --list 看不到；
3. prereq-check 提示行：有 lessons 时输出 N 条提示，无 lessons 时不输出；
4. 回归一次：regression 13/13 + validate 0。

## 禁止
改 SKILL.md/commands/webview/contracts/reference/plans/其他 scripts；禁 git；禁跑 BFX/FE 历史回归目录。

## 验收要点（编排者 L2 将复核）
fail-closed 写入（伪造拒绝）是本单生死线；--session 隔离；回归全绿。