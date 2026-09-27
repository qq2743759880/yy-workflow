# Codex Orchestrator Handoff — yy（2026-09-27）

> **接管目标：从 Zcode 切换到 Codex 编排者，不重开项目。**
>
> 本文件由外部独立审计者生成，只是接管建议，不是项目 ground truth、Owner 裁定或新的冻结契约。
> Codex 必须先用当前仓库证据独立核验；可以 ACCEPT / MODIFY / REJECT 本文件任何建议。
> 禁止因为“Zcode 说已完成”就盲信，也禁止因为“审计者曾经质疑过”就自动重开已关闭任务。

## 0. 当前已核地面事实

通过 local MCP 于本次交接前重新确认：

- project: `yy`
- branch: `main`
- HEAD: `b53e920`
- working tree: clean
- 最新提交主题：`BATCH 3 FORMAL CLOSEOUT`
- 上一提交 `533b3ea`：D.5 amendment + closeout E2E + regression 35/35 + preflight 8/8 + audit-index selftest 68/68
- ledger 当前 closeout 主体：
  - Batch 3 主体 CONFIRMED
  - 完全收口 PARTIALLY CONFIRMED 的剩余项为 Owner-resource / backlog 类，不是当前在飞技术单
- 当前工程态应按“**CLOSED / 不自动继续派单**”接管，除非 Codex 独立核验发现与仓库事实冲突的真实 blocker。

## 1. Codex 的身份

你是新的**主编排者**，不是 Zcode 的续写器，也不是单纯执行 Agent。

你的职责顺序：

1. 先建立当前 Ground Truth；
2. 判断旧编排者报告哪些仍成立；
3. 保护已关闭项目不被无理由重开；
4. 只有出现真实、当前、可复现的 blocker 才允许重新进入执行态；
5. 所有 backlog / Owner-resource 项默认保持 backlog，不自动派单。

你有权拒绝本交接中的任何建议，但必须给仓库证据。

## 2. Evidence Boundary

以下全部降级为 `UNTRUSTED PRIOR / ADVISORY`：

- Zcode 会话记忆
- Zcode 自动生成的自然语言报告
- 旧审计聊天结论
- 本文件
- 其它会话记忆
- commit message 中未经文件/测试核验的主张

可以作为事实依据的是当前 revision 下你亲自读取/执行得到的：

- Git HEAD / working tree
- 当前源码
- 当前 contracts / change records / receipts
- 当前 plans / ledger
- 当前 test-reports
- 当前 regression / preflight / validate / selftest
- 当前 runtime / caller / consumer 链

## 3. 接管时不要重新执行整个项目

项目已经经历多批次、多轮审计。

Codex 接管的第一动作不是：

- 开 Batch 4
- 重新跑 15 轮审计
- 重新设计 capability
- 重新迁移资产
- 重新派 subagent

而是做一个**bounded takeover verification**。

推荐只核：

1. `git status --short`
2. `git log --oneline -5`
3. `plans/autopilot-ledger-20260921.md` 最终 closeout 段
4. `plans/W2-0-ground-truth-ingress-contract-20260927.md`
5. 当前最终 E2E / closeout evidence
6. `scripts/orchestrator.mjs` capability 主链接线
7. S17 当前语义
8. 当前 change-lock / task-in-flight 状态

如果这些与 closeout 一致：

**维持 CLOSED。**

## 4. “CLOSED” 与 “PARTIALLY CONFIRMED” 的区别

不要混淆两个层次。

### 工程项目状态

当前最新 Git 历史声明已经 formal closeout，working tree clean，没有已知在飞执行单。

因此默认：

`PROJECT EXECUTION STATE = CLOSED`

### 能力边界

ledger 仍明确声明：

`FULL CAPABILITY COVERAGE = PARTIALLY CONFIRMED`

其原因主要是：

- MG-1 需要外部 API key
- E-4-EXEC 真实 LLM 行为面需要 Owner/resource
- 多候选 ranking 没有真实需求，不实施
- 部分低优先 backlog

这些边界**不是重新自动派单的授权**。

Codex 必须把：

“项目已结束”
和
“未来仍有可选 backlog”

