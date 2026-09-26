# Independent Auditor Handoff — yy / Batch 2 后续（2026-09-26）

> 身份边界：本文由独立审计者生成，只是**开工建议与风险假设**，不是项目 truth、不是 Owner 裁定、不是新的冻结契约。  
> 编排者必须先独立读取当前仓库、测试、change record、runtime caller，再决定采纳 / 修正 / 拒绝本文。  
> 若本文与当前 revision 的 MCP / Git / 文件证据冲突，以当前仓库证据为准，并在新派单中说明拒绝理由。  
> 禁止把“审计者建议”直接升级为任务事实；禁止因为本文存在就跳过 Ground Truth Reconciliation。

## 1. 本次审计者可见范围

当前通过 local MCP 独立确认的快照：

- project: `yy`
- branch: `main`
- HEAD: `c599f7b`
- working tree: clean
- Batch 1 已有正式 CLOSED 提交。
- Batch 2 已入库：PC-1、R-2、CD-1+GV-2、FINAL-E2E v2。
- 当前 ledger/closeout 自身把 Batch 2 写成：**主体 CONFIRMED，完全收口 PARTIALLY CONFIRMED**。
- 本次只读取了部分高价值文件，不代表完整项目扫描。

重点读面：

- `plans/batch2-dispatch-plan-20260926.md`
- `plans/autopilot-ledger-20260921.md`
- `scripts/lib/prompt-composer.mjs`
- `scripts/lib/activation.mjs`
- `scripts/lib/runtime.mjs`
- `scripts/lib/governance.mjs`
- `scripts/lib/migration.mjs`
- `scripts/lib/signoff-canonical.mjs`
- `scripts/lib/adapters/security-semgrep.mjs`
- `contracts/asset-manifest-v2.json`
- `contracts/manifest-sources/security.yaml`
- `test-reports/autopilot-work/PC-1/RESULTS.md`
- `test-reports/autopilot-work/CD-1-GV2/RESULTS.md`
- `test-reports/autopilot-work/FINAL-E2E/RESULTS.md`
- `test-reports/autopilot-work/R-2/RESULTS.md`
- `package.json` / package-lock 中 spectral 引用检索

## 2. 已验证事实（可作为开工起点，但仍应在新 revision 重读）

### 2.1 Batch 2 验收口径与当前 closeout 存在明确边界差

原 Batch 2 派发计划预定义：

- production 主链在 mech 与 llm 双模式各至少一次完整验证；
- capability dispatch 同一 capability 多候选时，resolver 决策可审计。

当前 closeout/RESULTS 则明确：

- FINAL-E2E v2 完成的是 mech / Runtime Boundary；
- LLM 行为面仍在 E-4-EXEC；
- CAPABILITY_MAP 目前是受控 key → 单一 manifest id；
- CD-1 RESULTS 自报：生产 orchestrator/planner 尚无 capability 字段入口，capability E2E 的记录侧由生产 `runtime.dispatch` 直接触发；
- 多候选“评分择优”没有实现，当前是保守唯一映射。

因此编排者下一步首先需要裁定：

1. 保持 Batch 2 = PARTIALLY CONFIRMED，继续后续批次；
2. 或修改/补充验收契约；
3. 或补做 E-4-EXEC / capability planner ingress 后再完全 close。

不能把三者混写成“原验收全部已经满足”。

### 2.2 capability dispatch 已进入 runtime，但还不是完整的 planner→capability 入口

当前 `activation.mjs` 有受控 `CAPABILITY_MAP`；`runtime.dispatch` 能消费 `subtask.capability` 并解析为 asset。

但 CD-1 RESULTS 自身承认：生产 orchestrator 的 planner 侧还没有 capability 字段入口。

所以“asset name 降为内部产物”目前应理解为**runtime 接口能力已具备**，而不是“从用户任务 / planner 到 runtime 的主键已经完全 capability-native”。

若要继续做这一层，应先沿真实调用链核：

`planner -> orchestrator plan schema -> subtask shape -> activation resolver -> runtime.dispatch -> adapter`

不要只对 runtime 单点继续加探针。

### 2.3 当前多候选 resolver 语义还没有真正实现

`CAPABILITY_MAP` 是受控精确映射，10 个 capability key → 9 个 asset id。  
这能避免模糊语义匹配，是合理的 fail-closed 起点。

但它不等于：

“一个 capability 对多个 eligible candidate，经 when_to_use / constraints / verification 等规则确定性择优”。

原 Batch 2 验收文案包含“同一 capability 多候选时 resolver 决策可审计”。当前报告已把真正评分择优留到后续。

建议：若未来做 Batch 3，不要直接做 embedding/LLM 模糊选择；先设计确定性的 candidate contract、排序字段、拒绝原因、tie-break 与证据结构。

### 2.4 security manifest source 可能已经语义陈旧

当前生产 adapter `security-semgrep.mjs` 的能力边界已经是：

