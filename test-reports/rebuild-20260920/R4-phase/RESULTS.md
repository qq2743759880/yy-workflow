# R4 rebuild results — `scripts/lib/phase.mjs` 行为级重建（2026-09-20）

> 重建对象：`scripts/lib/phase.mjs`（Phase Authority / Gate / Session / CI Truthfulness，C-R4-control 契约实现）。
> 原文件未恢复（原 sha256 前 16 位 `59b19bd2721bbe70`，见 `test-reports/R4-acceptance-20260915/REPORT.md` implementationFilesAccepted）。
> 重建依据（唯一权威）：`contracts/C-R4-control.md`（FROZEN，2026-09-14）+ `contracts/C-R4-review-checklist.md`（R4-01…08 期望列）+ R4 验收报告 `contractConformance`/`independentReruns` 反推行为面。
> 风格对齐：`scripts/lib/evolution.mjs`（R10 重建参考实现；中文注释、响应壳、fail-closed 纪律）。
> 新文件 sha256：`ab832e7cdce450513afd4f2f300d0cfd945ccba9d0782f4b7df73174ba517249`。
> 增量纪律：仅新建 `scripts/lib/phase.mjs` 与本目录；零既有文件改动；仅 node 内置依赖（fs/path/crypto）；未 commit。

## 1. 操作面（仅两操作，不新增操作名 [计划输入 dev-plan:304-305]）

| 操作 | 语义 | 输入（要点） | 输出 data | 错误码 |
|---|---|---|---|---|
| `phase.check` | 只读前置查询（不写状态/journey/receipt；lock 不需要，§6.1） | `workspace?`、`target`(B 面 step 0-8) 或 `from`+`to`(A 面)、`session?`、`journey?`（快照对象/路径/缺省读盘）、`opts.{now,env}` | `{allowed, reason, missing[]}`；evidence `{snapshot, stateVersionEcho, sessionEcho, checkedAt, …}` | ok:false：`CONTRACT_NOT_FROZEN`/`SESSION_INVALID`/`STATE_VERSION_UNSUPPORTED`/`RECEIPT_INVALID`/`INVALID_TRANSITION`(形状/矩阵)；data 通道（OQ-R4-7=A）：ok:true + code=`PHASE_PREREQ_UNMET` + `data.allowed=false` |
| `phase.transition` | 单一状态入口（§3.3/§6.2：矩阵→前置→override→锁内原子写入，全部通过才落盘） | `workspace?`、`from/to`、`session?`、`ownerReceipt?`(§5.2 形)、`evidenceRefs?`、`force?`、`opts.{now,env,rand,toolTrace}` | `{from, to, at, sessionId, override: null\|executionId, stateVersionWritten, idempotent?}` | `INVALID_TRANSITION`/`PHASE_PREREQ_UNMET`(先于 override 判定)/`OWNER_APPROVAL_REQUIRED`(force 无批准)/`OVERRIDE_NOT_ALLOWED`(批准无效)/`LOCK_ACQUIRE_FAILED`/`STATE_VERSION_UNSUPPORTED`/`CONTRACT_NOT_FROZEN`/`RECEIPT_INVALID`/`SESSION_INVALID` |

响应壳（契约 §6）：`{ok, code, data, evidence, warnings}`，evidence 为对象，五键在成功/失败间完全一致（探针逐响应机验）。

非操作面导出（供 CI/R10 evolution 只读消费与探针复现）：`run(op,input)` 分发、`resolveGateMode`/`resolveSessionMode`（MW0 双读）、`validateReceipt`（[R3冻结] §7.6 同一校验）、`classifyCiResult`/`ciSummary`（§7.2/§7.3）、`recordRollback`（§8.4 证据面辅助，登记 rollback 后旧 approval 失效）、`formatApprovalEvidence`、`withStateLock`、冻结常量（STATE/TRANSITIONS/GATE_VOCAB/STEPS/STEP_GATE/LOCK_RETRY/LOCK_STALE_MS/STATE_VERSION/ERROR_CODES/CI_CLASSIFICATION 等）。

