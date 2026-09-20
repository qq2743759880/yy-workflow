# T4 接线 B0-B3 自测结果（2026-09-20）

工作区：`D:\.ai-hub\skills\yy`。按 `plans/wiring-and-audit-plan-20260920.md` P3 阶段 B 的
B0-B3 步施工。写入白名单严格遵守：仅改 `scripts/ci.mjs`、`scripts/lib/state.mjs`、
`scripts/lib/store.mjs`、`scripts/tt-journey.mjs` 四个文件 + 本自测目录。未做任何 git 操作。

## 总门

- `node scripts/regression-all.mjs`：**12/12 PASS**（见末尾运行记录）
- `node scripts/validate-structure.mjs --verbose`：**0 警告，exit 0**，H1-H9 全 PASS
- 既有探针：tt-journey `--self-test` 全过（B3-4d 回归已复跑）

## 分步结果

### B0 `scripts/ci.mjs` → 双跑薄壳（`--lib`）— 5/5 PASS

- 新增 `--lib` 旗标：`--lib` 走 `scripts/lib/ci.mjs`（`runGate`/`countOpenP0`/`buildTempReportContent`/
  `GATE_MAP`），默认走原 legacy 内联路径。**未翻默认**。
- 尾随换行（P2-3）：两路径全程用 `console.log`（自带 `\n`），末行 `console.log('\nCI PASS')` 自带
  收尾换行，无 `process.stdout.write` 缺尾换行问题。
- 自测 `b0-diff.mjs`：
  - G1 成功组（真实仓库）：legacy vs `--lib`，退出码均 0；**归一化后逐字节一致**（5447B）。
  - G2 S1 缺 frontmatter 失败组：两版均 exit 1，stdout+stderr 逐字节一致。
  - G3 子进程缺失（spawn MODULE_NOT_FOUND）失败组：两版均 exit 1，逐字节一致。
  - G4 S5 P0 硬闸门失败组（沙箱 tracker 含 P0 ⬜）：两版均 exit 1，逐字节一致。
- **偏差声明（非接线差异）**：G1 原始两次运行在 S9 test-domain-declared 输出的随机 plan id
  （`plan-mu9<base36>`）处不同。这是子进程运行间随机性——已用「legacy 跑两次」证明 legacy-run1 vs
  legacy-run2 在同一 token 处也不同（环境噪声），**不是 legacy/--lib 接线差异**。自测对该 token 与
  tmpdir 绝对路径做归一化后逐字节一致。此为子进程行为，不在本步可改文件白名单内，故登记为偏差而非缺陷。
- **登记差异**：lib `GATE_TOPOLOGY` 把资产质量评分段命名为 `S6`，而 legacy 历史 stdout 印为
  `S5 资产质量评分（asset-call-rate）`。为逐字节一致，`--lib` 路径沿用 legacy 历史字符串（见
  ci.mjs mainLib 注释），不采用 lib 的 S6 名。

### B1 `scripts/lib/state.mjs` → 命名空间读写层 — 9/9 PASS

纯 additive，既有 `STATE/TRANSITIONS/canTransition/assertTransition` 零改动。
- 新增 `STATE_VERSION='yy/state@1'`、`NAMESPACES=['receipt','finding','change','journey']`、
  `readNamespace(ns, opts?)`、`appendNamespace(ns, rec, opts?)`、`StateVersionError`。
- 四命名空间 roundtrip（B1-1）；白名单外 fail-closed 抛错（B1-2/2b）。
- 老 state 文件（plan 对象、无新段）读取返回 `[]` 不报错（B1-3）；append 保留既有 plan 字段、
  补齐四段数组并写 stateVersion（B1-3b/3c/3d）。
- stateVersion 缺失 = legacy v0 合法；存在但不认识 = fail-closed `STATE_VERSION_UNSUPPORTED`（B1-4，
  对齐 C-R4-control §2.2）。
- 写入为 tmp+rename 原子写（Windows 覆盖回退）。
- 注：本层引入 STATE_VERSION（此前 state.mjs 无此字段），属 additive 新增，未「动」既有版本，未触发 STOP。

### B2 `scripts/lib/store.mjs` → `withLock` — 4/4 PASS

纯 additive，既有 `createStore` 零改动。
- 导出 `withLock(resourcePath, fn, opts?)`：锁文件 = `resourcePath + '.lock'`，
  `open(path,'wx')` O_EXCL 独占 + 重试 + stale 自愈（mtime>30s 接管）；**fail-closed**（重试耗尽抛
  `LockBusyError`，不沿用 journey 锁的 fail-open）。常量沿用 `{retries:5,delayMs:400,staleMs:30000}`。
