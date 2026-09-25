# D-3-RESIDUAL 派单 — drop 7 残留面 17 文件清理（与 HARDEN-1/PB-WRITEBACK 并行，写面不相交）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `test-reports/autopilot-work/AS-1/RESULTS.md` §D-3（17 文件残留面清单）与 `test-reports/autopilot-work/AS-1/s15-injection-result.log`。完成后交付证据，不自称 DONE。

## 任务：分类清理 drop 7 后的 17 处残留引用
S15-A1 已登记 17 文件（每文件含具体 drop 资产名）。**逐文件分类处置，禁止一刀切**：
- **类 A 死代码/孤儿脚本**（如 scripts/color-mix.mjs、color-palette.mjs、design-enhancer.mjs——colorize 专属增强脚本）：删除（先核实无其他活引用）；
- **类 B 活文档过时表述**（README.md、reference/asset-integration.md、reference/frontend-gate.md、reference/planning.md、templates/orchestration-frontend-backend.md、templates/task-agent-matrix.md）：最小 diff 更新（删 drop 资产相关段落/行，保留其余）；
- **类 C 历史/schema 语义保留**（contracts/asset-manifest-v2.md 的"行数随重组变化"声明、C-R3-review-checklist 历史单据）：**不改**——S15-A1 豁免口径是历史证据面，改了反而篡改；
- **类 D 配置残留**（CATALOG_IDS/ASSET_WHITELIST 类配置键、enhancement 孤儿配置）：删键（config.example.json 已被 AS-1 清理过两项，核对剩余）；
- 每文件处置标记 A/B/C/D + 理由，落 RESULTS。

## 边界与红线
- **templates/task-agent-matrix.md 与 S12 双向漂移门联动**（kickoff 清单）——改后必须跑 validate-structure 确认 S12 仍绿；
- **scripts/ 删除孤儿脚本后** node --check 全量 + preflight 必须全绿（若有活引用先断链再删）；
- governance-skills/、vendor/ 保留资产、governance 接线（GW-1 的 governance.mjs/orchestrator/runtime 接线段）、HARDEN-1 写面（regression-all/audit-index/FINAL-E2E 文档）——**零触碰**；
- 7 个 drop 资产名在**历史证据文件**（test-reports/、docs/history、CHANGELOG 类）中的出现一律保留。

## 自测（证据落 `test-reports/autopilot-work/D-3-RESIDUAL/`）
1. 处置分类表（17 文件逐个：类 A/B/C/D+理由+diff 摘要）；
2. 清理后 S15-A1 复跑：登记残留面列表缩短（仅剩类 C 豁免项）且仍 PASS；
3. 回归三件（regression 20 项/preflight 8/validate 0）全绿；
4. 被删孤儿脚本的"无活引用"核实命令+输出。

## 白名单
类 A/B/D 涉及的具体文件（README.md、reference/asset-integration.md、reference/frontend-gate.md、reference/planning.md、scripts/color-mix.mjs、scripts/color-palette.mjs、scripts/design-enhancer.mjs、scripts/di-container.mjs、scripts/lib/adapters/prompt.mjs（仅 drop 资产相关段）、scripts/lib/evolution.mjs（仅 drop 相关）、templates/ 两文件、config.example.json 如有残留键）、test-reports/autopilot-work/D-3-RESIDUAL/。

## 禁止
改 contracts/asset-manifest-v2.md、C-R3-review-checklist.md（类 C 豁免）、scripts/lib/runtime.mjs、scripts/lib/governance.mjs、scripts/manifest-build.mjs、governance-skills/、vendor/、webview/、SKILL.md、commands/、其他 plans/；禁 git。

## 验收要点
17 文件分类处置齐 + S15-A1 缩短仍 PASS + S12 绿 + 回归三件全绿 + 类 A 无活引用证明。