## 2. 探针表（run-probes.mjs，全部沙箱于 `.sandbox/<pNN>/`）

对照标准 = 契约 GWT/清单行 + 验收报告 `independentReruns` 10 项复跑清单；实际输出见 `out-probe-results.json`。

| probe | exit | ok | 断言 | 覆盖（契约小节 / 清单行 / 验收复跑项） | summary |
|---|---|---|---|---|---|
| p01-gwt-r4-01-no-unauthorized-skip | 0 | true | 10/10 | §4.2/§6.1/§6.3、OQ-R4-7=A；清单 R4-01a；gwt-r4-01 | check data 通道 allowed=false；transition 拒绝 `PHASE_PREREQ_UNMET`；canonical state 字节不变；无静默 skip 审计 |
| p02-gwt-r4-02-owner-confirmation-gate | 0 | true | 10/10 | §5.3 行 1-2；清单 R4-02；gwt-r4-02 | force 无批准 ⇒ `OWNER_APPROVAL_REQUIRED` 显式诊断；前置自然满足时 force 无效果（override=null、无 bypass 记录） |
| p03-gwt-r4-03-session-isolation | 0 | true | 11/11 | §2.1、OQ-R4-1=A；清单 R4-03；gwt-r4-03 | 双会话 namespace 不串写；跨会话写入禁止；非法 session ⇒ `SESSION_INVALID`；legacy 路径可读（v0 echo） |
| p04-gwt-r4-04-lock-failure | 0 | true | 9/9 | §2.3，OQ-R4-3=A；清单 R4-04；lock-contention | 活锁耗尽 5×400ms ⇒ `LOCK_ACQUIRE_FAILED` + 持有者回显；不锁外继续；释放后成功 |
| p05-gwt-r4-05-ci-truthfulness | 0 | true | 14/14 | §7.2/§7.3，OQ-R4-8=A；清单 R4-05ab；gwt-r4-05 | 三类分类边界逐行；summary 四必含字段；blocking ⇒ 成功字面禁止 |
| p06-state-version | 0 | true | 9/9 | §2.2，OQ-R4-2=A；清单 R4-06ab；state-version | v0 双读；新写初始值=1；高版本/陌生值 `STATE_VERSION_UNSUPPORTED` 且禁覆写；损坏 state 显式失败 |
| p07-override-receipt-valid | 0 | true | 14/14 | §5.2/§5.3 行 3/§5.4，OQ-R4-6/9=A；清单 R4-07a；override-receipt | 批准先于执行；`.tt-state/overrides/` 追加记录（禁 vendor）；approvalId↔executionId 双向引用 + approvalHash；状态带 override 标注非静默 |
| p08-override-receipt-invalid | 0 | true | 44/44 | §5.2/§5.3 行 4-5；清单 R4-07b/c；override-receipt | 12 类无效/越权变体全部 `OVERRIDE_NOT_ALLOWED`（无批准 ⇒ `OWNER_APPROVAL_REQUIRED`）；二次引用走幂等；跨转换复用拒绝；rollback 失效条款 + 重新签发放行 |
| p09-session-modes-flags | 0 | true | 13/13 | §2.1/§8.1，OQ-R4-4/7=A；清单 R4-03/06c；session-isolation | strict 缺省 UUIDv4 + 元数据三字段同源；YY_ 优先/TT_ 回退；flag 非法 fail-closed；namespaced 写入、legacy 根不串写 |
| p10-lock-takeover-semantics | 0 | true | 8/8 | §2.3；清单 R4-04；lock-contention | takeover = pid 死亡 OR（过期且无法证明存活）；活进程过期不接管；legacy 空锁过期自愈/未过期显式失败 |
| p11-fail-closed-defaults | 0 | true | 20/20 | §4.2/§4.3/§3.2/§6.2；清单 R4-08；gwt-r4-01/02 深化 | 缺失=不通过同归一码；裸布尔 telemetry 盲视；重放不一致 `RECEIPT_INVALID`；非法形状绝不 allowed=true；终态不可追加（force 例外无效）；[待补充] 显式透传；幂等 no-op / 异 from `INVALID_TRANSITION` |
| p12-prereq-mapping | 0 | true | 15/15 | §4.2（OQ-R4-5=A 冻结表）+ §3.4 衔接点 1/2 | B 面四闸置位判定；step5 契约冻结三形态；step7 eligibility 投影；step8 receipt 全覆盖；DEP_PRECONDITION（上游 receipt behavior_verified，裸布尔不满足）；未列出转换仅矩阵+session+lock |