- 双进程实测（`b2-lock-test.mjs` + `b2-lock-probe.mjs`）：A 持锁 800ms，B 重试预算 ~200ms
  → A 拿锁写 token（exit 0），B 抛 `LOCK_BUSY_FAIL_CLOSED`（exit 3）不写 token（B2-1/2）；
  无残留锁文件（B2-3）；串行两进程均可拿锁、释放干净可复用（B2-4）。

### B3 `scripts/tt-journey.mjs` → `--read`/`--project` — 7/7 PASS

- 新增 `--read`（调 `journeyRead`）、`--project`（调 `journeyProject`），支持 `--workspace`/`--session`/
  `--now <ISO>`。动态 import `./lib/journey.mjs`：老命令不加载 journey.mjs。
- **单写者纪律（C-R5）**：`--project` 以 `writerMode:'legacy'` 调用，**不落盘**（B3-3 实测
  journey.json 不变）；projection 落盘仍由 `--update` 单写者完成。
- `--read`/`--project` stdout 与直接调用 `journeyRead`/`journeyProject` **逐字节一致**
  （固定 `--now` 注入 opts.now，B3-1/2，4332B/4438B）。
- 老子命令零变化回归：`--prereq-check`（满足/拦截两态，B3-4/4b）、默认渲染（B3-4c）、
  `--self-test` 全过（B3-4d）。未改 journey.mjs 本体，未触发 STOP。

## STOP 条件核对

- B0 双跑无可消除的接线差异（唯一 raw 差异为子进程随机 plan id，已证明为环境噪声）。未触发。
- B1 未「动」既有 STATE_VERSION（此前不存在，本步 additive 新增）。未触发。
- B3 未改 journey.mjs。未触发。

## 自测文件

- `b0-diff.mjs` / `b1-roundtrip.mjs` / `b2-lock-test.mjs` / `b2-lock-probe.mjs` / `b3-self-test.mjs`
- 运行记录见下。

## 运行记录（原样）

```
$ node scripts/regression-all.mjs        # 总门
结果: 12 PASS / 0 FAIL  （REG exit=0）

$ node scripts/validate-structure.mjs --verbose   # 总门
[OK] 结构校验通过 (0 项警告)  （VS exit=0；H1-H9 全 PASS）

$ node .../b0-diff.mjs
G1 成功组：跑真实仓库 ci.mjs 默认 vs --lib
PASS G1 成功组归一化后逐字节一致（剥离随机 plan id/tmp 路径）  [legacy bytes=5447 lib bytes=5447；环境随机噪声=true]
PASS G1 成功组退出码一致  [legacy exit=0 lib exit=0]
PASS G2 S1 缺 frontmatter 失败组逐字节一致(exit1)  [exit=1/1]
PASS G3 spawn 失败组逐字节一致(exit1 + [FAIL] S1 MODULE_NOT_FOUND)  [exit=1/1]
PASS G4 S5 P0 失败组逐字节一致(exit1 + [FAIL] P0)  [exit=1/1]
B0 self-test: 5/5 passed  (exit=0)

$ node .../b1-roundtrip.mjs
PASS B1-1 四命名空间读写 roundtrip
PASS B1-2 白名单外 ns fail-closed（抛错）
PASS B1-2b append 白名单外 fail-closed
PASS B1-3 老 state 文件缺新段 → 空默认不报错
PASS B1-3b append 保留既有 plan 字段  [id=plan-x]
PASS B1-3c append 补齐四段数组
PASS B1-3d append 写入 stateVersion  [yy/state@1]
PASS B1-4 未知 stateVersion fail-closed(STATE_VERSION_UNSUPPORTED)
PASS B1-5 既有 STATE/canTransition 未动
B1 self-test: 9/9 passed  (exit=0)

$ node .../b2-lock-test.mjs
PASS B2-1 双进程抢锁：一成(A exit0+token)
PASS B2-2 一败 fail-closed(B exit3, LOCK_BUSY, 不写token)
PASS B2-3 无残留锁文件
PASS B2-4 串行两进程均拿锁（锁释放干净可复用）
B2 self-test: 4/4 passed  (exit=0)

$ node .../b3-self-test.mjs
PASS B3-1 --read 与直接 journeyRead 逐字节一致  [cli exit=0 bytes=4332/4332]
PASS B3-2 --project 与直接 journeyProject 逐字节一致  [cli exit=0 bytes=4438/4438]
PASS B3-3 --project 只读消费不落盘（journey.json 不变）
PASS B3-4 老 --prereq-check 回归（exit0 + reason）
PASS B3-4b 老 --prereq-check 拦截未满足（exit1）
PASS B3-4c 老默认渲染回归（含进度图）
PASS B3-4d 老 --self-test 回归（全过）
B3 self-test: 7/7 passed  (exit=0)
```

