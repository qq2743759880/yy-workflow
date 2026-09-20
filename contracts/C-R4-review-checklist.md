# C-R4-control — Owner 场景审查清单

> 文档状态：`C-R4=FROZEN`（2026-09-14 冻结；OQ-R4-1…9 与 N-1 已由 Owner 裁决并吸收；「Owner 确认」列为冻结复认记录位）
>
> 配套契约：`contracts/C-R4-control.md`（hash 登记见冻结记录 `plans/tasks/C-R4-freeze-20260914.md`）。快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。
>
> 组织方式：按 R4 GWT 顺序 R4-01…R4-08（handoff 指定）。每行必含：exact input / expected outcome / defect if / Owner 确认。
>
> 判定规则（沿 C-R3 清单惯例）：**contract defect** = 冻结后的实现行为与本表「期望」列不符，或出现本表禁止的行为（无批准静默推进、终态改写、锁外继续执行、裸布尔满足 gate、blocking 后无条件成功字面、无备份迁移等）。判定前本清单本身不是验收标准。
>
> 「期望」列预填来源 = 冻结输入（GWT-R4-01…05 原文、dev-plan R4 GWT 1-6、PRD0 §11 OBS-01/02）与 `[草案]` 提案（逐项标注）；OQ-R4-1…9 已于 2026-09-14 由 Owner 全部裁决（v2 修订版），「期望」列相关项已按裁决更新；「Owner 确认」列**全部留空**——冻结确认在冻结步骤另行复认，复认或改写即构成新决断记录。
>
> 范围说明：C5 = REPRODUCED → RESOLVED（证据阻塞清除，gate 行为未修复；本契约草案为修复主体定义验收规则）。R4 = blocked（G2.2 图 §4：R3 DONE + C-R4 FROZEN + C5 对 dispatch/gate 验收的阻塞不因本草案解除）。

## A. 转换权限与 Owner 闸（GWT-R4-01/02）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R4-01 | no unauthorized skip（前置未满足的转换被拒） | 对前置未满足的 phase 请求正常转换：`phase.transition {from, to, evidence refs}`（无 owner receipt）；对 malformed contract subtask 触发 dispatch 收尾（C5 形态探针，锚点 `runtime.mjs:38`/`gate.mjs:43-47`） | (a) 拒绝 + `PHASE_PREREQ_UNMET`（GWT-R4-01 原文 `[计划输入]`）；canonical state 不变；非零 exit（dev-plan R4 GWT 1）。(b) gate.before 异常不被吞（dev-plan R4 GWT 3）；dispatch 不得以 `done` 收口；状态写入全部经单一入口（`[草案]` §3.3，PRD0 §7） | (a) 转换成功/状态推进/静默 skip；(b) gate 异常被吞、malformed contract 下收口 `done`（现状缺陷形态，`[C5复现]`）、或直写 status 绕过 transition 函数 | |
| R4-02 | owner confirmation gate（无批准不推进） | 需 Owner 批准的转换（如 override 场景）：`phase.transition {from, to}` 无任何 approval receipt | phase 不变（GWT-R4-02 原文）；输出**缺失批准**的显式诊断（`OWNER_APPROVAL_REQUIRED`，`[计划输入 dev-plan:305]`）而非静默推进；`--force` 不改变该结果（`[草案]` §5.3 表行 2） | phase 变化；或无诊断静默推进；或 `--force` 绕过未批准 override；或诊断出现但状态已先行推进 | |

