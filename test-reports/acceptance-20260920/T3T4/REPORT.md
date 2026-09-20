# T3/T4 编排者独立验收报告（2026-09-20）

验收人：编排者（本会话）。基线快照 `cbd8e5e`。方法：写入范围核对 → 自报复核 → 盲测探针
（`blind-probes.mjs` v2，25 项，验收时刻编写/修正，执行者不可见）→ 回归全量 → 规格溯源抽查。

## 判定

| 任务 | 判定 | 附条件 |
|---|---|---|
| T3（P2-1/P2-2 修复） | **ACCEPTED** | 无 |
| T4（接线 B0-B3） | **ACCEPTED** | P2-3 登记；B0 默认路径仍未翻（按计划待一个观察周期后另行指令） |

## 验收证据

1. **写入范围**：5 个白名单内文件修改（ci.mjs/io-audit-hook.mjs/state.mjs/store.mjs/tt-journey.mjs）
   + 新增自测文件，逐一吻合。**3 处白名单外写入**（见 P2 登记）。
2. **复跑**：执行者探针全过（T3 2/2、B0 5/5、B1 9/9、B2 4/4、B3 7/7）
3. **盲测探针 25/25 PASS**，要点：
   - bl1：`callermatrix.mjs`/`official-ci.mjs` → consumption、真 `matrix.mjs` → routing
     （P2-1 修复在**我构造的**文件名上盲验通过）
   - bl2：JSONL 保留原文 `SKILL.md` 大写（P2-2 修复验证）
   - bl3：**三方对比**——新默认路径 vs `--lib` vs 基线 cbd8e5e 旧版（旧版置于 scripts/ 内运行
     保持相对路径），随机 plan-id 归一后 stdout 逐字节一致、exit 一致（旧版文件验后即删）
   - bl4：state 四命名空间 roundtrip；白名单外 `evil` fail-closed；**老 state（纯 plan 对象）
     静默兼容**；**未知 stateVersion fail-closed**（StateVersionError）；`yy/state@1` 合法
   - bl5：真并发竞争——A 持锁 1.2s 期间 B exit 3 `LOCK_BUSY`（fail-closed 不写 token）、
     无残留锁文件、释放后可复用
   - bl6：`--read` 与直接调用 journeyRead **深比较一致**（固定 --now）；`--project` 字节级
     不落盘（C-R5 单写者纪律）；老子命令 `--prereq-check` 空 ws 拦截 exit 1
4. **回归面**：regression-all 12/12；validate-structure 0 警告；既有 80 探针全 PASS
5. **规格溯源抽查（≥5）**：① B0 `--lib` 分支确为 import lib/ci.mjs 驱动（GATE_MAP/runGate）；
   ② legacy 历史字符串沿用（不采纳 lib 的 S6 命名，差异已在自报登记）；③ B1 STATE_VERSION
   语义 = 缺失合法/未知 fail-closed（对齐 C-R4 §2.2，亲自实测）；④ B2 锁常量沿用
   {retries:5, delayMs:400, staleMs:30000}；⑤ B3 `writerMode:'legacy'` 不落盘（亲自字节对比）

## 发现登记（P0=0，P1=0，P2=4）

- **P2-1（协议）**：T3 执行者把返工说明追加到**编排者验收报告**（`acceptance-20260920/T1T2/REPORT.md`，
  +37 行，append-only 未篡改判定内容）。该路径属"禁读禁写"区；判定为文件选择错误而非证据篡改
  （疑因 Owner 中继时把验收报告转给了执行者）。**纠正**：执行者报告只写自己的 RESULTS.md；
  Owner 转发派单时请勿附带验收报告正文。
- **P2-2（噪声）**：`R10-rebuild RESULTS.md` 与 `R5a out-probe-results.json` 被复跑刷新
  （时间戳/重算哈希）——白名单外但属重跑副产物，无实质影响。
- **P2-3（登记）**：S9 子进程的随机 `plan-<id>` 使 ci 双跑严格字节对比不可能——已用归一化
  口径验收。B0 翻默认的最终验收须沿用同一归一化口径。
- **P2-4（既存，待 Owner 裁决）**：ci S5 只检 `⬜` vs orchestrator `backlogIsPending` 检 `⬜◐`
  ——接线深化前需统一口径。

## 自报诚实度

T4 自报 2 处关键偏差（随机 plan-id 噪声用 legacy×2 自证排除；lib GATE_TOPOLOGY S6 命名
不采用以保字节一致）——抽查属实。B1 引入 STATE_VERSION 属语义新增，已主动申报且语义
正确。按"如实申报从宽"认可。

## 下一步（已派单）

T5（IO 基线跑，依赖 T3 ✅）∥ T6（接线 B4-B8，依赖 B1/B2 ✅ + A0 修正案 B5 用 DI）。
