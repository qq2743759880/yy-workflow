# Batch 2 派发计划（2026-09-26，批 1 CLOSED 后启动）

> 前置：批 1 CLOSED（migration boundary CONFIRMED + 治理机器四件套 + 治理层接线）。
> 本批核心：**Prompt Compiler（capability dispatch 完整形态）** + 审计者两轮遗留项。

## 任务清单

| id | 任务 | 内容 | 白名单 | 依赖 |
|---|---|---|---|---|
| **PC-1** | Prompt Compiler v1 | `scripts/lib/prompt-composer.mjs`：输入 {task, capability(manifest), project_context, constraints} → Role/Mission/Context/Output Contract/Constraints/Verification 六段 brief；消费 manifest v2 三字段（capability/when_to_use/verification）——治理注入（GW-1）叠加其上 | scripts/lib/prompt-composer.mjs（新建）、scripts/orchestrator.mjs（brief 组装切换，最小 diff）、test-reports/autopilot-work/PC-1/ | 批 1 |
| **CD-1** | capability dispatch 完整形态 | runtime dispatch 输入升级：`{capability, constraints}` → registry → eligibility resolver → candidate assets → adapter（asset name 降为内部解析产物）；探针证明 security 任务按 capability 命中 semgrep adapter | scripts/lib/runtime.mjs、scripts/lib/activation.mjs、test-reports/autopilot-work/CD-1/ | PC-1 |
| **GV-2** | governance 消费升级 | 治理技能注入从"brief 尾巴拼接"升级为 Prompt Composer 的 governance 段（与 PC-1 同一管道）；systematic-debugging 在 migration/gate 失败时注入 composer 而非指路行 | scripts/lib/governance.mjs、scripts/lib/prompt-composer.mjs | PC-1 |
| **R-2** | package.json 名义依赖清理 | culori/chroma-js/poline/tsyringe/inversify/cockatiel/polly-js 七项孤儿依赖删除（node_modules + lock 重生成 + 回归三件） | package.json、package-lock.json | — |
| **MG-1** | sentinel 多 agent 分析器（可选） | API key 接入后 skill-scanner 多 agent 深扫（Owner 提供 key 时执行；无 key 则 backlog） | scripts/lib/adapters/skill-scanner.mjs（最小） | Owner key |
| **E-4-EXEC** | llm 模式行为面（可选） | kernel 门 vs 诚实 LLM 张力的实测口径（gpt-5.6-sol 真实宿主复跑 FINAL-E2E --host-mode=llm） | test-reports/autopilot-work/E-4-EXEC/ | Owner 拍板执行时机 |

## 执行波次

- **第一波（并行，写面不相交）**：PC-1 + R-2
- **第二波（串行）**：CD-1（依赖 PC-1 的 composer 形态）→ GV-2（同管道）
- **第三波**：FINAL-E2E v2 复跑（composer/dispatch 全新链）+ 批 2 收口报告
- MG-1 / E-4-EXEC：按 Owner 资源可用性插入

## 批 2 验收口径（预定义）

- production 主链（composer→dispatch→adapter→receipt）在 mech 与 llm 双模式各有至少一次完整验证（llm 依赖 E-4 裁定与 key）
- 治理注入经 composer 管道（非拼尾巴）且三技能激活语义与 Owner 冻结绑定逐字一致
- capability dispatch 探针：同一 capability 多候选时 resolver 决策可审计
- 全部门禁（regression 24+ / preflight 8 / validate 0 / audit-index selftest）持续全绿