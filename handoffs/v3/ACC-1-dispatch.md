# ACC-1 派单 — Acceptance Reconciliation（Batch 3 Wave 1，文档/治理面）

- **current revision**: `c599f7b`；working tree clean。
- **Evidence Boundary**: 编排者亲验——`plans/batch2-dispatch-plan-20260926.md` §验收口径三条原文（直读）；MG-1/E-4-EXEC 在任务表内标注为「Owner 提供 key 时执行/无 key 则 backlog」「Owner 拍板执行时机」；`grep -c capability scripts/lib/planner.mjs`=0。交接文档降级 ADVISORY。
- **目标**: 出一份 **Batch 2 Acceptance Reconciliation**，对三条验收口径逐条裁定「已满足/条件未满足/未闭环」，并给出后续归属；补正 closeout 的表述遗漏。
- **非目标**: 不改任何生产代码；不重开 Batch 2 整改；不把 owner-resource 项伪装成缺陷。
- **dependency**: 无。
- **allowed write face**: `plans/batch2-acceptance-reconciliation-20260926.md`（新建）。
- **forbidden write face**: `plans/` 其他文件（**含 ledger——ledger 行由编排者写**）、`contracts/`、`scripts/`、`docs/` 两份交接文档、`test-reports/`。
- **frozen-contract impact**: 无（纯文档，不触 contracts/）。
- **production caller / authority**: 无（文档面）。
- **positive probe**: 三条口径逐条有裁定 + 引原文 + 引实测证据（planner grep / package.json grep / CAPABILITY_MAP 直读）。
- **negative probe**: 若某条裁定「已满足」，必须给出该条的证据指针；无证据 → 不得判满足。
- **counterexample**: 若认为「closeout 表述无遗漏」——请指出第 3 条（多候选）在 closeout 何处被显式列为未闭环。
- **failure semantics**: 无运行时语义（文档）。
- **rollback/compat**: 新增文件，零兼容影响。
- **regression**: 文档面不触门禁，但须实测证明（跑一次 regression/preflight/validate 全绿）——证明"文档改动零归因"。
- **evidence path**: 本文件自身。
- **stop condition**: 若裁定需要改契约/验收契约本身 → 停止，报编排者走 Owner ruling。

## 裁定要点（编排者预判，供你独立核验后采纳/推翻）
1. **口径①（mech+llm 双模式）**：plan 原文括号自带条件条款「llm 依赖 E-4 裁定与 key」+ 任务表标 E-4-EXEC 为 Owner 资源项 → **条件未满足，非工程缺陷**；裁定 = Batch 2 在 mech 侧满足、llm 侧转 Owner-resource-gated（不阻塞批次推进）。
2. **口径②（治理逐字一致）**：CD-1+GV-2 已实证（插槽位置 + 两键匹配冻结集）→ **已满足**（引 CD-1-GV2 探针 GV2-5b/d）。
3. **口径③（多候选可审计）**：CAPABILITY_MAP 是受控单值映射，**无多候选形态** → **未闭环**；且编排者判定「当前无真实多候选需求」→ 裁定 = 降级为「规则先冻结、无需求不实施」，并在本文档显式登记为**计划口径的修订**（而非执行缺陷）。
4. **MG-1**：optional backlog（plan 原文）。**E-4-EXEC**：Owner 拍板时机。

请独立核验以上四条预判（尤其第 1/3 条的 plan 原文引用），采纳或推翻并给证据。