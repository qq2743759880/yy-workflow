# task C-2 · ci.mjs 一键回归卡点

> 执行者：子 agent B。验收者：独立测试 agent。

## 目标
一键回归卡点：validate + review-gate + plan-review + regression-all 顺序跑，任一 fail exit 1。供 CI/人工统一触发。

## 改动
新增 `scripts/ci.mjs`（零依赖，node ≥18，复用 node:child_process）：
1. `node scripts/validate-structure.mjs` → exit 0 过
2. `node scripts/review-gate.mjs --self-test` → exit 0 过
3. `node scripts/plan-review.mjs --check <临时填好报告>` → 应 exit 0（用临时文件；或跳过 plan-review 若过度——见下）
4. `node scripts/regression-all.mjs` → exit 0 过
5. 任一失败 → 输出失败段 + exit 1；全过 → "CI PASS"

**简化**：plan-review --check 需要填好报告，ci.mjs 可用临时文件构造一个最小通过报告（锚点+处置），或跳过 3（若过度）。选择保留则构造临时样例。

## GWT
- Given 干净树；When `node scripts/ci.mjs`；Then 顺序跑出各段 PASS，最终 exit 0
- Given 注入破坏（如临时改坏某脚本？只读不可）；Then 以回归不通过场景为准——ci.mjs 任一子命令 fail → exit 1（可临时让 regression 挂验证，测完恢复）

## 纪律
- 只新增 `scripts/ci.mjs`；不碰其它文件；不改既有脚本行为
- 自测 exit 0 通过；报告输出
