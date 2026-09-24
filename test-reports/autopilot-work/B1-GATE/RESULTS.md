# B1-GATE RESULTS — 三机制单：preflight + change-lock + migration contract（批 1）

- 执行：B1-GATE L1 agent（全新上下文，regression-all.mjs 批内唯一 owner，写面声明表 handoffs/v3/write-faces-batch1.md）
- 日期：2026-09-24
- 派单：handoffs/v3/B1-GATE-dispatch.md
- 结论：**不自称 DONE**——四任务 + 全部自测完成并留证；Owner-gated 项见 §偏差 D-3。

## 一、交付物与白名单核对

| 文件 | 动作 | sha256（前 16） |
|---|---|---|
| scripts/preflight.mjs | 新建（任务 A） | b36257fb1e6a91e2 |
| scripts/change-lock.mjs | 新建（任务 C） | 4c1eaa58db6e26ee |
| scripts/regression-all.mjs | 仅加 S14 段 + S15 占位 + 头注两行段说明（任务 B）；S1-S13 零改动 | — |
| contracts/asset-migration.md | 新建（任务 D） | ae7455da22d2a609（即 change 单 baseVersion） |
| contracts/discrepancies/cr-20260924T090000Z-b1g4te5c.json | 新建（任务 D change 单，AV-1 同款格式，Owner 签收位 PENDING） | 755c498ace3f3a7c |
| plans/change-lock.json | 新建（锁面，批内审计痕迹随批提交；自测临时锁已全部清空） | 603894c267a30d11 |
| test-reports/autopilot-work/B1-GATE/** | 本目录，证据 | — |

未触碰：AV-2 领地（manifest-build.mjs / manifest-sources / asset-manifest-v2.json——本轮并行落地，本单零写）、SKILL.md、commands/、webview/、既有冻结件、vendor/。未执行 git 操作（含只读命令亦未用，以文件清单自证）。未跑 BFX/FE 历史回归目录。

## 二、三机制 CLI / 用法摘要

### 1. preflight.mjs（任务 A，全静态 / 零 LLM / 零网络 / 确定性）

```
node scripts/preflight.mjs [--changed <git status --porcelain 输出>] [--owner <task>]
                           [--adapters-file <path>] [--clusters-file <path>]   # 后两项仅供探针注入复现
退出码：0 = 无 FAIL；1 = 有 FAIL
```

- P1 语法门：scripts/ 下全部 .mjs 过 `node --check`（blindqueue 重复声明教训——文件坏了 self-test 跑不起来，只有编译器级预检能抓）。
- P2 导出查重：跨模块解析 `export const/function/class` + `export {}` 具名表；同名报警语义分级——存量 13 组（LEGACY_DUP_EXPORTS 登记，逐组注明核销理由）降 WARN，清单外新增同名 → FAIL 具名。
- P3 ADAPTERS 一致性：注册表每个 `ADAPTERS.set(name, var)` 的 import 路径解析有效 + 文件存在 + 资产名 ∈ CLUSTERS candidates ∪ ASSET_WHITELIST ∪ runtime.mjs 能力映射 case 集（dev-backend/be-implementer/portman 别名由此覆盖）。
- P4 CLUSTERS ↔ 磁盘：candidates 逐个验 vendor/<name>/（<name>.md 或 SKILL.md）。现态 16/16 全过；AS-1 drop 后随 candidates 收缩自动通过（唯一事实源驱动，无硬编码 16）。
- P5 buildManifest 单源：全仓扫（排除 node_modules/.git/vendor/test-reports/recovery-*/prototypes）含 `asset-manifest-v2.json` 且同行含写调用模式 → 唯一写方必须是 scripts/manifest-build.mjs；产物在场而构建器缺失 → FAIL（第四位审计反例：runtime 走旧 buildManifest 绕过）。
- P6 DROP_ALLOWED 断言：读 contracts/asset-manifest-v2.json；**文件缺失 → SKIP 注明，不 FAIL 不等 AV-2**（本批实测先后经历 SKIP→P6 生效两态）。凡 drop_pending 行 drop_allowed 非显式 true → FAIL 具名（v3.2 防并行绕过；无 drop 意图 → "扫描 16 行：无 drop-pending 行" PASS）。
- P7 change-lock 核查：`--changed` 接 git status --porcelain 输出（前缀剥离在 trim 之前，否则 " M path" 识别失败——实测回归后修正），被 active 锁（owner≠当前任务、未过期）覆盖的文件出现在改动列表 → FAIL 具名 LOCKED_FILE_CHANGED。

### 2. change-lock.mjs + plans/change-lock.json（任务 C）

