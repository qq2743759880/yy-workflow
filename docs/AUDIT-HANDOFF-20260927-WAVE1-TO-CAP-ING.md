# yy 独立审计交接 — Wave 1 Close → CAP-ING-1 前置（2026-09-27）

> **角色声明**  
> 本文由独立审计者生成。它是“开工建议 + 风险假设”，不是项目 ground truth、不是 Owner 裁定、不是冻结契约，也不是编排者必须执行的任务规格。  
> 编排者必须在当前 revision 下独立复核，并可 ACCEPT / MODIFY / REJECT 本文任何建议。  
> 若本文与当前仓库、当前测试、当前 change record 或当前 Owner ruling 冲突，以当前仓库事实为准。

## 0. 当前审计快照

本轮通过 local MCP 快速核验：

- project: `yy`
- branch: `main`
- HEAD: `8ce6394`
- working tree: clean
- HEAD subject: Batch 3 Wave 1 closeout（ACC-1 / SECMAN-1 / KERNEL-1）
- Wave 2 候选：`CAP-ING-1`
- T0/ledger 已明确：CAP-ING-1 **必须先冻结 ingress mini-contract**

本轮只做高价值边界取证，没有试图读取 1300+ 文件，因此所有“建议”都必须由编排者独立重验。

## 1. 本轮独立确认到的事实

### 1.1 Wave 1 已进入仓库，不只是报告口头完成

当前 HEAD 已包含 Wave 1 closeout，working tree clean。  
因此下一阶段不应该重复 SECMAN-1 / KERNEL-1 的施工，而应该验证它们对 CAP-ING-1 的前置影响。

### 1.2 Security manifest 已刷新到 F-019 后语义

当前生成 manifest hash 为：

`b02687984d6b0d0e95b2b5a4d9e4397a6eccd9fe66ce41da991fb6e261d93c11`

security `when_not_to_use` 已描述：

- 显式非 Python 文件拒绝；
- 纯非 Python 目录拒绝；
- 混合目录真实扫描但 `pass=false`；
- `uncovered_languages` 显式记账；
- “真实执行 ≠ 能力覆盖”。

因此上一轮关于 security sidecar stale 的审计假设已经过期，后续不要重复修。

### 1.3 Spectral 已从“本机 extraneous”升级为仓库声明依赖

当前 `package.json`：

- `@stoplight/spectral-cli: 6.16.3` 精确锁；
- 有 `bootstrap:kernels` script。

当前 `package-lock.json` 也包含 spectral 6.16.3。

因此 KERNEL-1 的核心“仓库不可重建”缺口已被实质修复。  
后续如果继续审计，应关注 bootstrap 与部署策略的长期一致性，而不是再质疑“lock 里没有 spectral”。

### 1.4 capability 目前仍没有 planner 生产者

当前 `scripts/lib/planner.mjs`：

- `capability` 搜索零命中；
- subtask 仍直接构造 `asset`；
- `buildPlan()` 的真实 shape 仍是：
  `{ id, planId, asset, contract, status, phase, dependsOn, ... }`

所以 T0 的判断仍成立：

> runtime 支持 capability ≠ planner/orchestrator 已 capability-native。

CAP-ING-1 仍有真实存在理由。

## 2. 对编排者报告的建议性裁定

### A. ACC-1：方向合理，但不要把“证据修正”本身等同于架构完成

ACC-1 最有价值的是：执行 agent 能推翻编排者的错误证据指针，而不是机械完成任务。

建议保留这个纪律：

- “结论成立”与“引用证据正确”分开审核；
- 每条验收口径至少给 production source + probe 两种证据；
- agent 可以推翻派单前提，不能因为派单来自编排者就默认正确。

### B. Wave 1 并行提交事故必须进入后续派单纪律

SECMAN-1 commit 扫入 KERNEL-1 在途文件，虽然内容未受损，但这已经证明：

> write face 不相交 ≠ commit/staging 面天然隔离。

后续并行派单如果继续用共享 working tree，应至少明确：

1. agent 不得 `git add -A`；
2. 只 stage 自己白名单文件；
3. 编排者统一 commit，或每个 agent 使用隔离 worktree；
4. L2 收口时按文件归属而不是 commit message 认责；
5. 发现跨单 staged 文件立即停，不得“反正内容对”就继续。

这应视为并行调度层风险，而不是某个执行 agent 的偶发失误。

## 3. CAP-ING-1 前置：最关键的设计问题

当前 T0 已正确要求：

> 先冻结 ingress contract，再改 planner。

但“capability 从哪里来”不能由实现者临场决定。

至少有三种可能来源，语义完全不同：

### Option A — 用户/任务显式 capability

例如：

```json
{ "task": "...", "capability": "security-audit" }
```

优点：

- deterministic；
- 最符合现有 CAPABILITY_MAP 精确匹配；
- 未知 capability 可自然 fail-closed。

风险：

- 普通用户是否知道受控 capability key；
- 可能把内部 taxonomy 泄露成用户必须理解的 API。

### Option B — planner 从任务文本解析受控 capability

例如 task 文本命中受控规则后产生 `capability`。

优点：

- 用户无需知道内部 key；
- 真正形成 planner → capability → resolver 链。

风险：

- 若使用自由文本模糊推断，会重新引入 v3.4 已避免的语义模糊；
- 同一句任务可能映射多个 capability；
- provenance 必须可审计。

