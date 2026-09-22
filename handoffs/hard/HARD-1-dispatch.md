# HARD-1 派单 — junction-smoke 并入回归入口（SKIP 语义）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。完成后交付证据，不自称 DONE。

## 任务
把 `test-reports/fix-20260921/junction-smoke.mjs` 作为新段（建议 S13）并入 `scripts/regression-all.mjs` 回归入口。

现状事实（编排者实测）：
- `junction-smoke.mjs` 已有 SKIP 语义雏形：junction 缺失时对"junction 安装形态存在"断言记 SKIP（见其 21 行注释）；但它是独立脚本、退出码/计数体系与 regression-all 的段结构不同。
- `regression-all.mjs` 是 S1–S12 顺序断言段结构，任一 FAIL → exit 1；段定义在文件头部注释。

## 约束
- 白名单：`scripts/regression-all.mjs`、`test-reports/fix-20260921/`（junction-smoke.mjs 允许小改为可被 regression-all 复用的形态）。
- 无 junction 时：该段记 **SKIP**（显式打印，不 FAIL 不 PASS），整套回归照常 exit 0——验收口径 `12/12 + 1 skip`（S1-S12 计数语义按现有体系保持，skip 不进 FAIL）。
- 有 junction 时（本机现状，先 `cmd //c dir C:\Users\Administrator\.agents\skills` 确认 junction 是否在场）：全绿且 smoke 真实执行。
- 不得改动 S1–S12 既有断言语义；不得改其他 scripts/。

## 自测（必须，证据落 `test-reports/autopilot-work/HARD-1/`）
1. 本机现状（junction 在场）：`node scripts/regression-all.mjs` 全绿，S13 真实执行。
2. 删 junction 模拟：临时改探测路径（或用环境变量注入假路径）使 junction 探测为缺失 → 整套仍全绿 + 1 SKIP，exit 0。模拟手段必须在 RESULTS.md 里如实登记（不许真删用户的 junction；如确需临时删，先确认 junction 指向并事后完整恢复，且登记 D-偏差）。
3. RESULTS.md：逐项 PASS/FAIL + 命令输出原文 + D-xxx 偏差。

## 禁止
改 SKILL.md、commands/、webview/、contracts/、plans/、队列/看板、其他 scripts/；读 test-reports/acceptance-*/；git 操作。

## 验收要点（编排者 L2 将复核）
本机全绿；无 junction 场景整套仍全绿 + 1 skip；S1-S12 零回归。