```
node scripts/change-lock.mjs --acquire <file> --owner <task> --reason <r> [--ttl 分钟，默认 120]
node scripts/change-lock.mjs --check  <file> [--owner <task>]   # 他方 active 锁 → exit 1
node scripts/change-lock.mjs --release <file> --owner <task>    # 仅持锁人可释放（过期锁可清理）
node scripts/change-lock.mjs --list
```

- 锁字段 {file, owner, task, locked, reason, expires}；expires 必填（agent 崩溃防悬挂锁，store.js 过期锁先例）；过期锁自动视为可抢（check 判无锁 + acquire 直接夺取覆写）。file 为主键，同文件单条记录。
- **语义 = 建议性**（脚本头注 + 锁面 _comment 均如实写明）：真强制力 = 编排者派发拒发 + 收口 git diff 逐文件归属核查（写面声明表）。本 CLI 只是机检面，preflight P7 消费之。

### 3. asset-migration contract（任务 D，contracts/asset-migration.md）

- 六态 Migration State 机：ACTIVE→SHADOW→MIGRATING→PRIMARY→DEPRECATED→REMOVED；合法流转 5 条（逐条带证据要求），非法流转 9 条穷举具名（含"DEPRECATED→REMOVED 而 drop_allowed≠true""任意态直跳 REMOVED""REMOVED 终态不可出"）。
- replace 五元组 schema：old_asset / new_asset / shadow_result（fixture+evidence+baseline_ref）/ promotion_receipt（apr-\* receipt）/ runtime_binding（consumed_hash==build_hash 断言）；缺任一 → change 单不成立（CONTRACT 类 fail-closed）。
- 三硬门：Gate-1 legacy BLOCKED / EXPLICIT_COMPAT_MODE（旧 loader 调用须显式旗标+留痕）；Gate-2 runtime consumed hash == build hash；Gate-3 五元组齐备。**门栈适用范围显式声明：全量门栈只压首个 replace（be-validator 换 Spectral，验收载体），复制走机械化 wizard 式清单，禁四路并行**（v3.3 编排者补充裁定）。
- drop_allowed 旗标语义：drop_pending（意图）与 drop_allowed（放行）双字段；放行须 drop 三条件（candidate+runtime invocation+quality 缺一不可）+ 6 处联动就绪 + CONTRACT 类 change 单在案；fail-closed（字段缺失=未放行）；preflight P6 + 回归断言双卡点——"旗标防并行，流程序防护只防串行"。
- 影子跑夹具规范：临时 workspace（os.tmpdir mkdtemp 同 S4-S8 先例）、证据落 test-reports、夹具跑完即删、**Migration Adapter 禁为永久制品**（v3.1"砍永久层"，违胶水 ≤150 行纪律一律拒绝）。
- change 单 cr-20260924T090000Z-b1g4te5c：CONTRACT 类，AV-1 同款字段结构（idempotencyKey 按 change.mjs canonical 键序 sha256 实算；sourceEvidence 逐条实 sha256），**ownerSignOff.status = PENDING**（approvalEvidence = PENDING_OWNER_RECEIPT 待 Owner 签发回填）。

## 三、注入探针结果（临时文件注入，测完删净，残留核查通过）

| 探针 | 注入动作 | 期望 | 实测 |
|---|---|---|---|
| 重复导出 | 临时新建 scripts/\_\_probe-dup-export.mjs 导出 `CLUSTERS` | P2 FAIL 具名 | **FAIL P2 — DUP_EXPORT: CLUSTERS @ scripts/\_\_probe-dup-export.mjs + scripts/lib/matrix.mjs**，exit 1 |
| 坏 adapter 指向 | index.mjs 复制件注入 `import ghost from './\_\_ghost-adapter.mjs'`（不存在的文件）+ `ADAPTERS.set('ghost-orphan-adapter', ghost)`，经 --adapters-file 注入 | P3 FAIL 具名 | **FAIL P3 — ADAPTER_IMPORT_MISSING（\_\_ghost-adapter.mjs 不存在）+ ADAPTER_MAP_MISSING + ADAPTER_NAME_UNKNOWN**，exit 1 |
| 孤儿 candidates | matrix.mjs 复制件 T1 candidates 注入 `ghost-orphan-asset`，经 --clusters-file 注入 | P4 FAIL 具名 | **FAIL P4 — CANDIDATE_MISSING 1 个: ghost-orphan-asset（cluster=T1_DATABASE）**，exit 1 |

三探针文件均已删除，`ls` 复核 0 残留；探针完整输出存 probes/probe2-bad-adapter-output.txt、probes/probe3-orphan-candidate-output.txt（探针 1 输出见本节引文，原始 stdout 未 tee，如实登记）。白名单核对：探针注入只动白名单外**临时**文件且已删净，未改任何非白名单持久文件。

## 四、change-lock 流程实测（change-lock-test-output.txt）

