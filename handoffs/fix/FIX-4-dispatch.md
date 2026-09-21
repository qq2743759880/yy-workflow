# FIX-4 派单 — T9 遗留：--validate-handoff 冒号列表加固（写面区 C）

你是本任务的独立执行 agent（autopilot 管线 L1）。工作区：`D:\.ai-hub\skills\yy`。
完成后交付证据，不自称 DONE。

## 任务
`scripts/summary-read.mjs` 的 `--validate-handoff` 对正文"冒号列表项"（如 `说明: xxx` 行）
可能误判为 key。加固：三必填字段（taskId/taskVerdict/evidencePaths）判定不受正文冒号行干扰。
修法自选（如限定字段扫描区/字段白名单前缀），行为约束：**三必填齐→PASS、缺→FAIL(1)、
目录缺失→FAIL(1) 语义零变化**。

## 白名单
`scripts/summary-read.mjs` + 自测目录 `test-reports/autopilot-work/FIX-4/`。

## 自测（必须）
- 正向：含冒号列表正文的合法报告 → PASS
- 负向：正文含 `foo: bar` 但缺三必填 → FAIL(1)；三必填字段误拼（taskid 小写）→ FAIL(1)
- 既有模式回归：--help/空 workspace/列表行为不变
- RESULTS.md：修法说明 + 输出原样 + D-xxx 偏差

## 禁止
改其他脚本、webview/、contracts/、队列/看板；读 test-reports/acceptance-*/；git 操作。