## B. Session 隔离与锁（GWT-R4-03/04）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R4-03 | session isolation（双会话不串写） | 两个 session ID（如 `A`、`B`）：各自 `--session` 下执行 state 写入、receipt.append、journey 更新与 summary 写入；另验 legacy 无 session 路径读取；strict 模式下省略 `--session` 触发缺省生成 | state/receipts/locks/projections 各归各 namespace（GWT-R4-03 原文）；跨 session 只读对账允许、跨 session 写入禁止（`[草案]` §2.1）；legacy no-session 路径迁移窗口内保持可读（`.tt-state/` 根路径现状语义，`[代码佐证] tt-journey.mjs:50-52`）；非法 session id ⇒ `SESSION_INVALID` fail-closed；**strict 缺省自动生成 UUIDv4，生成时间/生成方/算法版本写入 state 元数据，与 receipt `session` 字段同源可查** `[Owner 决断 OQ-R4-4=B]` | 任何跨 session 写入/读取混淆；state.json（现状未命名空间化，`[代码佐证] store.mjs:4-11`）在 namespaced 模式下仍串写；legacy 路径在迁移窗口内不可读；非法 session 值静默归入缺省通道；自动生成 session 无元数据留痕或与 receipt session 字段不同源 | |
| R4-04 | lock failure（锁耗尽显式失败） | 会话 1 持有 journey/state 锁（`withJourneyLock` 机制），会话 2 在锁存续期内发起写操作并耗尽重试（沿用常量 `{times:5, delayMs:400}`、`STALE_MS 30000`，`[代码佐证] tt-journey.mjs:181-182`） | 显式安全结果：操作失败返回，错误码 = **`LOCK_ACQUIRE_FAILED`** `[Owner 决断 OQ-R4-3=A 新码]`；**不锁外继续执行**（GWT-R4-04 原文）；输出携带锁持有者信息（`[草案]` §2.3 lock 文件 schema）；stale 接管仅在持锁进程确认死亡时发生（`[草案]`） | 耗尽后 WARN + 无锁继续（现状 fail-open，`[代码佐证] tt-journey.mjs:216-217`）；或无显式失败结果静默挂起；或活进程长任务被误接管且无审计 | |

## C. CI 真实性（GWT-R4-05）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R4-05 | CI truthfulness（blocking 失败不打印成功） | (a) `CONTRACT_NOT_FROZEN` / R3 receipt 校验 / GWT-R4-01…04 行为检查 exit 1（BLOCKING_FAIL）后运行 CI 至结束；(b) 资产质量段 exit 1（QUALITY_WARN）；(c) OBS-01：standalone `tt-journey --update --step n` 写入已有 `artifacts/<planId>/state-summary.json` | (a) CI exit non-zero；无 `CI PASS` 等成功字面（GWT-R4-05 原文）；summary 列出 exit code、失败段、是否阻断、artifact 路径（PRD0 §11）。(b) 可 exit 0 但输出带 QUALITY_WARN 分类与失败段明细（资产质量 exit 1 = 信息不阻断，依据 R2 验收 20260912 non-blocking 结论 `[Owner 决断 OQ-R4-8=A]`；其余未分类段 = QUALITY_FAIL 带明细不阻断）。(c) `stageVerification` 真实出现于 state-summary.json（fs API 修复后），或写入失败产生非零结果/显式 warning receipt（PRD0 §11）；standalone 与 orchestrator 路径分别测试 | (a) exit 0 或打印成功字面（现状 C7 缺陷形态：`ci.mjs:95-100` exit 1 仅 `[INFO]` + 无条件 `CI PASS`，`[代码佐证]`）；(b) 无分类无明细静默通过；(c) stageVerification 静默缺失（现状 OBS-01 缺陷形态：promises 命名空间上调同步 API，异常被吞，`[代码佐证] tt-journey.mjs:3/:156-165`）；fixture-only 通过冒充真实消费验证 | |

## D. 迁移与回滚

> 对应 PRD0 §9（迁移/回滚纪律）。R4-06 行覆盖版本 fallback、stateVersion 初始值、无备份不迁移与 rollback 后 approval 失效。

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R4-06 | migration/rollback（版本 fallback + 无备份不迁移） | (a) 旧 state.json（无 `stateVersion` 字段）在 MW0 读取；新写 state.json 写入初始 `stateVersion=1`；(b) 高 `stateVersion` 文件被新 reader 读取；(c) 迁移后立即 rollback（切 `YY_GATE_MODE`/`YY_SESSION_MODE` 回 legacy/dual）；(d) rollback 前签发的 approval receipt 对 rollback 后的 transition 引用 | (a) 缺字段 = legacy v0 双读成功（MW0 合法）、不自动改写旧文件、迁移前先落快照（PRD0 §9.3.2，无备份不迁移）；新写初始值 = `1` `[Owner 决断 OQ-R4-2=A]`。(b) 高版本 ⇒ fail-closed，错误码 = `STATE_VERSION_UNSUPPORTED`（独立新码，不复用 SESSION_INVALID）`[OQ-R4-2=A]`，禁止静默降级读取后覆写。(c) flag 切回 + 快照恢复 + 失败 receipt/override 记录保留 + 五要素记录（flag/commit/session/快照路径/恢复验证，PRD0 §9.3.5）；strict 重启前重跑 R4-01…04 回归。(d) rollback 前签发的 approval 对 rollback 后 transition 一律失效（须重新签发）`[Owner 决断 OQ-R4-6=A]` | 旧文件被原地改写；无快照即迁移；高版本被静默降级读取并覆写或误用 SESSION_INVALID；回滚删除审计 receipt 或把真实执行改写为成功（PRD0 §9.3.6）；回滚记录缺任一要素；rollback 后旧 approval 仍被接受 | |

