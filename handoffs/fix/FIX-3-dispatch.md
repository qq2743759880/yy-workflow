# FIX-3 派单 — validate 断言解耦 + P5 探针确定性修复（写面区 B+C）

你是本任务的独立执行 agent（autopilot 管线 L1，全新上下文）。工作区：`D:\.ai-hub\skills\yy`。
完成后交付证据，不自称 DONE。

## 任务 A（坑#7）：validate-structure 的 expectedRefs 硬编码解耦
`scripts/validate-structure.mjs` 的 H6 断言硬编码 10 个 reference 文件名（L335-341）——
删一个 reference 文件需要同时改断言（渐进披露反而增改造成本，坑#7）。
修法自选（从 SKILL.md §分层协议表派生 / 独立清单文件单一事实源），约束：
- H6a/H6b 断言语义保持（reference 齐备 + SKILL.md 指针覆盖）
- 删一个 reference 文件不再需要改 validate-structure（用临时文件实测）
- 既有 13 断言其余项零回归

## 任务 B（P1）：FIX-2 的 P5 探针确定性修复
`test-reports/autopilot-work/FIX-2/run-probes.mjs` 的 P5 断言 `modes.exec>0` 依赖模型拆解
出带 asset 的子任务（模型行为，编排者复跑 3 连挂）。改为确定性断言：
映射日志（`--exec from executor.json`）+ 注入命令形态（resolveCommandShim 输出含 opencode.cmd）
+ isolate warning——删除 modes.exec 断言（它验证的是模型行为不是接线）。

## 白名单
`scripts/validate-structure.mjs`、`test-reports/autopilot-work/FIX-2/run-probes.mjs`（仅 P5 断言）、
自测目录 `test-reports/autopilot-work/FIX-3/`。

## 自测（必须）
- 任务 A：临时复制一个假 reference 进/出 → validate 不需要改断言即正确报/不报
- 任务 B：run-probes 12/12 连跑 3 次全 PASS（P5 确定性验证）
- regression 12/12 + validate 0 + R10 12/12
- RESULTS.md + D-xxx 偏差

## 禁止
改 SKILL.md、commands/、webview/、contracts/、队列/看板；读 test-reports/acceptance-*/；git 操作。

