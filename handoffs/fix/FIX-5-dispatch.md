# FIX-5 派单 — T9 runner 沙箱修剪策略统一（保留数入常量）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。完成后交付证据，不自称 DONE。

## 任务
`test-reports/rebuild-20260920/T9-wizard/run-probes.mjs` 的沙箱修剪已存在但保留数硬编码（第 281-285 行附近：`只保留最近 5 个 run-*`，字面量 5 内联在 IIFE 里）。

1. 保留数提为文件头命名常量（如 `const RETAIN_RUNS = 5`），注释说明策略（跑完不清理留证 + 只保留最近 N 个防爆盘）。
2. 修剪逻辑审计加固：按 mtime/名字排序取最新 N 个的判定要稳健（run-<stamp>-<pid> 命名），非 run-* 前缀的目录/文件**不动**（留证纪律）；修剪失败静默降级（已有 .catch(() => {}) 语义保持）。
3. 白名单仅 `test-reports/rebuild-20260920/T9-wizard/` 目录内文件——其他 runner 不在本任务范围（不统一改，只统一本 runner 策略并使常量显式化）。

## 自测（必须，证据落 `test-reports/rebuild-20260920/T9-wizard/` 下 RESULTS-FIX5.md）
1. 连跑 3 轮 `node test-reports/rebuild-20260920/T9-wizard/run-probes.mjs`：全 PASS 且每轮后 `.sandbox/` 下 run-* 目录数 ≤ 保留数（不增）。逐轮目录计数记录。
2. 手工塞入 2 个假旧 run-* 目录（命名合规如 run-20260101T000000Z-1）→ 再跑一轮 → 假目录被修剪进最旧淘汰，本轮 run-* 保留。塞入/清理动作如实登记。
3. 非 run-* 文件（如随手放个 keep.txt）→ 跑完仍在（留证纪律未误伤）。
4. RESULTS-FIX5.md：逐项证据 + D-xxx 偏差；测完假目录/假文件删净。

## 禁止
改其他 scripts/、SKILL.md、commands/、webview/、contracts/、plans/、队列/看板；读 test-reports/acceptance-*/；git 操作。

## 验收要点（编排者 L2 将复核）
连跑 3 轮沙箱目录数不增；保留数入常量；非 run-* 留证不误伤。