- 显式非 Python 文件 → `SCOPE_LANGUAGE_UNSUPPORTED`
- 纯非 Python 目录 → 拒绝
- Python + 其它语言混合目录 → semgrep 真扫，但 `pass=false` 并列出 `UNCOVERED_LANGUAGES`

但当前 `contracts/manifest-sources/security.yaml` 与生成的 `asset-manifest-v2.json` 仍包含旧描述：

“目录目标放行（目录内 .py 生效；0 findings 属真实扫描结果如实记录，REMEDIATION-1）”。

这与 F-019 后的现行 adapter 语义不一致。

这是**审计假设**，不是直接修改指令。编排者应先核：

- source-of-truth 到底是 sidecar、vendor、migration deviation 还是 adapter contract；
- manifest 是否应重建；
- 是否已有 semantic freshness 门；
- 更新会不会触及冻结 schema/receipt 或 manifest hash 绑定。

若确认 stale，应从 source 修，不要直接手改生成 JSON。

### 2.5 spectral 生产依赖仍存在可重复安装风险

R-2 已实证：`@stoplight/spectral-cli` 历史上通过 `--no-save` 安装，`npm prune` 将其当 extraneous 删除，S15-A2/S16-2 当场抓到。

当前：

- `package.json` 没有 spectral；
- package-lock 检索不到 `@stoplight/spectral-cli`；
- be-validator PRIMARY runtime 仍依赖 spectral CLI。

因此当前“恢复可用”不等于“干净机器可重建”。

编排者需要独立裁决生产工具依赖策略，例如：

- 正式依赖 / optional dependency；
- 独立 bootstrap + 版本锁 + preflight；
- vendor/toolchain cache；
- 其它可审计方案。

不要为了方便直接选某一种；先检查包体积、许可、部署目标、Windows/Unix 兼容、CI 与发布形态。

### 2.6 reflect-metadata / tslib 仍是未裁决名义依赖

R-2 只授权删除七项；`reflect-metadata` 与 `tslib` 因超出授权被保留。  
当前是否真孤儿，需要重新做 import/runtime/build 检索后再裁定，不能沿用“看起来没引用”直接删。

### 2.7 MG-1 / E-4-EXEC 是资源依赖，不应被偷偷改写成“已完成”

当前仓库明确将：

- MG-1：需要 Owner/API key；
- E-4-EXEC：需要真实 LLM host / 执行时机裁定；

作为完全收口的剩余边界。

若没有资源，就继续保持 PARTIALLY CONFIRMED；不要用 mech probe 替代真实 LLM 行为结论。

## 3. 建议编排者优先形成的独立判断

开工前先写一个短的 Ground Truth Reconciliation，逐条回答：

1. 当前 HEAD 是否仍为本文件记录的 revision？若不是，本文件全部降为历史建议。
2. Batch 2 的“完全 close”到底以哪个验收契约为权威？原 dispatch plan、后续 Owner ruling、还是新的 amendment？
3. capability-native 的目标到底是 runtime API，还是 planner→runtime 全链？边界要冻结。
4. 多候选是 Batch 2 未完成项、Batch 3 新能力，还是明确不做？必须选一个口径。
5. security manifest 的旧目录语义是否真实 stale？若是，source-of-truth 与重建路径是什么？
6. spectral 的可重建性是否属于 release blocker？用什么部署环境证明？
7. MG-1/E-4-EXEC 没资源时，允许推进哪些不依赖任务，哪些 close claim 必须继续冻结？

## 4. 我建议的下一阶段原则（可拒绝）

- 不要继续用“测试 PASS 数量”替代 authority / caller / consumer 闭环。
- 每个新 gate 必须证明它打在**生产函数**而不是 test oracle。
- 每次从 asset-name 向 capability 迁移，都要同时检查：输入 schema、planner、resolver、runtime、receipt、failure memory、E2E。
- manifest / audit-index / receipt 这类“指针层”要有 semantic freshness，不只检查路径存在。
- 所有并行单先声明 write face；发现额外必要写面时先 amendment，再修改。
- 对外部执行内核必须把“当前机器可用”与“干净环境可重建”分开验收。
- 任何 Owner/resource pending 项都不得被自动降级成“非阻塞=已完成”。

## 5. 停止条件

遇到以下任一条件，编排者应暂停对应派单并重新规划：

- 当前代码与本文建议相反；
- 需要修改冻结 contract 但没有合法 change/receipt；
- 需要修改未授权写面；
- 需要 Owner key / LLM host，却打算用 mock 代替并声称行为面完成；
- 发现 planner/capability schema 并不是当前真正入口；
- 某个“修复”只能写 test oracle，生产没有对应 authority；
- manifest/source/adapter 三者语义冲突但 source-of-truth 尚未确定。

## 6. 审计者角色声明

我没有完整读取 1300+ 文件，也没有拥有编排者的完整会话、Owner 决策链和所有历史上下文。本文的价值是：

- 给出高价值搜索假设；
- 指出当前读面中的边界矛盾；
- 帮编排者避免重复前十五轮出现过的治理错误。

本文不具备代替编排者做最终规划或 Owner 决策的权限。