## E. Override 审计与 fail-closed 默认

> 对应 GWT-R4-01/02（无批准不推进）与契约草案 §4.2/§5（override 审计、approval receipt schema、fail-closed 默认）。R4-07/R4-08 行覆盖批准↔执行对账、approvalEvidence/approvalId/expiresAt 规则与证据缺失判定。

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R4-07 | override audit trail（批准↔执行可对账、不可抵赖） | (a) 前置未满足 + 有效 owner approval receipt（`approvalEvidence`=指令文件路径+SHA256，`approvalId`=`apr-<YYYYMMDDTHHMMSSZ>-<8位随机>`，`expiresAt=null`）+ `--force` 执行转换；(b) 同 receipt 二次引用；(c) 无效 receipt（非 owner approvedBy / 字段缺失 / approvedAt 晚于执行时点 / 跨作用域复用 / rollback 后旧 approval） | (a) 转换执行 + override 执行记录落 `.tt-state/overrides/`（namespaced 下 `.tt-state/<sessionId>/overrides/`，追加式，禁 `vendor/` `[Owner 决断 OQ-R4-9=A]`；非 journey 投影，`[草案]` §5.4）：executionId ↔ approvalId 双向引用、`prereqUnmet` 逐项、toolTrace；目标状态带 `override: true` 标注可被下游辨识（`[草案]` §5.3 表行 3）；journey/plan 输出可见非静默。(b) 幂等或 `OVERRIDE_NOT_ALLOWED` 按幂等规则（`[草案]` §6.2）。(c) `OVERRIDE_NOT_ALLOWED` fail-closed（`[计划输入 dev-plan:305]`） | 执行记录只写 journey 投影（违反 §0.1 前提 1）或写入 vendor/；双向引用缺失；批准时点倒挂仍生效；approvalEvidence 缺 SHA256；approvalId 格式不符；override 后状态伪装为"前置自然满足"；跨 from/to/scope 复用同一 approval；rollback 后旧 approval 仍被接受；同点位反复 override 无 R8 信号（`[草案]` §5.1——记录为流程缺陷） | |
| R4-08 | fail-closed default（证据缺失 = 不通过；telemetry 盲视） | (a) 前置证据**缺失**（非"不满足"）时 `phase.check`；(b) pre-R3 产物裸布尔 `assetConsumed: true`（无 receipt）作为唯一"证据"参与 gate；(c) receipt `result` 缓存与事件重放不一致时 gate 消费 | (a) allowed=false + `PHASE_PREREQ_UNMET`（"无法判定"与"不满足"同归，`[草案]` §4.2）；禁止默认放行。(b) 不满足任何前置（`[R3冻结]` §7.8/§8.3 telemetry-only 决断 7 延续；R4 不得弱化）；gate 输入 = receipt 事件链判定，仅此一路。(c) `RECEIPT_INVALID`（重放规则沿 `[R3冻结]` §7.6，R4 gate 消费同一校验） | "无法判定"被放行；裸布尔/锚点回显/内核词回显任何形式的升格为 gate 输入；对 R3 校验另立宽松读法；非法输入形状返回 allowed=true | |

## 使用说明

1. 「期望」列中标注 `[计划输入]` 的措辞来自冻结 GWT 原文（GWT-R4-01…05、dev-plan R4 GWT 1-6、PRD0 §11），标注 `[草案]` 的为本契约新提案——Owner 审查时对两类分别复认；对 `[草案]` 的改写构成新决断记录，须同步回写契约草案对应章节。
2. R4-01/R4-05 的现状缺陷形态（C5、C7、OBS-01）为冻结快照实测/代码锚点，只作现状对照；审查对象是「冻结后的期望」，且 R4 实现完成前这些行为不得被跳过 gate（C5 未修复声明见契约草案 §0.1.3）。
3. OQ-R4-1…9 已于 2026-09-14 由 Owner 全部裁决（v2 修订版，DECIDED），期望列相关项已按裁决更新；残余 `[待补充]` = (a) 更强行为验证标准、(b) approval↔execution 哈希对账方案，均归属 R4 实现阶段，索引见契约草案 §9/§10。
4. 本清单与配套契约于 2026-09-14 冻结（freeze record `plans/tasks/C-R4-freeze-20260914.md`）；此后变更走变更控制。`route41Rerun.required = false`（路由零改动，草案措辞修订无路由变化）。