### Option C — cluster 派生 capability

先 route 到 cluster，再按 cluster/subtask role 赋 capability。

优点：

- 对现有 planner 改动小；
- 可保持当前 cluster DAG。

风险：

- 可能只是把 `asset` 换名字后又映射回来，形成“伪 capability-native”：
  `cluster -> asset -> capability -> same asset`
- capability 不再是独立路由主键，只是 asset 的影子字段。

**审计建议：不要在没有 mini-contract 的情况下直接选择 B 或 C。**

## 4. ingress mini-contract 至少要冻结什么

建议 mini-contract 明确以下字段/不变量，但字段名可由编排者独立设计：

### 4.1 Source

capability 来自：

- explicit task input？
- deterministic planner rule？
- cluster derivation？
- 混合模式？

必须有单一 precedence。

### 4.2 Vocabulary authority

受控 capability key 的唯一事实源是什么？

当前有 `CAPABILITY_MAP`，但要独立判断：

- 它是 registry authority；
- 还是只是一层 adapter mapping；
- 是否需要独立 capability registry / schema。

不要复制第二份受控词表。

### 4.3 Provenance

每个生成 capability 至少能回查：

- source；
- input；
- matched rule / key；
- selected asset；
- eligibility reason；
- override / compatibility path。

### 4.4 Fail-closed

至少定义：

- 未知 capability；
- capability 缺失；
- capability 与 asset 同传冲突；
- capability 解析成功但 asset 不 eligible；
- capability 映射到已 drop asset；
- capability registry/manifest 不一致。

### 4.5 Backward compatibility

当前大量调用仍可能只传 `asset`。

必须明确：

- asset-only 是否继续允许；
- 允许多久；
- capability 优先还是 asset 优先；
- mismatch 是否 warning 还是 hard fail；
- replay/resume 老状态如何处理。

### 4.6 Receipt / evidence

如果 capability 成为 routing 主键，证据里不能只存最终 asset。

至少要能证明：

`requested capability -> resolver -> selected_asset -> eligibility -> adapter`

否则未来仍无法区分“planner 真产生 capability”与“runtime 被手工注入 capability”。

## 5. 需要编排者主动寻找的反例

CAP-ING-1 不要只做 happy path。

建议主动搜：

1. planner 当前所有调用点是否都接受新 shape；
2. state / summary / journey 是否序列化 subtask shape；
3. resume/replay 是否假设 `asset` 永远预先存在；
4. Prompt Composer 是否按 asset 取 manifest row；
5. governance stageForAsset 是否依赖 asset；
6. runtime capability resolve 后 asset 回填时，后续 consumers 读的是哪个字段；
7. frontend contract gate 是否在 planner 阶段依赖 asset；
8. cluster phases/dependsOn 是否基于 asset identity；
9. tests/fixtures 是否深比较 plan JSON；
10. webview/TUI 是否直接显示 `subtask.asset`。

这些都是 capability ingress 最容易出现“runtime 通了，但外围状态机断了”的位置。

## 6. 多候选不要混进 CAP-ING-1

ACC-1 已把原 Batch 2 多候选口径校准为：

- 当前未闭环；
- 属计划口径修订；
- 当前没有足够真实需求去强造 ranking。

我同意把它与 CAP-ING-1 分离。

CAP-ING-1 应先证明：

> capability 从生产入口真实产生，并能确定性地抵达当前单值 resolver。

不要同一单再做：

- candidate ranking；
- LLM semantic matching；
- embedding；
- tie-break policy。

否则会同时改变 ingress 与 resolver，两种错误无法区分。

## 7. Wave 2 建议停止条件

出现任一项应暂停施工：

- mini-contract 未冻结就开始改 planner；
- 需要新增第二份 capability vocabulary；
- 只能靠测试手工塞 `subtask.capability` 才能通过；
- capability 最终仍由已有 asset 反推，只是字段改名；
- planner 新 shape 破坏 resume/state/receipt，但没有 migration 策略；
- capability/asset 冲突被静默覆盖；
- 不知道 source provenance 却仍生成 selected_asset；
- 为了完成 ingress 顺手实现多候选 ranking；
- agent 需要超出 write face，却没有先申请 amendment；
- 并行 agent 使用 `git add -A` 污染其它任务。

## 8. 建议的验收层级

### L1 — Contract

mini-contract 冻结，包含 source / precedence / fail-closed / compatibility / provenance。

### L2 — Planner production

真实 `buildPlan()` 在目标场景产生 capability，不允许手工 patch subtask。

### L3 — Runtime production

`planner -> orchestrator -> runtime.dispatch -> activation resolver -> selected asset -> adapter`

全链可达。

### L4 — State/evidence

state / receipt / report 中保留 capability provenance。

### L5 — Negative

未知、冲突、drop、ineligible、legacy asset-only 都有明确行为。

### L6 — E2E-v3

真正从用户 task 输入进入，不允许测试直接构造 capability subtask 作为最终证明。

## 9. 审计者限制

我没有完整读取所有 caller、state consumer、UI/TUI、resume/replay、所有 contracts。

因此本文不应被转换为“CAP-ING-1 必须按这个方案实现”。

编排者的职责是：

1. 用本文作为搜索假设；
2. 重新追真实生产链；
3. 独立冻结 mini-contract；
4. 明确哪些建议 ACCEPT / MODIFY / REJECT；
5. 再派执行单。