同时保持为真。

## 5. Zcode → Codex 交接纪律

### 5.1 不继承 Zcode 的隐藏状态

不要假设：

- 某 agent 仍在后台
- 某 task 还在飞
- 某锁仍有效
- 某 Owner 决策仍 PENDING

必须从仓库重新读取。

### 5.2 不继承 Zcode 的自动派单惯性

出现以下内容时默认不派：

- backlog
- optional
- Owner-resource
- future batch
- “可以继续优化”
- “如果有 key”
- “未来多候选”

只有 Owner 新指令或当前 close gate 明确要求，才重新开任务。

### 5.3 不因为接管而改宿主配置

仓库已有 Codex 指引：

`docs/executor-setup/codex.md`

其边界要求：

- 不读取/写入 `~/.codex/auth.json`
- 不修改 `~/.codex/config.toml`
- 不自动改 cc-switch / 用户代理配置
- 宿主只通过 CLI/env 接入

如果需要将 Codex CLI 当执行宿主，而非仅作为编排者，先按该文档做 presence/roundtrip 探测。

## 6. Codex 接管后应保留的核心架构事实

以下仅作为快速索引，必须由你独立复核：

- asset registry 已由 16 收缩到 9
- capability vocabulary 为受控 `CAPABILITY_MAP`
- 禁自由模糊 capability routing
- capability ingress 已形成 task/planner/orchestrator/runtime/resolver/adapter/evidence 链
- capability 与 asset 冲突最终按 D.5 amendment 处理
- migration 有生产 authority，不应再在 test 里自造 promotion oracle
- verification-before-completion 有生产发射点
- audit-index 有 semantic freshness/selftest
- Spectral 6.16.3 已成为正式依赖，并有 kernel bootstrap
- security manifest 已采用 F-019 后的能力覆盖语义
- review 的 bugbot replace 最终为 ADAPT / NO INSTALL，保留 prompt-backend

如果任何一条与当前代码冲突，不要补脑，记录 discrepancy。

## 7. 当前应该视为历史证据的旧文件

`docs/AUDIT-HANDOFF-*`
`docs/ORCHESTRATOR-*-ACTIONS-*`

是前几轮审计导航，不是当前 active task queue。

Codex 不应把这些文件中的旧 blocker 自动重新派发。

读取它们时先看：

- 写入日期
- 对应 HEAD
- 是否已有后续 commit supersede
- ledger 是否已关账

## 8. 今天完成项目的接管标准

Codex 接管后最多做一次短 verification，随后产出：

### Takeover Verdict

- current HEAD
- working tree
- closeout evidence consistency
- active tasks = ?
- unresolved technical blockers = ?
- resource backlog = ?
- verdict = KEEP_CLOSED / REOPEN_REQUIRED

### 默认期望

如果没有发现真实反例：

`KEEP_CLOSED`

然后停止执行。

## 9. 只有这些情况允许 REOPEN_REQUIRED

必须是当前可复现事实，例如：

- final closeout commit 与源码明显矛盾
- final regression 当前必然失败且属于 closeout 改动
- final evidence 指向不存在/错误的 production chain
- frozen contract 与当前 runtime 再次冲突
- working tree 有未解释生产改动
- 有未释放锁/未完成 task 且确属 close gate

以下**不够**作为 reopen 理由：

- “还能优化”
- “多候选还没做”
- “LLM 模式没 key”
- “MG-1 以后可以更强”
- “某历史审计文件里曾经写 FAIL”
- “我想重新设计”

## 10. Git / 文件操作纪律

如果只是接管核验：

- 不修改生产代码
- 不新增 task
- 不 `git add -A`
- 不重写历史证据

如果发现真实 blocker 后 Owner 允许 reopen：

- 先声明 write face
- 精确 stage
- amendment 先于越界修改
- 保留 supersede-not-delete

## 11. 最终交接原则

Codex 接管成功的标志不是“又开始工作”，而是：

> 能够独立确认项目已经结束，并有纪律地不再自动制造工作。

如果仓库证据支持 CLOSED：

**保持 STOP AUTO-DISPATCH。**
