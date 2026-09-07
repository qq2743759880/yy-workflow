# FIX-C1C2 修复报告（M1 批判 P0 × 2）

- 日期：2026-09-07 · 分支 `feature-yy-owner-ux`（基线 HEAD `aea606c`）· 执行方：独立修复子 agent（opencode）
- 依据：`yy/plans/tasks/M1-优化修改方案.md` C1（L6-17）/ C2（L19-29）+ `yy/plans/tasks/M1-技术批判.md` C-16/C-17
- 范围：`yy/scripts/tt-journey.mjs`、`yy/scripts/orchestrator.mjs`（syncJourney 一处）、`yy/scripts/validate-structure.mjs`（⑨ 新规则）、`yy/commands/*.md` ×6（首行指令）。schema `yy/journey@1` 不变（plans[] 追加留痕记录类型）。

## 1 · C1 --update 防跳（逐点对照方案 L6-17）

| 方案点 | 实现 | 落点（行号） |
|---|---|---|
| 1. updateJourney 置 done 前调 prereqCheck，未满足且无 --force 抛 PrereqError（exit 3） | `PrereqError` 类（携带 `exitCode:3`）；`updateJourney()` 在写盘前 `prereqCheck(journey, n)`，`!ok && !force` → throw；**journey.json 不落盘（字节不变）** | tt-journey.mjs L42-48（类）、L138-152（updateJourney） |
| 2. main --update 分支捕获 PrereqError → stderr 原因 + 「--force 可越过」，exit 3 | main catch `instanceof PrereqError` → `console.error('prereq 未满足: …')` + `exitCode = 3`；其余错误仍 exit 2 | tt-journey.mjs L466-474 |
| 3. --force 越过：stderr WARN + plans[] 追加 `{planId:'__manual__', status:'prereq-bypassed', updatedAt}` 留痕 | bypass 时 stderr `WARN: prereq bypassed by --force（<原因>）`；plans[] 追加含 reason 全文 | tt-journey.mjs L141/L149-151；main 传 `force: has('force')` |
| 4. orchestrator syncJourney 写前 prereqCheck，失败仅 warning 不阻断 | 写前 `prereqCheck(journey, 8)`，`!ok` → stderr WARN 继续（派生是事实记录，失败路径派生不可丢）；同步经 withJourneyLock 包裹 | orchestrator.mjs L171-207（syncJourney） |
| 5. validate-structure 增规则：commands/*.md 正文须含 `--prereq-check` | 新增 ⑨ 段：剥 frontmatter 后 `/--prereq-check/` 必须命中，缺失 → error + 汇总行 `阶段命令防跳调用行: n/n 命中` | validate-structure.mjs L157-165、输出 L173 |

诚实说明（与方案的偏差）：方案 L9 示意「insert 在 L118 node.status='done' 前」，实际把 prereqCheck 提前到**读-改-写整体之前、锁内**判定后立即抛出——语义等价（未满足时 step7 永不置 done、文件不落盘），且避免了锁内抛错需回滚的问题。方案 L12 说 step8 依赖 step7，syncJourney 校验取 n=8（map 中 step8 允许 in_progress/done，与派生场景匹配）；map 无 step7 依赖项，派生只动 plans[]/step7 字段，warning 路径当前不会实际触发，为未来 map 扩展预留。

## 2 · C2 并发写保护（逐点对照方案 L19-29）

| 方案点 | 实现 | 落点 |
|---|---|---|
| 1. `withJourneyLock(file, fn)`：open(lockPath,'wx') → fn → unlink，lockPath=`<journey>.lock` | `withJourneyLock(workspace, sessionId, fn)`：`fs.open(journeyPath+'.lock','wx')`（O_EXCL）→ fn → finally unlink；锁路径与 session 命名空间联动 | tt-journey.mjs L156-205（tryLock/withJourneyLock） |
| 2. 重试 5×400ms；仍失败 WARN proceeding without lock | `JOURNEY_LOCK_RETRY={times:5,delayMs:400}`（常量可调）；穷尽后 stderr `WARN: journey lock busy, proceeding without lock` + 无锁放行（可用性优先） | 同上 |
| 3. updateJourney 与 orchestrator syncJourney 均经锁包裹 | updateJourney 整体（含 read-modify-write）包锁；syncJourney 同一把锁；跨进程互斥（O_EXCL 为内核级语义） | 两处已验 |
| 4. stale >30s 接管 | `JOURNEY_LOCK_STALE_MS=30000`：EEXIST 时 stat mtime，超 30s 先 unlink 再重试（进程被 kill 残留自愈）；非 EEXIST 错误（如权限）直接上抛不吞 | 同上 |

不引 proper-lockfile（方案已定）：零依赖，仅 node:fs/promises + setTimeout。

## 3 · 修复过程发现并修复的 2 个实现缺陷（诚实记录）

1. **tryLock 双拼 `.lock`**：`tryLock(file)` 入参已是完整锁路径，函数体内又拼了一次 `.lock`（`journey.json.lock.lock`），导致锁永获成功但锁文件**永不释放** → 后续所有写入静默走无锁降级 → GWT8 负对照竞写把 JSON 写坏（parse 失败暴露）。修复为对传入路径直接 open('wx')。修复后全链路无 WARN 降级。
2. **GWT8 负对照永不失败**：首版负对照两写者都在 sleep 前 push、sleep 后写——B 的快照已含 A 的条目，快照互相包含，断言恒真（测不出丢条目）。改为**错峰交错**（A 读@0 写@50；B 读@25 写@75，B 读到 A 写前快照）后，10 轮内 race-A 必被覆盖丢失，负对照成立（证明锁必要，非恒真断言）。

## 4 · GWT6-8 复现输出（实测）

### GWT6（self-test 内 + 端到端）
```
PASS GWT6   # self-test：PrereqError instanceof + exitCode 3 + message 含「阶段 5」+ journey 字节不变
```
端到端（temp workspace：0/1/3/5 done 后 step5 回退 in_progress）：
```
$ node scripts/tt-journey.mjs --workspace <ws> --update --step 7 --gate gate-a-approved
prereq 未满足: 阶段 5 未完成（in_progress），步骤 7 不得开工（缺 gate: contract-frozen）；--force 可越过
exit=3
journey unchanged after exit3: True   # Get-FileHash 前后一致
```

### GWT7（self-test 内 + 端到端）
```
PASS GWT7   # step7 done + plans[] 含 __manual__/prereq-bypassed + updatedAt
```
端到端同场景 + `--force`：
```
WARN: prereq bypassed by --force（阶段 5 未完成（in_progress），步骤 7 不得开工（缺 gate: contract-frozen））——已在 plans[] 留痕
exit=0
step7=done bypass=prereq-bypassed:阶段 5 未完成（in_progress），步骤 7 不得开
```

### GWT8（self-test 内 + 独立 20 条目复现）
```
PASS GWT8   # 锁版双进程 ×10 轮 → proc-A/proc-B 全存活；错峰无锁负对照 10 轮 → 必丢条目
```
独立复现（20 子进程/10 轮，全部 exit 0）：
```
fails= 0 plans= [ 'p0-0','p1-0','p0-1','p1-1', … 'p0-9','p1-9' ]   # 20/20 条目存活
```
锁等待 P99 未单测（方案指标）：实测 10 轮并发每轮 2 子进程串行完成约 0.9-2.1s（含 node 启动开销），锁竞争窗口内重试 5×400ms 未触发降级 WARN（负对照阶段外的输出无 lock busy）。

### orchestrator 派生（C1.4 + C2.3 实测）
```
$ node scripts/orchestrator.mjs --backend prompt --task "backend login module" --workspace <tmp>
… subtask skipped: DEP_PRECONDITION …（既有行为，与本次改动无关）
exit=0
plans=1 [{"id":"plan-mtr1ii9b","st":"done"}]   # syncJourney 经锁写入成功，无 prereq WARN（step8 map 放行 in_progress/done）
summary status=done done=1/8
```
失败路径派生不被阻断：prereqCheck 失败仅 warning（无 throw），EXIT.FAILED 路径的 writeStateSummary→syncJourney 保持既有行为。

## 5 · exit 码矩阵复测（既有不回归）

```
prereq no-journey    exit=1 (expect 1) ✓
prereq no-step       exit=2 (expect 2) ✓
update no-step       exit=2 (expect 2) ✓
update step0         exit=0 (expect 0) ✓   # PREREQ_MAP 无 0 项天然放行（方案风险点，已验）
update step9         exit=2 (expect 2) ✓
prereq step7 未就绪   exit=1 (expect 1) ✓
--update --step 7 未就绪 exit=3 (new)      ✓
只读渲染空目录        exit=0 + INFERRED + 不落盘 ✓
```

## 6 · validate-structure ⑨ 新规则 + 双回归

- `阶段命令防跳调用行(--prereq-check): 6/6 命中`，`[OK] 结构校验通过 (0 项警告)`，exit 0（修复前 0/6——6 个 commands/*.md 正文均无 `--prereq-check` 字样，本轮首行指令全部改为「先跑 `node scripts/tt-journey.mjs --prereq-check --step <n>` 机验前置」并保留阻断语义）。
- 双回归：
  - `yy/` 内 `node scripts/regression-all.mjs` → **结果: 8 PASS / 0 FAIL**，exit 0（S1-S8 全绿）
  - 仓库根同脚本 → **结果: 8 PASS / 0 FAIL**，exit 0
  - `tt-journey.mjs --self-test` → GWT1-8 **8/8 PASS**（GWT2 因 C1 链式前置补铺 0→1→3 前置链，断言本体未改）

## 7 · diff 摘要（9 文件，+218/-44）

| 文件 | 变更 |
|---|---|
| yy/scripts/tt-journey.mjs | +PrereqError(exit 3)；+--force 越过留痕（plans[] __manual__/prereq-bypassed）；+withJourneyLock（wx O_EXCL/重试 5×400ms/stale 30s 接管/WARN 降级）；updateJourney 锁内 prereqCheck；+--lock-probe 子进程入口；self-test 增 GWT6-8 与 FAIL detail 输出；GWT2 补前置链 |
| yy/scripts/orchestrator.mjs | syncJourney：写前 prereqCheck（step8，失败仅 WARN）+ withJourneyLock 包裹；import 增 prereqCheck/withJourneyLock |
| yy/scripts/validate-structure.mjs | ⑨ commands/*.md 正文须含 `--prereq-check`（error 级）+ 汇总行 |
| yy/commands/yy-0..5-*.md ×6 | 首行指令：读文件自查 → `--prereq-check --step <n>` 机验优先（exit 1 阻断注入语义保留） |

## 8 · 残留风险 / 未做

- 锁 P99 计时未做成断言（仅人工观测）；如需可后续加 GWT 采样。
- `--session` 命名空间下锁路径随 journeyPath 分隔（各自独立锁），未单独并发实测——同一进程级语义，风险低。
- C3-C9（P1/P2）不在本任务范围，未动。
- 方案 C1.4 原文「orchestrator 写前同样调 prereqCheck（step8 依赖 step7）」：step8 在 PREREQ_MAP 中已声明 `inProgressOk: true`（task04 冻结映射），派生场景（plan 收尾后 step7 至少 in_progress/done）天然放行，故当前代码路径 warning 不触发；若未来把派生改到 step7 语义，需复核该行。