**TOTAL: 12/12 PASS（177 断言）；EXIT=0**

## 3. 全量自验

| 项 | 结果 |
|---|---|
| `node test-reports/rebuild-20260920/R4-phase/run-probes.mjs` | 12/12 PASS，EXIT=0 |
| `node scripts/regression-all.mjs` | 12 PASS / 0 FAIL，exit 0（基线前后各跑一次一致） |
| `node scripts/validate-structure.mjs` | `[OK] 结构校验通过 (0 项警告)`——与重建前基线一致，无新警告（新文件可移植性泄露 0、U+FFFD 0） |
| 沙箱纪律 | 全部写入限制于 `test-reports/rebuild-20260920/R4-phase/.sandbox/`；仓库根 `.tt-state/` 不存在；vendor/ 未触碰 |
| 增量纪律 | `git status` 仅新增：`scripts/lib/phase.mjs`、`test-reports/rebuild-20260920/`（`activation.mjs`/`journey.mjs`/`receipt.mjs` 为并行重建任务的产物，本模块未依赖、未改动）；未 commit |

## 4. 偏差与重建推断（行为级重建，非逐字节恢复；逐项标注依据）

1. **`GATE_MODE_UNSUPPORTED` 码名（推断）**：§8.1 冻结的是"flag 值非法 ⇒ fail-closed 禁 silent fallback"行为，未冻结码名。本重建采用独立码 `FLAG_UNSUPPORTED_CODE='GATE_MODE_UNSUPPORTED'`（对齐 C-R3 `ACTIVATION_MODE_UNSUPPORTED` 命名风格），不计入契约九码面。
2. **check 的矩阵外/非法形状返回 `INVALID_TRANSITION`（ok:false）**：§6.1 只列 `PHASE_PREREQ_UNMET`/`CONTRACT_NOT_FROZEN`/`SESSION_INVALID`(+v2 新码)。对"target 形状非法/矩阵外转换"若走 data 通道将以 `PHASE_PREREQ_UNMET` 回答，语义混淆；本重建选择 dev-plan 既有冻结码 `INVALID_TRANSITION`（不新增码），满足"禁止对非法输入返回 allowed=true"。
3. **namespaced receipt/审计布局（推断）**：§2.4 冻结 per-artifact 布局本身不变，namespace 化细节契约交由实现任务（§2.1 [草案]）。本实现：namespaced receipt = `artifacts/<sessionId>/<subtaskId>/receipt.json`；transition 审计流/overrides/rollbacks 随 state 目录（`.tt-state[/<sessionId>]/…`），overrides 落点逐字 OQ-R4-9=A。
4. **approvalEvidence 解析形（推断）**：OQ-R4-6=A 冻结"指令文件路径 + 该文件 SHA256、对话引用为辅"，未冻结字符串形。本实现取 `<路径>#<sha256>`（`formatApprovalEvidence`），且要求指令文件真实可读、字节哈希一致（不可抵赖 fail-closed）；会话引用不解析。
5. **GWT-R4-01(b)/R4-05(c)（runtime gate 吞异常、OBS-01 fs 误用）不在本重建范围**：其修复主体属 `runtime.mjs`/`tt-journey.mjs`（契约 Exact files），本仓恢复快照为 pre-R4 版且本任务禁止修改既有文件；phase.mjs 侧以"单一入口 + 锁内原子写入 + 被拒无审计"承担同一缺陷面中属于 transition 函数的部分（p01 断言）。
6. **验收报告 `singleEntry`（13 处 setSubtaskStatus/setPlanStatus 改接）**：属 runtime.mjs 改造，不在本重建文件范围；phase.mjs 提供 `checkPhase/transitionPhase` 单一入口供接线（验收报告命名的两导出已按名重建）。
7. **stateVersion 升版写法（推断）**：MW0"不自动改写旧文件"落为：check 只读（echo v0）；仅真实 transition 写入时置 `stateVersion=1`（清单 R4-06a"新写写入初始 1"）。
8. **接收 evidence 壳为对象**：契约 §6 示形 `"evidence": { }`（对象），与 evolution.mjs 的数组形不同——两契约各自冻结壳示形，按各自契约实现（任务书"严格按契约"）。

