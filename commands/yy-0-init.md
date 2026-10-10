---
name: yy-0-init
description: 阶段 0 立项/资产整合。触发词「/yy 0」「注入阶段 0 prompt」「立项」「资产整合」。
journey-step: 0
prereq-gates: []
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy 0" --subtask-id <id> --save` 展示包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" check --workspace "$PROJECT_ROOT" --session <session> --subtask-id <id>`，通过后做原生工作。session 边界见接口指针。

## 阶段 0 · 立项 / 资产整合

**目标**：一句话定边界，盘点资产与平台，只做需求澄清 + 概念版，不拆任务不写代码。

**产物路径**：`docs/`（PRD/设计规范/技术架构/选型审计/任务总纲）；`node "$SKILL_DIR/scripts/detect-platforms.mjs" --json` 只读输出，按需将 platforms 保存到项目 `config.json`。

**边界**：方向由 owner 给定；保留已实施产物，不以起点、frontmatter 或已有 journey 快照自行放行。

**指针**：宿主准入见 `reference/decision-interface.md`；产物方法见 `reference/asset-integration.md`、`reference/variables-and-config.md`。
