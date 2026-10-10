---
name: yy-research
description: 需求签收后的研究门。触发词「/yy research」「研究门」「竞品研究」。
journey-step: 1.5
prereq-gates: [step1, concept-signed]
---

> 首行指令：先跑 `node "$SKILL_DIR/scripts/host-adapter.mjs" prepare --workspace "$PROJECT_ROOT" --session <session> --intent "/yy research" --subtask-id <id> --save` 展示包，仅 `ok=true` 且 `data.execution_permitted=true` 继续。再跑 `host-adapter.mjs check`（同 workspace/session/id），通过后原生研究；参数见 `reference/decision-interface.md`。

目标：用真实来源查已有方案和竞品差距。产物 `docs/prior-art.md`、`docs/market.md` 格式按 verifyPriorArt/verifyMarket，禁止编造 URL/引文。

产物完成跑 `node "$SKILL_DIR/scripts/research-gate.mjs" --workspace "$PROJECT_ROOT"`；exit 0 后才跑 `node "$SKILL_DIR/scripts/tt-journey.mjs" --workspace "$PROJECT_ROOT" --session <session> --update --step 1.5 --gate research-done --artifact docs/prior-art.md`。

下一步 `/yy 2` 仍须 adapter 准入。

源全不可达则阻断；离线例外须用户明确接受风险，用 `--allow-offline --approved-by` 留痕，禁止自填批准人。