## 5. [待补充] 清单（fail-closed 保持待补充，禁止编造）

| 项 | 状态 | 本实现处置 |
|---|---|---|
| 更强行为验证标准（P1-P5 地板之上，OQ-R4-5=A 残余） | 契约原文 `[待补充]`，归属 R4 实现阶段/Owner | 不定义、不编造；导出 `STRONGER_VERIFICATION_STATUS` 常量并在每次 `phase.check` evidence 以 `strongerBehaviorVerification` 字段显式透传（p11 断言）；P1-P5 地板只读消费、不弱化 |
| approval↔execution 哈希对账方案（§5.4(b) 残余） | 契约留待 R4 实现；R4 验收报告记载以 "append-only audit + canonical hash" 参数化解决 | 按验收口径实现：执行记录携带 `approvalHash`（approval 规范化 JSON sha256）+ `.approvals-registry.json` 双向引用登记（approvalId↔executionId），批准/执行时点进入同一哈希对账 |
| 通知面：`recordRollback` 仅登记 rollback 事件五要素中的 flag/会话可选项 | 快照路径/恢复验证结果由 §8.4 操作面调用方补齐 | 登记结构预留 `flags/reason` 字段，不替 Owner 编造 |

## 6. 覆盖契约小节总表

| 契约小节 | 覆盖探针 |
|---|---|
| §2.1 session 身份/namespace/strict 缺省 UUIDv4+元数据 | p03、p09 |
| §2.2 stateVersion 与 fallback | p06 |
| §2.3 lock 语义/接管/耗尽 | p04、p10 |
| §2.4 与 R3 receipt 存储共存 | p07（overrides 与 receipt 物理分离）、p11（receipt 消费） |
| §3.1/§3.2 A/B 面权威与矩阵/终态不可追加 | p11、p12 |
| §3.3 单一入口 | p01、p02、p07（审计留痕面） |
| §3.4/§4.2 衔接点 1/2 与前置映射 | p12 |
| §4.1/§4.3 谓词类别与 fail-closed/telemetry 盲视 | p01、p11、p12 |
| §5.1-§5.4 override 政策/批准 receipt schema/审计/不可抵赖 | p02、p07、p08 |
| §6.1/§6.2/§6.3 两操作 schema/幂等/通道分叉 | p01、p02、p07、p11 |
| §7.2/§7.3/§7.4 CI 分类与字面约束 | p05 |
| §8.1-§8.4 flags 双读/迁移读法/rollback 失效 | p06、p08、p09（MW 推进执行属 R6，不在本文件范围） |
| 清单 R4-01…R4-08 | p01/p02、p03/p09、p04/p10、p05、p06、p07/p08、p11、p12 |