1. acquire（T-A, ttl=30）→ exit 0 ✓
2. check 他人视角（T-B）→ **FAIL LOCK_HELD，exit 1** ✓
3. release 非持锁人（T-B）→ FAIL NOT_OWNER，exit 1 ✓
4. **注入过期时间戳**（expires 改写为 2026-09-24T00:00:00Z）→ check（T-B）→ "已于 … 过期——自动视为可抢"，exit 0 ✓
5. 过期锁自动可抢：acquire（T-B）→ 成功夺取并提示"原锁 owner=T-A 已于 … 过期"，exit 0 ✓
6. release 持锁人 → exit 0 ✓；release 后 check → 无锁 exit 0 ✓
7. preflight P7 联动：锁 T-A 在场 + `--changed " M scripts/preflight.mjs"` + 当前任务 T-ME → **FAIL P7 LOCKED_FILE_CHANGED，exit 1** ✓；release 后复测 → 7 PASS exit 0 ✓
8. 锁面终态：`{"locks": []}`（自测临时锁全部释放）

## 五、14 段回归结果（regression-all-14sections-output.txt）

```
node scripts/regression-all.mjs（S14 接入后）
S1 validate-structure PASS（validate 0 警告）
S2 test-retry PASS / S3 Phase 2 替换清单 PASS / S4 契约工作流 PASS / S5 宿主执行 PASS
S6 资产缓存 PASS / S7 review-gate PASS / S8 资产消费证据 PASS / S9 域声明 PASS
S10 token 量尺 PASS / S11 引用链 PASS / S12 kickoff 漂移门 PASS / S13 junction smoke 4/4 PASS
S14 preflight invariants PASS（7 项静态不变量全过；P6 在 manifest 产物落地后已自动从 SKIP 转 PASS 生效）
S15 migration invariants 占位（不进计数）
结果: 14 PASS / 0 FAIL，exit 0
```

preflight 单独终态（preflight-final-green.txt）：7 PASS / 0 FAIL / 0 SKIP，exit 0。

## 六、D-偏差登记

- **D-1（preflight P2 存量同名导出分级）**：派单口径"同名导出报警"，全仓实测存量同名导出 13 组（run/main/ERROR_CODES/name/EXIT/CANDIDATE_INVALID 等，多为逐模块错误码与入口 main 惯例）。若一律 FAIL 则当前仓态不可能绿。裁定：LEGACY_DUP_EXPORTS 登记降 WARN（逐组注明核销理由），**清单外新增同名 → FAIL**。本单落地当日即抓到 AV-2 manifest-build.mjs 与 lib/asset.mjs 的 CANDIDATE_INVALID 新增同名（两处值完全等同的哨兵码，具名 import 无运行时冲突），按值等同哨兵码归 legacy——此判定为本单临时口径，**清单收缩须逐项核销，正式核销口径待 Owner 追认**。
- **D-2（--clusters-file / --adapters-file 测试注入口）**：为满足"探针文件测完删净"且不改 matrix.mjs / adapters/index.mjs（非白名单），preflight 增加两个仅测试用的文件覆写参数。生产用法不受影响（默认即真实源），已在 CLI 头注标明。
- **D-3（Owner-gated 待追认项）**：①asset-migration.md 为待确认草稿态（change 单 Owner 签收位 PENDING），不得作为 AS-2-first replace 的放行依据；②change-lock 建议性语义与过期自愈参数（ttl 默认 120 分钟）按 v3.1 adopt 裁定实现，未引入更强机制。
- **D-4（AV-2 并行落地竞态）**：本单执行期间 AV-2 先后落地 manifest-build.mjs 与 asset-manifest-v2.json（16 行）。preflight P5/P6 按设计自动切换口径（P5 全量模式：0 处越权写方；P6：SKIP→PASS），全程未 FAIL 不等待——派单第 6 项预取行为实测符合。
- **D-5（parseChangedPaths 前导空格回归，已修）**：P7 联测首跑暴露 porcelain 前缀剥离失败（trim 先于前缀识别，" M path" 识别成裸路径）——修正为先剥离前缀再 trim，并重跑 §四 全流程通过。修正记录于此以留痕。
- **D-6（regression-all.mjs 头注）**：为 S14/S15 补了头注段说明两行，属同文件新段落的文档组成部分，S1-S13 段落文字与逻辑零改动。

## 七、证据清单（本目录）

- preflight-final-green.txt —— 终态全绿输出
- regression-all-14sections-output.txt —— 14 段回归完整输出
- change-lock-test-output.txt —— change-lock 全流程 + P7 联动实测
- probes/probe2-bad-adapter-output.txt、probes/probe3-orphan-candidate-output.txt —— 探针输出（探针 1 引文见 §三）
